import { useMockDb } from "../lib/dataMode";
import type { Card, Draft, Folder } from "../types/card";
import * as mockApi from "./mockApi";

export type { ImportInput } from "./mockApi";
import type { ImportInput } from "./mockApi";

async function firestore() {
  return import("./firestoreApi");
}

export async function listWords() {
  if (useMockDb()) {
    return mockApi.listWords();
  }
  return (await firestore()).listWords();
}

export async function listFolders() {
  if (useMockDb()) {
    return mockApi.listFolders();
  }
  return (await firestore()).listFolders();
}

export async function ensureFolderByName(name: string) {
  if (useMockDb()) {
    return mockApi.ensureFolderByName(name);
  }
  return (await firestore()).ensureFolderByName(name);
}

export async function createFolder(name: string) {
  if (useMockDb()) {
    return mockApi.createFolder(name);
  }
  return (await firestore()).createFolder(name);
}

export async function renameFolder(folderId: string, newName: string) {
  if (useMockDb()) {
    return mockApi.renameFolder(folderId, newName);
  }
  return (await firestore()).renameFolder(folderId, newName);
}

export async function deleteFolderDoc(folderId: string) {
  if (useMockDb()) {
    return mockApi.deleteFolderDoc(folderId);
  }
  return (await firestore()).deleteFolderDoc(folderId);
}

export async function reconcileCardFolderIds(cards: Card[], folders: Folder[]) {
  if (useMockDb()) {
    return mockApi.reconcileCardFolderIds(cards, folders);
  }
  return (await firestore()).reconcileCardFolderIds(cards, folders);
}

export async function purgeLegacyGeneralFolder() {
  if (useMockDb()) {
    return mockApi.purgeLegacyGeneralFolder();
  }
  return (await firestore()).purgeLegacyGeneralFolder();
}

export async function createWord(draft: Draft & Partial<Card>) {
  if (useMockDb()) {
    return mockApi.createWord(draft);
  }
  return (await firestore()).createWord(draft);
}

export async function saveWord(card: Card) {
  if (useMockDb()) {
    return mockApi.saveWord(card);
  }
  return (await firestore()).saveWord(card);
}

export async function deleteWord(id: string) {
  if (useMockDb()) {
    return mockApi.deleteWord(id);
  }
  return (await firestore()).deleteWord(id);
}

export async function importWords(rows: ImportInput[]) {
  if (useMockDb()) {
    return mockApi.importWords(rows);
  }
  return (await firestore()).importWords(rows);
}
