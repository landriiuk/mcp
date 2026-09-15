import type { Card, CardStatus, Draft, Folder } from "../types/card";
import {
  MAX_SHARED_SNAPSHOT_WORDS,
  nextAvailableFolderName,
} from "../lib/sharedSnapshots";
import type {
  CopySnapshotResult,
  PublishedSnapshot,
  PublishSnapshotResult,
  SharedSnapshot,
  SharedSnapshotWord,
} from "../types/sharedSnapshot";
import { reviewFieldsForStatus } from "../utils/reviewAlgorithm";

const LEGACY_STORAGE_KEY = "inklex.mock.v1";
const SHARED_STORAGE_KEY = "inklex.sharedSnapshots.v1";

function storageKey(uid: string) {
  return `${LEGACY_STORAGE_KEY}.${uid}`;
}

type MockState = {
  folders: Folder[];
  words: Array<Card & { created_at: string; updated_at: string }>;
  importedSnapshots: Array<{
    shareId: string;
    folderId: string;
    folderName: string;
    importedAt: string;
  }>;
};

type StoredSharedSnapshot = {
  id: string;
  ownerUid: string;
  sourceFolderId: string;
  folderName: string;
  publishedAt: string;
  status: "publishing" | "active" | "revoked";
  words: SharedSnapshotWord[];
};

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function emptyState(): MockState {
  return { folders: [], words: [], importedSnapshots: [] };
}

function readState(uid: string): MockState {
  try {
    const key = storageKey(uid);
    const raw =
      window.localStorage.getItem(key) ??
      (uid === "local-dev" ? window.localStorage.getItem(LEGACY_STORAGE_KEY) : null);
    if (!raw) {
      return emptyState();
    }
    const parsed = JSON.parse(raw) as MockState;
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      words: Array.isArray(parsed.words) ? parsed.words : [],
      importedSnapshots: Array.isArray(parsed.importedSnapshots)
        ? parsed.importedSnapshots
        : [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(uid: string, state: MockState) {
  window.localStorage.setItem(storageKey(uid), JSON.stringify(state));
  if (uid === "local-dev") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}

function mutate(uid: string, updater: (state: MockState) => void) {
  const state = readState(uid);
  updater(state);
  writeState(uid, state);
  return state;
}

function readSharedSnapshots(): StoredSharedSnapshot[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(SHARED_STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSharedSnapshots(snapshots: StoredSharedSnapshot[]) {
  window.localStorage.setItem(SHARED_STORAGE_KEY, JSON.stringify(snapshots));
}

export async function listWords(uid: string): Promise<Card[]> {
  return readState(uid)
    .words.map(({ created_at: _c, updated_at: _u, ...card }) => ({
      ...card,
      correct_streak: Number(card.correct_streak) || 0,
    }))
    .sort((a, b) => a.word.localeCompare(b.word));
}

export async function listFolders(uid: string): Promise<Folder[]> {
  return [...readState(uid).folders].sort((a, b) => a.name.localeCompare(b.name));
}

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
  mutate(uid, (state) => {
    state.folders.push({ id, name: normalized });
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

  const folder = { id: createId(), name: normalized };
  mutate(uid, (state) => {
    state.folders.push(folder);
  });
  return folder;
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

  let found = false;
  mutate(uid, (state) => {
    const folder = state.folders.find((entry) => entry.id === folderId);
    if (!folder) {
      return;
    }
    found = true;
    folder.name = normalized;
  });

  if (!found) {
    throw new Error("Folder not found.");
  }
}

export async function deleteFolderDoc(uid: string, folderId: string): Promise<void> {
  const normalized = folderId.trim();
  if (!normalized) {
    throw new Error("Folder id is required.");
  }

  mutate(uid, (state) => {
    const folder = state.folders.find((entry) => entry.id === normalized);
    const legacyName = folder?.name ?? normalized;
    state.folders = state.folders.filter((entry) => entry.id !== normalized);
    for (const word of state.words) {
      if (word.folder === normalized || word.folder === legacyName) {
        word.folder = "";
        word.updated_at = nowIso();
      }
    }
  });
}

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
    mutate(uid, (state) => {
      for (const update of updates) {
        const word = state.words.find((entry) => entry.id === update.id);
        if (word) {
          word.folder = update.folderId;
          word.updated_at = nowIso();
        }
      }
    });
  }

  return nextCards;
}

export async function purgeLegacyGeneralFolder(uid: string): Promise<{
  folders: Folder[];
  cards: Card[];
  removed: boolean;
}> {
  const folders = await listFolders(uid);
  const cards = await listWords(uid);
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

  mutate(uid, (state) => {
    state.folders = state.folders.filter((folder) => !generalIds.has(folder.id));
    for (const word of state.words) {
      const ref = word.folder.trim();
      if (ref === "General" || generalIds.has(ref) || ref.toLowerCase() === "general") {
        word.folder = "";
        word.updated_at = nowIso();
      }
    }
  });

  return {
    folders: (await listFolders(uid)).filter((folder) => !generalIds.has(folder.id)),
    cards: (await listWords(uid)).map((card) => {
      const ref = card.folder.trim();
      if (ref === "General" || generalIds.has(ref) || ref.toLowerCase() === "general") {
        return { ...card, folder: "" };
      }
      return card;
    }),
    removed: true,
  };
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

  mutate(uid, (state) => {
    state.words.unshift({ ...card, created_at, updated_at: created_at });
  });
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

  mutate(uid, (state) => {
    const index = state.words.findIndex((entry) => entry.id === card.id);
    const created_at = index >= 0 ? state.words[index].created_at : nowIso();
    const stored = { ...next, created_at, updated_at: nowIso() };
    if (index >= 0) {
      state.words[index] = stored;
    } else {
      state.words.unshift(stored);
    }
  });

  return next;
}

export async function deleteWord(uid: string, id: string): Promise<void> {
  mutate(uid, (state) => {
    state.words = state.words.filter((entry) => entry.id !== id);
  });
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

  mutate(uid, (state) => {
    const stamp = nowIso();
    for (const card of created) {
      state.words.unshift({ ...card, created_at: stamp, updated_at: stamp });
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

export async function publishFolderSnapshot(
  uid: string,
  folderId: string,
): Promise<PublishSnapshotResult> {
  const state = readState(uid);
  const folder = state.folders.find((entry) => entry.id === folderId);
  if (!folder) {
    throw new Error("Folder not found.");
  }

  const sourceWords = state.words.filter((word) => word.folder === folderId);
  if (sourceWords.length === 0) {
    throw new Error("Add at least one word before sharing this folder.");
  }
  if (sourceWords.length > MAX_SHARED_SNAPSHOT_WORDS) {
    throw new Error(
      `A shared folder can contain up to ${MAX_SHARED_SNAPSHOT_WORDS} words.`,
    );
  }

  const shareId = createId();
  const snapshot: StoredSharedSnapshot = {
    id: shareId,
    ownerUid: uid,
    sourceFolderId: folderId,
    folderName: folder.name,
    publishedAt: nowIso(),
    status: "active",
    words: sourceWords.map((word) => ({
      id: createId(),
      word: word.word,
      meaning: word.meaning,
      example: word.example,
      tags: word.tags.slice(0, 3),
    })),
  };
  writeSharedSnapshots([snapshot, ...readSharedSnapshots()]);
  return {
    shareId,
    folderName: folder.name,
    wordCount: sourceWords.length,
  };
}

export async function getPublicSnapshot(
  shareId: string,
): Promise<SharedSnapshot> {
  const snapshot = readSharedSnapshots().find(
    (entry) => entry.id === shareId && entry.status === "active",
  );
  if (!snapshot) {
    throw new Error("This shared folder is unavailable.");
  }
  const sourceWordCount = Array.isArray(snapshot.words) ? snapshot.words.length : 0;
  const words = Array.isArray(snapshot.words)
    ? snapshot.words.filter(
        (word) =>
          typeof word?.word === "string" &&
          word.word.trim() &&
          typeof word?.meaning === "string" &&
          word.meaning.trim(),
      )
    : [];
  if (words.length === 0 || words.length !== sourceWordCount) {
    throw new Error("This shared folder is incomplete or unavailable.");
  }
  return {
    meta: {
      id: snapshot.id,
      folderName: snapshot.folderName,
      wordCount: snapshot.words.length,
      publishedAt: snapshot.publishedAt,
      status: snapshot.status,
    },
    words: [...words].sort((a, b) => a.word.localeCompare(b.word)),
  };
}

export async function listPublishedSnapshots(
  uid: string,
  folderId?: string,
): Promise<PublishedSnapshot[]> {
  return readSharedSnapshots()
    .filter(
      (snapshot) =>
        snapshot.ownerUid === uid &&
        (!folderId || snapshot.sourceFolderId === folderId),
    )
    .map((snapshot) => ({
      id: snapshot.id,
      sourceFolderId: snapshot.sourceFolderId,
      folderName: snapshot.folderName,
      wordCount: snapshot.words.length,
      publishedAt: snapshot.publishedAt,
      status: snapshot.status,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function revokeSharedSnapshot(
  uid: string,
  shareId: string,
): Promise<void> {
  const snapshots = readSharedSnapshots();
  const snapshot = snapshots.find((entry) => entry.id === shareId);
  if (!snapshot || snapshot.ownerUid !== uid) {
    throw new Error("Shared folder not found.");
  }
  snapshot.status = "revoked";
  writeSharedSnapshots(snapshots);
}

export async function copySharedSnapshot(
  uid: string,
  shareId: string,
): Promise<CopySnapshotResult> {
  const currentState = readState(uid);
  const receipt = currentState.importedSnapshots.find(
    (entry) => entry.shareId === shareId,
  );
  if (receipt) {
    const existingFolder = currentState.folders.find(
      (folder) => folder.id === receipt.folderId,
    );
    if (existingFolder) {
      return {
        folderId: existingFolder.id,
        folderName: existingFolder.name,
        imported: 0,
        alreadyImported: true,
      };
    }
  }

  const snapshot = await getPublicSnapshot(shareId);
  const existing = currentState.folders;
  const folderName = nextAvailableFolderName(
    snapshot.meta.folderName,
    existing.map((folder) => folder.name),
  );
  const folder: Folder = { id: createId(), name: folderName };
  const stamp = nowIso();

  mutate(uid, (state) => {
    state.importedSnapshots = state.importedSnapshots.filter(
      (entry) => entry.shareId !== shareId,
    );
    state.folders.push(folder);
    state.importedSnapshots.push({
      shareId,
      folderId: folder.id,
      folderName: folder.name,
      importedAt: stamp,
    });
    for (const source of snapshot.words) {
      state.words.unshift({
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
        created_at: stamp,
        updated_at: stamp,
      });
    }
  });

  return {
    folderId: folder.id,
    folderName: folder.name,
    imported: snapshot.words.length,
    alreadyImported: false,
  };
}

/** Wipe local mock DB (browser only). */
export function clearMockDatabase(uid = "local-dev") {
  window.localStorage.removeItem(storageKey(uid));
  if (uid === "local-dev") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  window.localStorage.removeItem(SHARED_STORAGE_KEY);
}
