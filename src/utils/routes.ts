export const LEARNING_SEGMENT = "learning";

export function folderPath(folder: string): string {
  if (!folder || folder === "all") {
    return "/";
  }

  return `/${encodeURIComponent(folder)}`;
}

export function learningPath(folder: string = "all"): string {
  if (!folder || folder === "all") {
    return `/${LEARNING_SEGMENT}`;
  }

  return `/${encodeURIComponent(folder)}/${LEARNING_SEGMENT}`;
}

export function parseLocation(pathname: string): {
  folder: string;
  isLearningMode: boolean;
} {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { folder: "all", isLearningMode: false };
  }

  if (segments.length === 1 && segments[0] === LEARNING_SEGMENT) {
    return { folder: "all", isLearningMode: true };
  }

  if (segments.length === 1) {
    return {
      folder: decodeURIComponent(segments[0]),
      isLearningMode: false,
    };
  }

  if (segments.length === 2 && segments[1] === LEARNING_SEGMENT) {
    return {
      folder: decodeURIComponent(segments[0]),
      isLearningMode: true,
    };
  }

  return {
    folder: decodeURIComponent(segments[0]),
    isLearningMode: false,
  };
}

export function isReservedFolderName(name: string): boolean {
  return name.trim().toLowerCase() === LEARNING_SEGMENT;
}
