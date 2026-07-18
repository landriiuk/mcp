export type Pronunciation = {
  word: string;
  phonetic: string;
  audioUrl: string;
};

type DictionaryPhonetic = {
  text?: string;
  audio?: string;
};

type DictionaryEntry = {
  word?: string;
  phonetic?: string;
  phonetics?: DictionaryPhonetic[];
};

const cache = new Map<string, Pronunciation | null>();
const inflight = new Map<string, Promise<Pronunciation | null>>();

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function pickPronunciation(word: string, entries: DictionaryEntry[]): Pronunciation | null {
  for (const entry of entries) {
    const phonetics = entry.phonetics ?? [];
    const audioUrl =
      phonetics.find((item) => typeof item.audio === "string" && item.audio.trim())?.audio?.trim() ??
      "";
    const phonetic =
      (typeof entry.phonetic === "string" && entry.phonetic.trim()) ||
      phonetics.find((item) => typeof item.text === "string" && item.text.trim())?.text?.trim() ||
      "";

    if (audioUrl || phonetic) {
      return {
        word: entry.word?.trim() || word,
        phonetic,
        audioUrl,
      };
    }
  }

  return null;
}

/** Fetch IPA + optional audio URL from Free Dictionary API (cached). */
export async function fetchPronunciation(word: string): Promise<Pronunciation | null> {
  const key = normalizeWord(word);
  if (!key) {
    return null;
  }

  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const response = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`,
      );

      if (response.status === 404) {
        cache.set(key, null);
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as DictionaryEntry[];
      if (!Array.isArray(data) || data.length === 0) {
        cache.set(key, null);
        return null;
      }

      const result = pickPronunciation(key, data);
      cache.set(key, result);
      return result;
    } catch {
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

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

async function playAudioUrl(audioUrl: string): Promise<boolean> {
  try {
    const audio = new Audio(audioUrl);
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Prefer dictionary mp3; fall back to Web Speech API.
 * Returns phonetic text when available (may be empty).
 */
export async function pronounceWord(word: string): Promise<{ phonetic: string }> {
  const trimmed = word.trim();
  if (!trimmed) {
    return { phonetic: "" };
  }

  const info = await fetchPronunciation(trimmed);

  if (info?.audioUrl) {
    const played = await playAudioUrl(info.audioUrl);
    if (played) {
      return { phonetic: info.phonetic };
    }
  }

  speakWithBrowser(trimmed);
  return { phonetic: info?.phonetic ?? "" };
}
