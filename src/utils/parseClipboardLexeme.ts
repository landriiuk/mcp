/**
 * Parse clipboard text into word / meaning for Quick Add.
 * Supports: plain word, `word — meaning`, `word - meaning`, `word\tmeaning`.
 */
export type ClipboardLexeme = {
  word: string;
  meaning: string;
};

export function parseClipboardLexeme(raw: string): ClipboardLexeme | null {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) {
    return null;
  }

  // Multi-line paste: use first non-empty line only.
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return null;
  }

  const tabParts = firstLine.split("\t").map((part) => part.trim());
  if (tabParts.length >= 2 && tabParts[0] && tabParts[1]) {
    return { word: tabParts[0], meaning: tabParts.slice(1).join(" ").trim() };
  }

  const dashMatch = firstLine.match(/^(.+?)\s+[—–−-]\s+(.+)$/);
  if (dashMatch) {
    const word = dashMatch[1].trim();
    const meaning = dashMatch[2].trim();
    if (word && meaning) {
      return { word, meaning };
    }
  }

  return { word: firstLine, meaning: "" };
}
