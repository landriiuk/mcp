export function requireUid(uid: string): string {
  const normalized = uid.trim();
  if (!normalized || normalized.includes("/")) {
    throw new Error("A valid user id is required.");
  }
  return normalized;
}

export function userWordsPath(uid: string): string {
  return `users/${requireUid(uid)}/words`;
}

export function userFoldersPath(uid: string): string {
  return `users/${requireUid(uid)}/folders`;
}

export function userWordPath(uid: string, id: string): string {
  return `${userWordsPath(uid)}/${id}`;
}

export function userFolderPath(uid: string, id: string): string {
  return `${userFoldersPath(uid)}/${id}`;
}
