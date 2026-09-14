import type { ReactNode } from "react";
import {
  buildQuestDeck,
  MAX_SESSION_SIZE,
  type ReviewGrade,
} from "../utils/reviewAlgorithm";
import type { WordboxCard } from "../components/wordbox/types";
import type { LearningMode } from "../lib/learningMode";

export type PracticeFormatId = LearningMode;

export type PracticeFormatMeta = {
  id: PracticeFormatId;
  title: string;
  badge: string;
  description: string;
  bullets: string[];
  /** Quest pool (new/learning) vs all folder words. */
  pool: "quest" | "review";
  /** Minimum words in the quest pool required to start (quest formats only). */
  minPoolSize?: number;
  endEarlyLabel: string;
  skipLabel: string;
  completeBadge: string;
  emptyTitle: string;
  emptyBody: string;
  intro: string;
  preferredHint?: string;
};

/** Reverse MCQ needs enough distractors — at least 3 Cards/Learning words. */
export const MIN_REVERSE_QUEST_WORDS = 3;

export const PRACTICE_FORMATS: PracticeFormatMeta[] = [
  {
    id: "quest",
    title: "Quest",
    badge: "Multiple choice",
    description:
      "See the word, then pick the correct meaning from four options. Fast recognition practice — good for warming up and checking what you already know.",
    bullets: [
      `Up to ${MAX_SESSION_SIZE} Cards/Learning words per session`,
      "Due words first, then the rest of the pool — start another quest anytime",
      "3 correct in a row → Known; a wrong answer resets the streak (one in-session retry)",
    ],
    pool: "quest",
    endEarlyLabel: "End session",
    skipLabel: "Skip",
    completeBadge: "Quest complete",
    emptyTitle: "No Cards or Learning words",
    emptyBody:
      "Quest uses words from the Cards and Learning tabs. Add new words or move some out of Known to practice again.",
    intro: "Pick the correct meaning. Example stays under a spoiler. Keys 1–4 select an option.",
  },
  {
    id: "quest-reverse",
    title: "Reverse Quest",
    badge: "Meaning → word",
    description:
      "See the meaning, then pick the correct word. Harder recognition — trains the other direction.",
    bullets: [
      `Needs at least ${MIN_REVERSE_QUEST_WORDS} Cards/Learning words (for answer options)`,
      `Up to ${MAX_SESSION_SIZE} words per session · due first, then the rest`,
      "Same streak → Known rules as Quest",
    ],
    pool: "quest",
    minPoolSize: MIN_REVERSE_QUEST_WORDS,
    endEarlyLabel: "End session",
    skipLabel: "Skip",
    completeBadge: "Reverse Quest complete",
    emptyTitle: "Need more words",
    emptyBody: `Reverse Quest needs at least ${MIN_REVERSE_QUEST_WORDS} Cards or Learning words in this folder so it can build multiple-choice options. Add more words, then try again.`,
    intro: "Pick the correct word for the meaning. Keys 1–4 select an option.",
  },
  {
    id: "quest-typed",
    title: "Typed Quest",
    badge: "Type the word",
    description:
      "See the meaning, then type the word. Strongest recall practice — no multiple-choice hints.",
    bullets: [
      `Up to ${MAX_SESSION_SIZE} Cards/Learning words per session`,
      "Due words first, then the rest of the pool",
      "Case and extra spaces are ignored; 3 correct in a row → Known",
    ],
    pool: "quest",
    endEarlyLabel: "End session",
    skipLabel: "Skip",
    completeBadge: "Typed Quest complete",
    emptyTitle: "No Cards or Learning words",
    emptyBody:
      "Typed Quest uses Cards and Learning words. Add new words or move some out of Known to practice again.",
    intro: "Type the word for the meaning. If you miss, review the answer, then press Continue.",
  },
  {
    id: "review",
    title: "Review",
    badge: "Self-grade",
    description:
      "Cards alternate between word and meaning. Tap to reveal, then rate how well you recalled it: Bad, Good, or Easy.",
    bullets: [
      "All words in the current folder",
      "Prompt alternates: word ↔ meaning (no example)",
      "Bad / Good / Easy update the schedule; Next skips",
    ],
    pool: "review",
    endEarlyLabel: "End Review",
    skipLabel: "Next",
    completeBadge: "Review complete",
    emptyTitle: "No words in this folder",
    emptyBody: "Add words to this folder to start a Review session.",
    intro: "Tap to reveal, then Bad / Good / Easy — or Next to skip.",
  },
];

export function getPracticeFormat(id: PracticeFormatId): PracticeFormatMeta {
  return PRACTICE_FORMATS.find((format) => format.id === id) ?? PRACTICE_FORMATS[0];
}

export function canStartPracticeFormat(
  format: PracticeFormatMeta,
  poolSize: number,
  folderWordCount: number,
): boolean {
  if (format.pool === "review") {
    return folderWordCount > 0;
  }
  const minSize = format.minPoolSize ?? 1;
  return poolSize >= minSize;
}

export function practiceFormatUnavailableHint(
  format: PracticeFormatMeta,
  poolSize: number,
  folderWordCount: number,
): string | null {
  if (canStartPracticeFormat(format, poolSize, folderWordCount)) {
    return null;
  }
  if (format.pool === "review") {
    return "No words in this folder yet";
  }
  if (format.minPoolSize && poolSize < format.minPoolSize) {
    return `Need at least ${format.minPoolSize} Cards/Learning words (have ${poolSize})`;
  }
  return "No Cards or Learning words in this folder";
}

export function isQuestFormat(id: PracticeFormatId): boolean {
  return getPracticeFormat(id).pool === "quest";
}

export function buildDeckForFormat(
  formatId: PracticeFormatId,
  cards: WordboxCard[],
  options?: { shuffle?: boolean; reuseDeck?: boolean },
): WordboxCard[] {
  const shouldShuffle = options?.shuffle !== false;
  if (options?.reuseDeck) {
    const copy = [...cards];
    if (!shouldShuffle) {
      return copy.slice(0, formatId === "review" ? copy.length : MAX_SESSION_SIZE);
    }
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = temp;
    }
    return copy.slice(0, formatId === "review" ? copy.length : MAX_SESSION_SIZE);
  }

  if (formatId === "review") {
    const copy = [...cards];
    if (!shouldShuffle) {
      return copy;
    }
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      const temp = copy[index];
      copy[index] = copy[swapIndex];
      copy[swapIndex] = temp;
    }
    return copy;
  }

  return buildQuestDeck(cards, { shuffle: shouldShuffle });
}

export type FormatPromptProps = {
  card: WordboxCard;
  optionPool: WordboxCard[];
  isBusy: boolean;
  streak: number;
  onOutcome: (grade: ReviewGrade) => void;
  /** Review: Extra node for stats sidebar parent may wrap. */
  children?: ReactNode;
};

export const QUEST_SESSION_KEYS: Record<PracticeFormatId, string> = {
  quest: "inklex.questSession",
  "quest-reverse": "inklex.questReverseSession",
  "quest-typed": "inklex.questTypedSession",
  review: "inklex.reviewSession",
};
