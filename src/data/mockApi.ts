import type { Card, CardStatus, Draft, Folder } from "../types/card";
import { reviewFieldsForStatus } from "../utils/reviewAlgorithm";

const STORAGE_KEY = "inklex.mock.v1";

type MockState = {
  folders: Folder[];
  words: Array<Card & { created_at: string; updated_at: string }>;
};

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function emptyState(): MockState {
  return { folders: [], words: [] };
}

function readState(): MockState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState();
    }
    const parsed = JSON.parse(raw) as MockState;
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      words: Array.isArray(parsed.words) ? parsed.words : [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(state: MockState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mutate(updater: (state: MockState) => void) {
  const state = readState();
  updater(state);
  writeState(state);
  return state;
}

export async function listWords(): Promise<Card[]> {
  return readState()
    .words.map(({ created_at: _c, updated_at: _u, ...card }) => ({
      ...card,
      correct_streak: Number(card.correct_streak) || 0,
    }))
    .sort((a, b) => a.word.localeCompare(b.word));
}

export async function listFolders(): Promise<Folder[]> {
  return [...readState().folders].sort((a, b) => a.name.localeCompare(b.name));
}

export async function ensureFolderByName(name: string): Promise<string> {
  const normalized = name.trim();
  if (!normalized) {
    return "";
  }

  const existing = await listFolders();
  const match = existing.find(
    (folder) => folder.name.toLowerCase() === normalized.toLowerCase(),
  );
  if (match) {
    return match.id;
  }

  const id = createId();
  mutate((state) => {
    state.folders.push({ id, name: normalized });
  });
  return id;
}

export async function createFolder(name: string): Promise<Folder> {
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

  const existing = await listFolders();
  if (existing.some((folder) => folder.name.toLowerCase() === normalized.toLowerCase())) {
    throw new Error("Folder already exists.");
  }

  const folder = { id: createId(), name: normalized };
  mutate((state) => {
    state.folders.push(folder);
  });
  return folder;
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  const normalized = newName.trim();
  if (!normalized) {
    throw new Error("Folder name is required.");
  }
  if (!folderId.trim()) {
    throw new Error("Folder id is required.");
  }

  const existing = await listFolders();
  if (
    existing.some(
      (folder) =>
        folder.id !== folderId && folder.name.toLowerCase() === normalized.toLowerCase(),
    )
  ) {
    throw new Error("Folder already exists.");
  }

  let found = false;
  mutate((state) => {
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

export async function deleteFolderDoc(folderId: string): Promise<void> {
  const normalized = folderId.trim();
  if (!normalized) {
    throw new Error("Folder id is required.");
  }

  mutate((state) => {
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
    mutate((state) => {
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

export async function purgeLegacyGeneralFolder(): Promise<{
  folders: Folder[];
  cards: Card[];
  removed: boolean;
}> {
  const folders = await listFolders();
  const cards = await listWords();
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

  mutate((state) => {
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
    folders: (await listFolders()).filter((folder) => !generalIds.has(folder.id)),
    cards: (await listWords()).map((card) => {
      const ref = card.folder.trim();
      if (ref === "General" || generalIds.has(ref) || ref.toLowerCase() === "general") {
        return { ...card, folder: "" };
      }
      return card;
    }),
    removed: true,
  };
}

export async function createWord(draft: Draft & Partial<Card>): Promise<Card> {
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

  mutate((state) => {
    state.words.unshift({ ...card, created_at, updated_at: created_at });
  });
  return card;
}

export async function saveWord(card: Card): Promise<Card> {
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

  mutate((state) => {
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

export async function deleteWord(id: string): Promise<void> {
  mutate((state) => {
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

export async function importWords(rows: ImportInput[]): Promise<{
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
        folderId = await ensureFolderByName(folderName);
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

  mutate((state) => {
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

/** Wipe local mock DB (browser only). */
export function clearMockDatabase() {
  window.localStorage.removeItem(STORAGE_KEY);
}
