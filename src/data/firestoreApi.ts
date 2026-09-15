import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "../lib/firebase";
import {
  sharedSnapshotPath,
  sharedSnapshotWordPath,
  sharedSnapshotWordsPath,
  userFolderPath,
  userFoldersPath,
  userImportedSnapshotPath,
  userPublishedSnapshotPath,
  userPublishedSnapshotsPath,
  userWordPath,
  userWordsPath,
} from "../lib/userDataPath";
import {
  MAX_SHARED_SNAPSHOT_WORDS,
  nextAvailableFolderName,
} from "../lib/sharedSnapshots";
import type { Card, CardStatus, Draft, Folder } from "../types/card";
import type {
  CopySnapshotResult,
  PublishedSnapshot,
  PublishSnapshotResult,
  SharedSnapshot,
  SharedSnapshotMeta,
  SharedSnapshotStatus,
  SharedSnapshotWord,
} from "../types/sharedSnapshot";
import { reviewFieldsForStatus } from "../utils/reviewAlgorithm";

function wordsRef(uid: string) {
  return collection(getDb(), userWordsPath(uid));
}

function foldersRef(uid: string) {
  return collection(getDb(), userFoldersPath(uid));
}

function wordRef(uid: string, id: string) {
  return doc(getDb(), userWordPath(uid, id));
}

function folderRef(uid: string, id: string) {
  return doc(getDb(), userFolderPath(uid, id));
}

function snapshotRef(shareId: string) {
  return doc(getDb(), sharedSnapshotPath(shareId));
}

function snapshotWordsRef(shareId: string) {
  return collection(getDb(), sharedSnapshotWordsPath(shareId));
}

function publishedSnapshotsRef(uid: string) {
  return collection(getDb(), userPublishedSnapshotsPath(uid));
}

function publishedSnapshotRef(uid: string, shareId: string) {
  return doc(getDb(), userPublishedSnapshotPath(uid, shareId));
}

function importedSnapshotRef(uid: string, shareId: string) {
  return doc(getDb(), userImportedSnapshotPath(uid, shareId));
}

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
    folder: String(data.folder ?? "").trim(),
    interval_days: Number(data.interval_days) || 0,
    next_review_at:
      data.next_review_at === undefined || data.next_review_at === null
        ? null
        : String(data.next_review_at),
    correct_streak: Number(data.correct_streak) || 0,
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
    correct_streak: Number(card.correct_streak) || 0,
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
}

export async function listWords(uid: string): Promise<Card[]> {
  const snapshot = await getDocs(wordsRef(uid));
  return snapshot.docs
    .map((entry) => normalizeCard(entry.id, entry.data()))
    .sort((a, b) => a.word.localeCompare(b.word));
}

export async function listFolders(uid: string): Promise<Folder[]> {
  const snapshot = await getDocs(foldersRef(uid));
  return snapshot.docs
    .map((entry) => {
      const name = String(entry.data().name ?? entry.id).trim();
      return { id: entry.id, name: name || entry.id };
    })
    .filter((folder) => folder.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve folder by display name; create with UUID id if missing. Returns folder id. */
export async function ensureFolderByName(uid: string, name: string): Promise<string> {
  const normalized = name.trim();
  if (!normalized) {
    return "";
  }

  const existing = await listFolders(uid);
  const match = existing.find(
    (folder) => folder.name.toLowerCase() === normalized.toLowerCase(),
  );
  if (match) {
    return match.id;
  }

  const id = createId();
  await setDoc(folderRef(uid, id), {
    name: normalized,
    updated_at: nowIso(),
  });
  return id;
}

export async function createFolder(uid: string, name: string): Promise<Folder> {
  const normalized = name.trim();
  if (!normalized) {
    throw new Error("Folder name is required.");
  }
  if (normalized.toLowerCase() === "general") {
    throw new Error('"General" is reserved. Choose another name.');
  }
  if (normalized.toLowerCase() === "learning") {
    throw new Error('"learning" is reserved. Choose another name.');
  }

  const existing = await listFolders(uid);
  if (existing.some((folder) => folder.name.toLowerCase() === normalized.toLowerCase())) {
    throw new Error("Folder already exists.");
  }

  const id = createId();
  await setDoc(folderRef(uid, id), {
    name: normalized,
    updated_at: nowIso(),
  });
  return { id, name: normalized };
}

export async function renameFolder(
  uid: string,
  folderId: string,
  newName: string,
): Promise<void> {
  const normalized = newName.trim();
  if (!normalized) {
    throw new Error("Folder name is required.");
  }
  if (!folderId.trim()) {
    throw new Error("Folder id is required.");
  }

  const existing = await listFolders(uid);
  if (
    existing.some(
      (folder) =>
        folder.id !== folderId && folder.name.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    throw new Error("Folder already exists.");
  }

  const targetFolderRef = folderRef(uid, folderId);
  const snapshot = await getDoc(targetFolderRef);
  if (!snapshot.exists()) {
    throw new Error("Folder not found.");
  }

  await setDoc(
    targetFolderRef,
    { name: normalized, updated_at: nowIso() },
    { merge: true },
  );
}

export async function deleteFolderDoc(uid: string, folderId: string): Promise<void> {
  const normalized = folderId.trim();
  if (!normalized) {
    throw new Error("Folder id is required.");
  }

  const folderSnap = await getDoc(folderRef(uid, normalized));
  const legacyName = folderSnap.exists()
    ? String(folderSnap.data()?.name ?? normalized).trim()
    : normalized;
  const wordsSnap = await getDocs(wordsRef(uid));

  await commitInChunks((queue) => {
    for (const wordDoc of wordsSnap.docs) {
      const cardFolder = String(wordDoc.data().folder ?? "").trim();
      if (cardFolder === normalized || cardFolder === legacyName) {
        queue((batch) => {
          batch.update(wordDoc.ref, { folder: "", updated_at: nowIso() });
        });
      }
    }
    queue((batch) => {
      batch.delete(folderRef(uid, normalized));
    });
  });
}

/**
 * Remap legacy cards that store folder display name → folder id.
 * Returns updated cards (and persists remaps).
 */
export async function reconcileCardFolderIds(
  uid: string,
  cards: Card[],
  folders: Folder[],
): Promise<Card[]> {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const byName = new Map(folders.map((folder) => [folder.name.toLowerCase(), folder]));
  const updates: Array<{ id: string; folderId: string }> = [];

  const nextCards = cards.map((card) => {
    const ref = card.folder.trim();
    if (!ref || byId.has(ref)) {
      return card;
    }

    const named = byName.get(ref.toLowerCase());
    if (!named) {
      return card;
    }

    updates.push({ id: card.id, folderId: named.id });
    return { ...card, folder: named.id };
  });

  if (updates.length > 0) {
    await commitInChunks((queue) => {
      for (const update of updates) {
        queue((batch) => {
          batch.update(wordRef(uid, update.id), {
            folder: update.folderId,
            updated_at: nowIso(),
          });
        });
      }
    });
  }

  return nextCards;
}

/**
 * Remove legacy system folder "General" and clear it from cards.
 * Safe to call on every load.
 */
export async function purgeLegacyGeneralFolder(uid: string): Promise<{
  folders: Folder[];
  cards: Card[];
  removed: boolean;
}> {
  const [folders, cards] = await Promise.all([listFolders(uid), listWords(uid)]);
  const generalFolders = folders.filter(
    (folder) =>
      folder.id === "General" || folder.name.trim().toLowerCase() === "general",
  );
  const generalIds = new Set(generalFolders.map((folder) => folder.id));
  const touchesGeneral = cards.some(
    (card) =>
      card.folder === "General" ||
      generalIds.has(card.folder) ||
      card.folder.trim().toLowerCase() === "general",
  );

  if (generalFolders.length === 0 && !touchesGeneral) {
    return { folders, cards, removed: false };
  }

  const wordsSnap = await getDocs(wordsRef(uid));

  await commitInChunks((queue) => {
    for (const wordDoc of wordsSnap.docs) {
      const cardFolder = String(wordDoc.data().folder ?? "").trim();
      const isGeneralRef =
        cardFolder === "General" ||
        generalIds.has(cardFolder) ||
        cardFolder.toLowerCase() === "general";
      if (isGeneralRef) {
        queue((batch) => {
          batch.update(wordDoc.ref, { folder: "", updated_at: nowIso() });
        });
      }
    }
    for (const folder of generalFolders) {
      queue((batch) => {
        batch.delete(folderRef(uid, folder.id));
      });
    }
  });

  const nextFolders = folders.filter((folder) => !generalIds.has(folder.id));
  const nextCards = cards.map((card) => {
    const ref = card.folder.trim();
    if (
      ref === "General" ||
      generalIds.has(ref) ||
      ref.toLowerCase() === "general"
    ) {
      return { ...card, folder: "" };
    }
    return card;
  });

  return { folders: nextFolders, cards: nextCards, removed: true };
}

export async function createWord(
  uid: string,
  draft: Draft & Partial<Card>,
): Promise<Card> {
  const folder = draft.folder?.trim() ?? "";
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
    correct_streak:
      draft.correct_streak !== undefined
        ? Number(draft.correct_streak) || 0
        : review.correct_streak,
  };

  await setDoc(
    wordRef(uid, id),
    cardToDoc({ ...card, created_at, updated_at: created_at }),
  );
  return card;
}

export async function saveWord(uid: string, card: Card): Promise<Card> {
  const folder = card.folder?.trim() ?? "";
  const next: Card = {
    ...card,
    word: card.word.trim(),
    meaning: card.meaning.trim(),
    example: (card.example || "").trim(),
    folder,
    tags: card.tags.slice(0, 3),
    interval_days: Number(card.interval_days) || 0,
    correct_streak: Number(card.correct_streak) || 0,
  };

  const existing = await getDoc(wordRef(uid, card.id));
  const created_at = existing.exists()
    ? String(existing.data()?.created_at ?? nowIso())
    : nowIso();

  await setDoc(
    wordRef(uid, card.id),
    cardToDoc({ ...next, created_at, updated_at: nowIso() }),
    { merge: true },
  );
  return next;
}

export async function deleteWord(uid: string, id: string): Promise<void> {
  await deleteDoc(wordRef(uid, id));
}

export type ImportInput = {
  word: string;
  meaning: string;
  example?: string;
  status?: CardStatus;
  tags?: string[];
  folder?: string;
};

export async function importWords(uid: string, rows: ImportInput[]): Promise<{
  words: Card[];
  imported: number;
  skipped: number;
  errors: Array<{ row: number; error: string }>;
  targetFolderId: string;
}> {
  const created: Card[] = [];
  const errors: Array<{ row: number; error: string }> = [];
  const folderCache = new Map<string, string>();

  for (let index = 0; index < rows.length; index += 1) {
    const entry = rows[index];
    const word = entry.word?.trim();
    const meaning = entry.meaning?.trim();
    if (!word || !meaning) {
      errors.push({ row: index + 1, error: "Word and meaning are required." });
      continue;
    }

    const folderName = (entry.folder || "").trim();
    let folderId = "";
    if (folderName) {
      const cached = folderCache.get(folderName.toLowerCase());
      if (cached) {
        folderId = cached;
      } else {
        folderId = await ensureFolderByName(uid, folderName);
        folderCache.set(folderName.toLowerCase(), folderId);
      }
    }

    created.push({
      id: createId(),
      word,
      meaning,
      example: (entry.example || "").trim(),
      status: entry.status || "new",
      tags: (entry.tags || []).slice(0, 3),
      folder: folderId,
      interval_days: 0,
      next_review_at: null,
      correct_streak: 0,
    });
  }

  await commitInChunks((queue) => {
    for (const card of created) {
      const created_at = nowIso();
      queue((batch) => {
        batch.set(
          wordRef(uid, card.id),
          cardToDoc({ ...card, created_at, updated_at: created_at }),
        );
      });
    }
  });

  const folderCounts = created.reduce<Record<string, number>>((accumulator, card) => {
    if (!card.folder) {
      return accumulator;
    }
    accumulator[card.folder] = (accumulator[card.folder] ?? 0) + 1;
    return accumulator;
  }, {});
  const ranked = Object.entries(folderCounts).sort((left, right) => right[1] - left[1]);

  return {
    words: created,
    imported: created.length,
    skipped: errors.length,
    errors,
    targetFolderId: ranked[0]?.[0] ?? "",
  };
}

function normalizeSnapshotMeta(
  id: string,
  data: DocumentData,
): SharedSnapshotMeta {
  return {
    id,
    folderName: String(data.folder_name ?? "Shared words"),
    wordCount: Number(data.word_count) || 0,
    publishedAt: String(data.published_at ?? ""),
    status: String(data.status ?? "revoked") as SharedSnapshotStatus,
  };
}

function normalizeSnapshotWord(
  id: string,
  data: DocumentData,
): SharedSnapshotWord {
  return {
    id,
    word: String(data.word ?? ""),
    meaning: String(data.meaning ?? ""),
    example: String(data.example ?? ""),
    tags: Array.isArray(data.tags)
      ? data.tags
          .filter((tag: unknown): tag is string => typeof tag === "string")
          .slice(0, 3)
      : [],
  };
}

export async function publishFolderSnapshot(
  uid: string,
  folderId: string,
): Promise<PublishSnapshotResult> {
  const [folderSnapshot, cards] = await Promise.all([
    getDoc(folderRef(uid, folderId)),
    listWords(uid),
  ]);
  if (!folderSnapshot.exists()) {
    throw new Error("Folder not found.");
  }

  const folderName = String(folderSnapshot.data().name ?? "").trim();
  const sourceCards = cards.filter((card) => card.folder === folderId);
  if (sourceCards.length === 0) {
    throw new Error("Add at least one word before sharing this folder.");
  }
  if (sourceCards.length > MAX_SHARED_SNAPSHOT_WORDS) {
    throw new Error(
      `A shared folder can contain up to ${MAX_SHARED_SNAPSHOT_WORDS} words.`,
    );
  }

  const shareId = createId();
  const publishedAt = nowIso();
  const meta = {
    owner_uid: uid,
    folder_name: folderName,
    word_count: sourceCards.length,
    published_at: publishedAt,
    schema_version: 1,
    status: "publishing",
  };
  const index = {
    source_folder_id: folderId,
    folder_name: folderName,
    word_count: sourceCards.length,
    published_at: publishedAt,
    status: "publishing",
  };

  try {
    const initialization = writeBatch(getDb());
    initialization.set(snapshotRef(shareId), meta);
    initialization.set(publishedSnapshotRef(uid, shareId), index);
    await initialization.commit();

    await commitInChunks((queue) => {
      for (const card of sourceCards) {
        const snapshotWordId = createId();
        queue((batch) => {
          batch.set(doc(getDb(), sharedSnapshotWordPath(shareId, snapshotWordId)), {
            word: card.word,
            meaning: card.meaning,
            example: card.example,
            tags: card.tags.slice(0, 3),
          });
        });
      }
    });

    const activation = writeBatch(getDb());
    activation.update(snapshotRef(shareId), { status: "active" });
    activation.update(publishedSnapshotRef(uid, shareId), { status: "active" });
    await activation.commit();
  } catch (error) {
    const cleanup = writeBatch(getDb());
    cleanup.update(snapshotRef(shareId), { status: "revoked" });
    cleanup.update(publishedSnapshotRef(uid, shareId), { status: "revoked" });
    await cleanup.commit().catch(() => undefined);
    throw error;
  }

  return { shareId, folderName, wordCount: sourceCards.length };
}

export async function getPublicSnapshot(
  shareId: string,
): Promise<SharedSnapshot> {
  const metaSnapshot = await getDoc(snapshotRef(shareId));
  if (!metaSnapshot.exists() || metaSnapshot.data().status !== "active") {
    throw new Error("This shared folder is unavailable.");
  }

  const wordsSnapshot = await getDocs(snapshotWordsRef(shareId));
  const words = wordsSnapshot.docs
    .map((entry) => normalizeSnapshotWord(entry.id, entry.data()))
    .filter((word) => word.word && word.meaning)
    .sort((a, b) => a.word.localeCompare(b.word));
  const meta = normalizeSnapshotMeta(metaSnapshot.id, metaSnapshot.data());
  if (words.length === 0 || words.length !== meta.wordCount) {
    throw new Error("This shared folder is incomplete or unavailable.");
  }

  return {
    meta,
    words,
  };
}

export async function listPublishedSnapshots(
  uid: string,
  folderId?: string,
): Promise<PublishedSnapshot[]> {
  const snapshot = await getDocs(publishedSnapshotsRef(uid));
  return snapshot.docs
    .map((entry) => {
      const data = entry.data();
      return {
        ...normalizeSnapshotMeta(entry.id, data),
        sourceFolderId: String(data.source_folder_id ?? ""),
      };
    })
    .filter((entry) => !folderId || entry.sourceFolderId === folderId)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function revokeSharedSnapshot(
  uid: string,
  shareId: string,
): Promise<void> {
  const indexSnapshot = await getDoc(publishedSnapshotRef(uid, shareId));
  if (!indexSnapshot.exists()) {
    throw new Error("Shared folder not found.");
  }
  if (indexSnapshot.data().status === "revoked") {
    return;
  }

  const batch = writeBatch(getDb());
  batch.update(snapshotRef(shareId), { status: "revoked" });
  batch.update(publishedSnapshotRef(uid, shareId), { status: "revoked" });
  await batch.commit();
}

export async function copySharedSnapshot(
  uid: string,
  shareId: string,
): Promise<CopySnapshotResult> {
  const receiptRef = importedSnapshotRef(uid, shareId);
  const existingReceipt = await getDoc(receiptRef);
  if (existingReceipt.exists()) {
    const existingFolderId = String(existingReceipt.data().folder_id ?? "");
    const existingFolder = existingFolderId
      ? await getDoc(folderRef(uid, existingFolderId))
      : null;
    if (existingFolder?.exists()) {
      return {
        folderId: existingFolderId,
        folderName: String(
          existingReceipt.data().folder_name ?? existingFolder.data().name ?? "",
        ),
        imported: 0,
        alreadyImported: true,
      };
    }
    await deleteDoc(receiptRef);
  }

  const snapshot = await getPublicSnapshot(shareId);
  const existingFolders = await listFolders(uid);
  const folderName = nextAvailableFolderName(
    snapshot.meta.folderName,
    existingFolders.map((folder) => folder.name),
  );
  const folder: Folder = { id: createId(), name: folderName };
  const stamp = nowIso();
  const batch = writeBatch(getDb());
  batch.set(folderRef(uid, folder.id), {
    name: folder.name,
    updated_at: stamp,
  });
  batch.set(receiptRef, {
    folder_id: folder.id,
    folder_name: folder.name,
    imported_at: stamp,
  });

  for (const source of snapshot.words) {
    const card: Card = {
      id: createId(),
      word: source.word.trim(),
      meaning: source.meaning.trim(),
      example: source.example.trim(),
      tags: source.tags.slice(0, 3),
      folder: folder.id,
      status: "new",
      interval_days: 0,
      next_review_at: null,
      correct_streak: 0,
    };
    batch.set(
      wordRef(uid, card.id),
      cardToDoc({ ...card, created_at: stamp, updated_at: stamp }),
    );
  }
  try {
    await batch.commit();
  } catch (error) {
    const winningReceipt = await getDoc(receiptRef);
    if (winningReceipt.exists()) {
      const winningFolderId = String(winningReceipt.data().folder_id ?? "");
      const winningFolder = winningFolderId
        ? await getDoc(folderRef(uid, winningFolderId))
        : null;
      if (winningFolder?.exists()) {
        return {
          folderId: winningFolderId,
          folderName: String(
            winningReceipt.data().folder_name ?? winningFolder.data().name ?? "",
          ),
          imported: 0,
          alreadyImported: true,
        };
      }
    }
    throw error;
  }

  return {
    folderId: folder.id,
    folderName: folder.name,
    imported: snapshot.words.length,
    alreadyImported: false,
  };
}
