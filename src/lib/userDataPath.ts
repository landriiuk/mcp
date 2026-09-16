export function requireUid(uid: string): string {
  const normalized = uid.trim();
  if (!normalized || normalized.includes("/")) {
    throw new Error("A valid user id is required.");
  }
  return normalized;
}

export function requireShareId(shareId: string): string {
  const normalized = shareId.trim();
  if (!normalized || normalized.length > 128 || normalized.includes("/")) {
    throw new Error("A valid share id is required.");
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

export function sharedSnapshotPath(shareId: string): string {
  return `sharedSnapshots/${requireShareId(shareId)}`;
}

export function sharedSnapshotWordsPath(shareId: string): string {
  return `${sharedSnapshotPath(shareId)}/words`;
}

export function sharedSnapshotWordPath(shareId: string, wordId: string): string {
  return `${sharedSnapshotWordsPath(shareId)}/${wordId}`;
}

export function userPublishedSnapshotsPath(uid: string): string {
  return `users/${requireUid(uid)}/publishedSnapshots`;
}

export function userPublishedSnapshotPath(uid: string, shareId: string): string {
  return `${userPublishedSnapshotsPath(uid)}/${requireShareId(shareId)}`;
}

export function userImportedSnapshotsPath(uid: string): string {
  return `users/${requireUid(uid)}/importedSnapshots`;
}

export function userImportedSnapshotPath(uid: string, shareId: string): string {
  return `${userImportedSnapshotsPath(uid)}/${requireShareId(shareId)}`;
}

export function userPracticeStatsPath(uid: string): string {
  return `users/${requireUid(uid)}/stats/practice`;
}

export function rolePath(uid: string): string {
  return `roles/${requireUid(uid)}`;
}

export function userProfilePath(uid: string): string {
  return `userProfiles/${requireUid(uid)}`;
}

export function userProfilesPath(): string {
  return "userProfiles";
}

export function rolesPath(): string {
  return "roles";
}

export function teacherInvitePath(inviteId: string): string {
  return `teacherInvites/${requireShareId(inviteId)}`;
}

export function teacherInvitesPath(): string {
  return "teacherInvites";
}

export function teacherStudentsPath(teacherUid: string): string {
  return `teachers/${requireUid(teacherUid)}/students`;
}

export function teacherStudentPath(
  teacherUid: string,
  studentUid: string,
): string {
  return `${teacherStudentsPath(teacherUid)}/${requireUid(studentUid)}`;
}
