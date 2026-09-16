import type { Card, CardStatus, Draft, Folder } from "../types/card";
import type {
  TeacherInvite,
  TeacherStudent,
  UserProfile,
  UserRole,
} from "../types/access";
import {
  MAX_SHARED_SNAPSHOT_WORDS,
  nextAvailableFolderName,
} from "../lib/sharedSnapshots";
import type {
  CopySnapshotResult,
  PublishedSnapshot,
  PublishSnapshotResult,
  SharedSnapshot,
  SharedSnapshotVisibility,
  SharedSnapshotWord,
} from "../types/sharedSnapshot";
import { emptyPracticeStats, type PracticeStats } from "../types/practiceStats";
import { reviewFieldsForStatus } from "../utils/reviewAlgorithm";

const LEGACY_STORAGE_KEY = "inklex.mock.v1";
const SHARED_STORAGE_KEY = "inklex.sharedSnapshots.v1";
const ACCESS_STORAGE_KEY = "inklex.access.v1";

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
  practiceStats: PracticeStats;
};

type StoredSharedSnapshot = {
  id: string;
  ownerUid: string;
  sourceFolderId: string;
  folderName: string;
  publishedAt: string;
  status: "publishing" | "active" | "revoked";
  visibility: SharedSnapshotVisibility;
  words: SharedSnapshotWord[];
};

type MockAccessState = {
  profiles: UserProfile[];
  invites: TeacherInvite[];
  studentsByTeacher: Record<string, TeacherStudent[]>;
};

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return crypto.randomUUID();
}

function emptyState(): MockState {
  return {
    folders: [],
    words: [],
    importedSnapshots: [],
    practiceStats: emptyPracticeStats(),
  };
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
      practiceStats: normalizePracticeStats(parsed.practiceStats),
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

function normalizePracticeStats(value: unknown): PracticeStats {
  if (!value || typeof value !== "object") {
    return emptyPracticeStats();
  }
  const data = value as Partial<PracticeStats>;
  const count = Number(data.questCompletedCount);
  return {
    questCompletedCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
    lastQuestCompletedAt:
      typeof data.lastQuestCompletedAt === "string" ? data.lastQuestCompletedAt : null,
  };
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

function readAccessState(): MockAccessState {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(ACCESS_STORAGE_KEY) ?? "{}",
    ) as Partial<MockAccessState>;
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      invites: Array.isArray(parsed.invites) ? parsed.invites : [],
      studentsByTeacher:
        parsed.studentsByTeacher &&
        typeof parsed.studentsByTeacher === "object"
          ? parsed.studentsByTeacher
          : {},
    };
  } catch {
    return { profiles: [], invites: [], studentsByTeacher: {} };
  }
}

function writeAccessState(state: MockAccessState) {
  window.localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(state));
}

function mutateAccess(updater: (state: MockAccessState) => void) {
  const state = readAccessState();
  updater(state);
  writeAccessState(state);
  return state;
}

export async function ensureUserAccess(
  uid: string,
  email: string | null,
  displayName: string | null,
): Promise<UserProfile> {
  const state = readAccessState();
  const existing = state.profiles.find((profile) => profile.uid === uid);
  const stamp = nowIso();
  const profile: UserProfile = {
    uid,
    email: (email ?? "").trim().toLowerCase(),
    displayName: displayName?.trim() || null,
    role: existing?.role ?? (uid === "local-dev" ? "admin" : "student"),
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
  mutateAccess((current) => {
    current.profiles = current.profiles.filter((entry) => entry.uid !== uid);
    current.profiles.push(profile);
  });
  return profile;
}

export async function getPracticeStats(uid: string): Promise<PracticeStats> {
  return normalizePracticeStats(readState(uid).practiceStats);
}

export async function recordQuestCompletion(uid: string): Promise<PracticeStats> {
  const stamp = nowIso();
  const state = mutate(uid, (current) => {
    const currentCount = normalizePracticeStats(current.practiceStats).questCompletedCount;
    current.practiceStats = {
      questCompletedCount: currentCount + 1,
      lastQuestCompletedAt: stamp,
    };
  });
  return normalizePracticeStats(state.practiceStats);
}

export async function getUserProfile(uid: string): Promise<UserProfile> {
  const profile = readAccessState().profiles.find((entry) => entry.uid === uid);
  if (!profile) {
    throw new Error("User profile not found.");
  }
  return profile;
}

export async function listUserProfiles(): Promise<UserProfile[]> {
  return [...readAccessState().profiles].sort((a, b) =>
    a.email.localeCompare(b.email),
  );
}

export async function assignUserRole(
  adminUid: string,
  targetUid: string,
  role: UserRole,
): Promise<void> {
  const state = readAccessState();
  const admin = state.profiles.find((profile) => profile.uid === adminUid);
  if (admin?.role !== "admin") {
    throw new Error("Admin access required.");
  }
  if (adminUid === targetUid) {
    throw new Error("You cannot change your own admin role.");
  }
  const target = state.profiles.find((profile) => profile.uid === targetUid);
  if (!target) {
    throw new Error("User profile not found.");
  }
  mutateAccess((current) => {
    const profile = current.profiles.find((entry) => entry.uid === targetUid);
    if (profile) {
      profile.role = role;
      profile.updatedAt = nowIso();
    }
  });
}

export async function createTeacherInvite(
  teacherUid: string,
  teacherName: string,
  studentEmail: string,
): Promise<TeacherInvite> {
  const state = readAccessState();
  const teacher = state.profiles.find((profile) => profile.uid === teacherUid);
  if (teacher?.role !== "teacher" && teacher?.role !== "admin") {
    throw new Error("Teacher access required.");
  }
  const emailLower = studentEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLower)) {
    throw new Error("Enter a valid student email.");
  }
  const existing = state.invites.find(
    (invite) =>
      invite.teacherUid === teacherUid &&
      invite.studentEmail === emailLower &&
      invite.status === "pending" &&
      invite.expiresAt > nowIso(),
  );
  if (existing) {
    return existing;
  }
  const invite: TeacherInvite = {
    id: createId(),
    teacherUid,
    teacherName: teacherName.trim() || "InkLex teacher",
    studentEmail: emailLower,
    status: "pending",
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedByUid: null,
  };
  mutateAccess((current) => current.invites.unshift(invite));
  return invite;
}

export async function listTeacherInvites(
  teacherUid: string,
): Promise<TeacherInvite[]> {
  return readAccessState().invites
    .filter((invite) => invite.teacherUid === teacherUid)
    .map((invite) =>
      invite.status === "pending" && invite.expiresAt < nowIso()
        ? { ...invite, status: "expired" as const }
        : invite,
    );
}

export async function getTeacherInvite(
  inviteId: string,
): Promise<TeacherInvite> {
  const invite = readAccessState().invites.find((entry) => entry.id === inviteId);
  if (!invite) {
    throw new Error("Invitation not found.");
  }
  return invite.status === "pending" && invite.expiresAt < nowIso()
    ? { ...invite, status: "expired" }
    : invite;
}

export async function acceptTeacherInvite(
  inviteId: string,
  studentUid: string,
  studentEmail: string,
  displayName: string | null,
): Promise<string> {
  const invite = await getTeacherInvite(inviteId);
  if (invite.status !== "pending") {
    throw new Error("This invitation is no longer active.");
  }
  if (invite.studentEmail !== studentEmail.trim().toLowerCase()) {
    throw new Error(`Sign in as ${invite.studentEmail} to accept this invitation.`);
  }
  mutateAccess((state) => {
    const storedInvite = state.invites.find((entry) => entry.id === inviteId);
    if (storedInvite) {
      storedInvite.status = "accepted";
      storedInvite.acceptedByUid = studentUid;
    }
    const students = state.studentsByTeacher[invite.teacherUid] ?? [];
    if (!students.some((student) => student.uid === studentUid)) {
      students.push({
        uid: studentUid,
        email: invite.studentEmail,
        displayName: displayName?.trim() || null,
        acceptedAt: nowIso(),
      });
    }
    state.studentsByTeacher[invite.teacherUid] = students;
  });
  return invite.teacherUid;
}

export async function listTeacherStudents(
  teacherUid: string,
): Promise<TeacherStudent[]> {
  return [...(readAccessState().studentsByTeacher[teacherUid] ?? [])].sort(
    (a, b) => a.email.localeCompare(b.email),
  );
}

export async function removeTeacherStudent(
  teacherUid: string,
  studentUid: string,
): Promise<void> {
  mutateAccess((state) => {
    state.studentsByTeacher[teacherUid] = (
      state.studentsByTeacher[teacherUid] ?? []
    ).filter((student) => student.uid !== studentUid);
  });
}

export async function revokeTeacherInvite(
  teacherUid: string,
  inviteId: string,
): Promise<void> {
  mutateAccess((state) => {
    const invite = state.invites.find(
      (entry) => entry.id === inviteId && entry.teacherUid === teacherUid,
    );
    if (invite?.status === "pending") invite.status = "revoked";
  });
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
  visibility: SharedSnapshotVisibility = "public",
): Promise<PublishSnapshotResult> {
  if (visibility === "students") {
    const profile = await getUserProfile(uid);
    if (profile.role !== "teacher" && profile.role !== "admin") {
      throw new Error("Only teachers can share with their students.");
    }
  }
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
    visibility,
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
    visibility,
  };
}

export async function getPublicSnapshot(
  shareId: string,
  viewerUid?: string,
): Promise<SharedSnapshot> {
  const snapshot = readSharedSnapshots().find(
    (entry) => entry.id === shareId && entry.status === "active",
  );
  if (!snapshot) {
    throw new Error("This shared folder is unavailable.");
  }
  const visibility = snapshot.visibility ?? "public";
  if (visibility === "students" && viewerUid !== snapshot.ownerUid) {
    const students =
      readAccessState().studentsByTeacher[snapshot.ownerUid] ?? [];
    if (!viewerUid || !students.some((student) => student.uid === viewerUid)) {
      throw new Error("This link is available only to this teacher's students.");
    }
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
      visibility,
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
      visibility: snapshot.visibility ?? "public",
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

  const snapshot = await getPublicSnapshot(shareId, uid);
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
  window.localStorage.removeItem(ACCESS_STORAGE_KEY);
}
