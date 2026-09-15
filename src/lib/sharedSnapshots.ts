import { FOLDER_NAME_MAX_LENGTH } from "../constants";

export const MAX_SHARED_SNAPSHOT_WORDS = 400;

export function nextAvailableFolderName(
  requestedName: string,
  existingNames: string[],
): string {
  const base = requestedName.trim().slice(0, FOLDER_NAME_MAX_LENGTH) || "Shared words";
  const used = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) {
    return base;
  }

  for (let copyNumber = 2; copyNumber < 10_000; copyNumber += 1) {
    const suffix = ` (${copyNumber})`;
    const candidate = `${base.slice(0, FOLDER_NAME_MAX_LENGTH - suffix.length).trim()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  throw new Error("Could not create a unique folder name.");
}
