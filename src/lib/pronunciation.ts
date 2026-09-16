let currentAudio: HTMLAudioElement | null = null;
let currentUtterance: SpeechSynthesisUtterance | null = null;

function pickEnglishVoice(voices: SpeechSynthesisVoice[]) {
  const preferred = [
    "Google US English",
    "Samantha",
    "Alex",
    "Karen",
    "Daniel",
    "Moira",
  ];

  for (const name of preferred) {
    const match = voices.find((voice) => voice.name === name);
    if (match) {
      return match;
    }
  }

  return (
    voices.find((voice) => voice.lang === "en-US") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en"))
  );
}

function speakWithBrowser(word: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  const synth = window.speechSynthesis;
  synth.cancel();

  currentUtterance = new SpeechSynthesisUtterance(word);
  currentUtterance.lang = "en-US";
  currentUtterance.rate = 0.9;
  currentUtterance.volume = 1;

  const voice = pickEnglishVoice(synth.getVoices());
  if (voice) {
    currentUtterance.voice = voice;
    currentUtterance.lang = voice.lang;
  }

  synth.speak(currentUtterance);
  synth.resume();
}

function stopCurrentAudio() {
  if (!currentAudio) {
    return;
  }

  currentAudio.pause();
  currentAudio.removeAttribute("src");
  currentAudio.load();
  currentAudio.remove();
  currentAudio = null;
}

function playSameOriginAudio(word: string): Promise<void> {
  stopCurrentAudio();

  const audio = document.createElement("audio");
  audio.preload = "auto";
  audio.src = `/inklex-pronounce?word=${encodeURIComponent(word)}`;
  currentAudio = audio;
  document.body.appendChild(audio);

  return audio
    .play()
    .then(
      () =>
        new Promise<void>((resolve) => {
          audio.addEventListener(
            "ended",
            () => {
              audio.remove();
              if (currentAudio === audio) {
                currentAudio = null;
              }
              resolve();
            },
            { once: true },
          );
          audio.addEventListener(
            "error",
            () => {
              audio.remove();
              if (currentAudio === audio) {
                currentAudio = null;
              }
              speakWithBrowser(word);
              resolve();
            },
            { once: true },
          );
        }),
    )
    .catch(() => {
      audio.remove();
      if (currentAudio === audio) {
        currentAudio = null;
      }
      speakWithBrowser(word);
    });
}

/** Play pronunciation through the local/prod audio proxy. */
export function pronounceWord(word: string): Promise<void> {
  const trimmed = word.trim();
  if (!trimmed) {
    return Promise.resolve();
  }

  return playSameOriginAudio(trimmed);
}
