import { useState, type MouseEvent } from "react";
import { pronounceWord } from "../../lib/pronunciation";

type PronounceButtonProps = {
  word: string;
  className?: string;
  /** Icon-only; phonetic stays in the title tooltip. */
  compact?: boolean;
};

export function PronounceButton({
  word,
  className = "",
  compact = false,
}: PronounceButtonProps) {
  const [playing, setPlaying] = useState(false);
  const label = word.trim();

  if (!label) {
    return null;
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (playing) {
      return;
    }

    setPlaying(true);
    void pronounceWord(label).finally(() => setPlaying(false));
  }

  return (
    <button
      className={`pronounceButton${compact ? " isCompact" : ""}${playing ? " isBusy" : ""}${className ? ` ${className}` : ""}`}
      type="button"
      draggable={false}
      onClick={handleClick}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      aria-label={`Pronounce ${label}`}
      title={`Listen: ${label}`}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4Zm13.5 3a3.5 3.5 0 0 0-1.8-3.05v6.1A3.5 3.5 0 0 0 17.5 12Zm0-7.5v2.06A6.5 6.5 0 0 1 21 12a6.5 6.5 0 0 1-3.5 5.44v2.06A8.5 8.5 0 0 0 23 12a8.5 8.5 0 0 0-5.5-7.5Z" />
      </svg>
    </button>
  );
}
