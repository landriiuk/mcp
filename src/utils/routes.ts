export const LEARNING_SEGMENT = "learning";

/** Encode folder id for URL/UI (base64url). */
export function encodeFolderId(folderId: string): string {
  const bytes = new TextEncoder().encode(folderId);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Decode folder id from URL segment. Returns null if invalid. */
export function decodeFolderId(encoded: string): string | null {
  try {
    const normalized = decodeURIComponent(encoded).replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const binary = atob(normalized + pad);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const id = new TextDecoder().decode(bytes).trim();
    return id || null;
  } catch {
    return null;
  }
}

export function folderPath(folderId: string): string {
  if (!folderId || folderId === "all") {
    return "/";
  }

  return `/${encodeFolderId(folderId)}`;
}

export function learningPath(folderId: string = "all"): string {
  if (!folderId || folderId === "all") {
    return `/${LEARNING_SEGMENT}`;
  }

  return `/${encodeFolderId(folderId)}/${LEARNING_SEGMENT}`;
}

export function parseLocation(pathname: string): {
  folderId: string;
  isLearningMode: boolean;
  invalidFolderRef: boolean;
} {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { folderId: "all", isLearningMode: false, invalidFolderRef: false };
  }

  if (segments.length === 1 && segments[0] === LEARNING_SEGMENT) {
    return { folderId: "all", isLearningMode: true, invalidFolderRef: false };
  }

  if (segments.length === 1) {
    const folderId = decodeFolderId(segments[0]);
    if (!folderId || folderId === LEARNING_SEGMENT) {
      return { folderId: "all", isLearningMode: false, invalidFolderRef: true };
    }
    return { folderId, isLearningMode: false, invalidFolderRef: false };
  }

  if (segments.length === 2 && segments[1] === LEARNING_SEGMENT) {
    const folderId = decodeFolderId(segments[0]);
    if (!folderId || folderId === LEARNING_SEGMENT) {
      return { folderId: "all", isLearningMode: true, invalidFolderRef: true };
    }
    return { folderId, isLearningMode: true, invalidFolderRef: false };
  }

  const folderId = decodeFolderId(segments[0]);
  if (!folderId) {
    return { folderId: "all", isLearningMode: false, invalidFolderRef: true };
  }
  return { folderId, isLearningMode: false, invalidFolderRef: false };
}

export function isReservedFolderName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === LEARNING_SEGMENT || normalized === "general";
}
