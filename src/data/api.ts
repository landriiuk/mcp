import { useMockDb } from "../lib/dataMode";
import type { Card, Draft, Folder } from "../types/card";
import type { UserRole } from "../types/access";
import type { SharedSnapshotVisibility } from "../types/sharedSnapshot";
import * as mockApi from "./mockApi";

export type { ImportInput } from "./mockApi";
import type { ImportInput } from "./mockApi";

async function firestore() {
  return import("./firestoreApi");
}

export async function listWords(uid: string) {
  if (useMockDb()) {
    return mockApi.listWords(uid);
  }
  return (await firestore()).listWords(uid);
}

export async function listFolders(uid: string) {
  if (useMockDb()) {
    return mockApi.listFolders(uid);
  }
  return (await firestore()).listFolders(uid);
}

export async function ensureFolderByName(uid: string, name: string) {
  if (useMockDb()) {
    return mockApi.ensureFolderByName(uid, name);
  }
  return (await firestore()).ensureFolderByName(uid, name);
}

export async function createFolder(uid: string, name: string) {
  if (useMockDb()) {
    return mockApi.createFolder(uid, name);
  }
  return (await firestore()).createFolder(uid, name);
}

export async function renameFolder(uid: string, folderId: string, newName: string) {
  if (useMockDb()) {
    return mockApi.renameFolder(uid, folderId, newName);
  }
  return (await firestore()).renameFolder(uid, folderId, newName);
}

export async function deleteFolderDoc(uid: string, folderId: string) {
  if (useMockDb()) {
    return mockApi.deleteFolderDoc(uid, folderId);
  }
  return (await firestore()).deleteFolderDoc(uid, folderId);
}

export async function reconcileCardFolderIds(uid: string, cards: Card[], folders: Folder[]) {
  if (useMockDb()) {
    return mockApi.reconcileCardFolderIds(uid, cards, folders);
  }
  return (await firestore()).reconcileCardFolderIds(uid, cards, folders);
}

export async function purgeLegacyGeneralFolder(uid: string) {
  if (useMockDb()) {
    return mockApi.purgeLegacyGeneralFolder(uid);
  }
  return (await firestore()).purgeLegacyGeneralFolder(uid);
}

export async function createWord(uid: string, draft: Draft & Partial<Card>) {
  if (useMockDb()) {
    return mockApi.createWord(uid, draft);
  }
  return (await firestore()).createWord(uid, draft);
}

export async function saveWord(uid: string, card: Card) {
  if (useMockDb()) {
    return mockApi.saveWord(uid, card);
  }
  return (await firestore()).saveWord(uid, card);
}

export async function deleteWord(uid: string, id: string) {
  if (useMockDb()) {
    return mockApi.deleteWord(uid, id);
  }
  return (await firestore()).deleteWord(uid, id);
}

export async function importWords(uid: string, rows: ImportInput[]) {
  if (useMockDb()) {
    return mockApi.importWords(uid, rows);
  }
  return (await firestore()).importWords(uid, rows);
}

export async function publishFolderSnapshot(
  uid: string,
  folderId: string,
  visibility: SharedSnapshotVisibility = "public",
) {
  if (useMockDb()) {
    return mockApi.publishFolderSnapshot(uid, folderId, visibility);
  }
  return (await firestore()).publishFolderSnapshot(uid, folderId, visibility);
}

export async function getPublicSnapshot(shareId: string, viewerUid?: string) {
  if (useMockDb()) {
    return mockApi.getPublicSnapshot(shareId, viewerUid);
  }
  return (await firestore()).getPublicSnapshot(shareId);
}

export async function listPublishedSnapshots(uid: string, folderId?: string) {
  if (useMockDb()) {
    return mockApi.listPublishedSnapshots(uid, folderId);
  }
  return (await firestore()).listPublishedSnapshots(uid, folderId);
}

export async function revokeSharedSnapshot(uid: string, shareId: string) {
  if (useMockDb()) {
    return mockApi.revokeSharedSnapshot(uid, shareId);
  }
  return (await firestore()).revokeSharedSnapshot(uid, shareId);
}

export async function copySharedSnapshot(uid: string, shareId: string) {
  if (useMockDb()) {
    return mockApi.copySharedSnapshot(uid, shareId);
  }
  return (await firestore()).copySharedSnapshot(uid, shareId);
}

export async function ensureUserAccess(
  uid: string,
  email: string | null,
  displayName: string | null,
) {
  if (useMockDb()) {
    return mockApi.ensureUserAccess(uid, email, displayName);
  }
  return (await firestore()).ensureUserAccess(uid, email, displayName);
}

export async function getUserProfile(uid: string) {
  if (useMockDb()) return mockApi.getUserProfile(uid);
  return (await firestore()).getUserProfile(uid);
}

export async function listUserProfiles() {
  if (useMockDb()) return mockApi.listUserProfiles();
  return (await firestore()).listUserProfiles();
}

export async function assignUserRole(
  adminUid: string,
  targetUid: string,
  role: UserRole,
) {
  if (useMockDb()) return mockApi.assignUserRole(adminUid, targetUid, role);
  return (await firestore()).assignUserRole(adminUid, targetUid, role);
}

export async function createTeacherInvite(
  teacherUid: string,
  teacherName: string,
  studentEmail: string,
) {
  if (useMockDb()) {
    return mockApi.createTeacherInvite(teacherUid, teacherName, studentEmail);
  }
  return (await firestore()).createTeacherInvite(
    teacherUid,
    teacherName,
    studentEmail,
  );
}

export async function listTeacherInvites(teacherUid: string) {
  if (useMockDb()) return mockApi.listTeacherInvites(teacherUid);
  return (await firestore()).listTeacherInvites(teacherUid);
}

export async function getTeacherInvite(inviteId: string) {
  if (useMockDb()) return mockApi.getTeacherInvite(inviteId);
  return (await firestore()).getTeacherInvite(inviteId);
}

export async function acceptTeacherInvite(
  inviteId: string,
  studentUid: string,
  studentEmail: string,
  displayName: string | null,
) {
  if (useMockDb()) {
    return mockApi.acceptTeacherInvite(
      inviteId,
      studentUid,
      studentEmail,
      displayName,
    );
  }
  return (await firestore()).acceptTeacherInvite(
    inviteId,
    studentUid,
    studentEmail,
    displayName,
  );
}

export async function listTeacherStudents(teacherUid: string) {
  if (useMockDb()) return mockApi.listTeacherStudents(teacherUid);
  return (await firestore()).listTeacherStudents(teacherUid);
}

export async function removeTeacherStudent(
  teacherUid: string,
  studentUid: string,
) {
  if (useMockDb()) return mockApi.removeTeacherStudent(teacherUid, studentUid);
  return (await firestore()).removeTeacherStudent(teacherUid, studentUid);
}

export async function revokeTeacherInvite(
  teacherUid: string,
  inviteId: string,
) {
  if (useMockDb()) return mockApi.revokeTeacherInvite(teacherUid, inviteId);
  return (await firestore()).revokeTeacherInvite(teacherUid, inviteId);
}
