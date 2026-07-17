import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "../lib/firebase";
import type { Card, CardStatus, Draft } from "../types/card";
import { reviewFieldsForStatus } from "../utils/reviewAlgorithm";

const WORDS = "words";
const FOLDERS = "folders";

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function normalizeCard(id: string, data: DocumentData): Card {
  const status = (["new", "learning", "known"].includes(data.status)
    ? data.status
    : "new") as CardStatus;
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((tag: unknown): tag is string => typeof tag === "string")
    : typeof data.tags === "string"
      ? data.tags
          .split(",")
          .map((tag: string) => tag.trim())
          .filter(Boolean)
      : [];

  return {
    id,
    word: String(data.word ?? ""),
    meaning: String(data.meaning ?? ""),
    example: String(data.example ?? ""),
    status,
    tags: tags.slice(0, 3),
    folder: String(data.folder ?? "General").trim() || "General",
    interval_days: Number(data.interval_days) || 0,
    next_review_at:
      data.next_review_at === undefined || data.next_review_at === null
        ? null
        : String(data.next_review_at),
  };
}

function cardToDoc(card: Omit<Card, "id"> & { created_at?: string; updated_at?: string }) {
  return {
    word: card.word,
    meaning: card.meaning,
    example: card.example,
    status: card.status,
    tags: card.tags,
    folder: card.folder,
    interval_days: card.interval_days,
    next_review_at: card.next_review_at,
    created_at: card.created_at ?? nowIso(),
    updated_at: card.updated_at ?? nowIso(),
  };
}

async function commitInChunks(
  build: (push: (fn: (batch: ReturnType<typeof writeBatch>) => void) => void) => void,
) {
  const db = getDb();
  let batch = writeBatch(db);
  let ops = 0;

  async function flush() {
    if (ops === 0) {
      return;
    }
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  }

  const push = (fn: (batch: ReturnType<typeof writeBatch>) => void) => {
    fn(batch);
    ops += 1;
  };

  // Collect ops synchronously then flush in chunks via wrapper
  const queued: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];
  build((fn) => {
    queued.push(fn);
  });

  for (const fn of queued) {
    fn(batch);
    ops += 1;
    if (ops >= 400) {
      await flush();
    }
  }

  await flush();
  void push;
}

export async function listWords(): Promise<Card[]> {
  const snapshot = await getDocs(collection(getDb(), WORDS));
  return snapshot.docs
    .map((entry) => normalizeCard(entry.id, entry.data()))
    .sort((a, b) => {
      // Prefer newest first when timestamps exist on raw docs.
      return a.word.localeCompare(b.word);
    });
}

export async function listFolders(): Promise<string[]> {
  const snapshot = await getDocs(collection(getDb(), FOLDERS));
  const names = snapshot.docs
    .map((entry) => String(entry.data().name ?? entry.id).trim())
    .filter(Boolean);
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}

export async function ensureFolder(name: string): Promise<string> {
  const normalized = name.trim() || "General";
  await setDoc(
    doc(getDb(), FOLDERS, normalized),
    { name: normalized, updated_at: nowIso() },
    { merge: true },
  );
  return normalized;
}

export async function createFolder(name: string): Promise<string> {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Folder name is required.");
  }

  const existing = await listFolders();
  if (existing.some((folder) => folder.toLowerCase() === normalized.toLowerCase())) {
    throw new Error("Folder already exists.");
  }

  return ensureFolder(normalized);
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  const normalized = newName.trim();
  if (!normalized) {
    throw new Error("Folder name is required.");
  }

  const db = getDb();
  const wordsSnap = await getDocs(collection(db, WORDS));

  await commitInChunks((queue) => {
    for (const wordDoc of wordsSnap.docs) {
      if (String(wordDoc.data().folder ?? "") === oldName) {
        queue((batch) => {
          batch.update(wordDoc.ref, { folder: normalized, updated_at: nowIso() });
        });
      }
    }
    queue((batch) => {
      batch.set(doc(db, FOLDERS, normalized), { name: normalized, updated_at: nowIso() }, { merge: true });
    });
    queue((batch) => {
      batch.delete(doc(db, FOLDERS, oldName));
    });
  });
}

export async function deleteFolderDoc(name: string): Promise<void> {
  if (name === "General") {
    throw new Error("The General folder cannot be deleted.");
  }

  const db = getDb();
  const wordsSnap = await getDocs(collection(db, WORDS));

  await commitInChunks((queue) => {
    for (const wordDoc of wordsSnap.docs) {
      if (String(wordDoc.data().folder ?? "") === name) {
        queue((batch) => {
          batch.update(wordDoc.ref, { folder: "General", updated_at: nowIso() });
        });
      }
    }
    queue((batch) => {
      batch.set(doc(db, FOLDERS, "General"), { name: "General", updated_at: nowIso() }, { merge: true });
    });
    queue((batch) => {
      batch.delete(doc(db, FOLDERS, name));
    });
  });
}

export async function createWord(draft: Draft & Partial<Card>): Promise<Card> {
  const folder = await ensureFolder(draft.folder || "General");
  const review = reviewFieldsForStatus(draft.status || "new");
  const id = createId();
  const created_at = nowIso();
  const card: Card = {
    id,
    word: draft.word.trim(),
    meaning: draft.meaning.trim(),
    example: (draft.example || "").trim(),
    status: draft.status || "new",
    tags: (draft.tags || []).slice(0, 3),
    folder,
    interval_days: draft.interval_days ?? review.interval_days,
    next_review_at:
      draft.next_review_at !== undefined ? draft.next_review_at : review.next_review_at,
  };

  await setDoc(doc(getDb(), WORDS, id), cardToDoc({ ...card, created_at, updated_at: created_at }));
  return card;
}

export async function saveWord(card: Card): Promise<Card> {
  const folder = await ensureFolder(card.folder || "General");
  const next: Card = {
    ...card,
    word: card.word.trim(),
    meaning: card.meaning.trim(),
    example: (card.example || "").trim(),
    folder,
    tags: card.tags.slice(0, 3),
    interval_days: Number(card.interval_days) || 0,
  };

  const existing = await getDoc(doc(getDb(), WORDS, card.id));
  const created_at = existing.exists()
    ? String(existing.data()?.created_at ?? nowIso())
    : nowIso();

  await setDoc(
    doc(getDb(), WORDS, card.id),
    cardToDoc({ ...next, created_at, updated_at: nowIso() }),
    { merge: true },
  );
  return next;
}

export async function deleteWord(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), WORDS, id));
}

export type ImportInput = {
  word: string;
  meaning: string;
  example?: string;
  status?: CardStatus;
  tags?: string[];
  folder?: string;
};

export async function importWords(rows: ImportInput[]): Promise<{
  words: Card[];
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
}> {
  const created: Card[] = [];
  const errors: Array<{ row: number; error: string }> = [];
  const folderCache = new Set<string>();

  for (let index = 0; index < rows.length; index += 1) {
    const entry = rows[index];
    const word = entry.word?.trim();
    const meaning = entry.meaning?.trim();
    if (!word || !meaning) {
      errors.push({ row: index + 1, error: "Word and meaning are required." });
      continue;
    }

    const folderName = (entry.folder || "General").trim() || "General";
    if (!folderCache.has(folderName)) {
      await ensureFolder(folderName);
      folderCache.add(folderName);
    }

    created.push({
      id: createId(),
      word,
      meaning,
      example: (entry.example || "").trim(),
      status: entry.status || "new",
      tags: (entry.tags || []).slice(0, 3),
      folder: folderName,
      interval_days: 0,
      next_review_at: null,
    });
  }

  await commitInChunks((queue) => {
    for (const card of created) {
      const created_at = nowIso();
      queue((batch) => {
        batch.set(
          doc(getDb(), WORDS, card.id),
          cardToDoc({ ...card, created_at, updated_at: created_at }),
        );
      });
    }
  });

  return {
    words: created,
    imported: created.length,
    skipped: errors.length,
    errors,
  };
}
