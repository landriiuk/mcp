import { useMockDb } from "../lib/dataMode";
import type { Card, Draft, Folder } from "../types/card";
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
