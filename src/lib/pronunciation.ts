function speakWithBrowser(word: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

/** Pronounce an English word using the browser's speech synthesis engine. */
export async function pronounceWord(word: string): Promise<{ phonetic: string }> {
  const trimmed = word.trim();
  if (!trimmed) {
    return { phonetic: "" };
  }

  speakWithBrowser(trimmed);
  return { phonetic: "" };
}
