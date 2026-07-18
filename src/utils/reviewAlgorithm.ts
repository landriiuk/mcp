export type CardStatus = "new" | "learning" | "known";
export type ReviewGrade = "again" | "good" | "easy";

export type ReviewFields = {
  status: CardStatus;
  interval_days: number;
  next_review_at: string | null;
  correct_streak: number;
};

export type ReviewCard = {
  id: string;
  status: CardStatus;
  interval_days?: number | null;
  next_review_at?: string | null;
  correct_streak?: number | null;
};

/** Max cards in one Quest session. */
export const MAX_SESSION_SIZE = 10;

/** Correct answers in a row required to promote to Known. */
export const CORRECT_STREAK_TO_KNOWN = 3;

/** Max wrong→requeue attempts per card within one session. */
export const MAX_SESSION_RETRIES = 1;

const INTERVAL_STEPS = [1, 3, 7] as const;
const KNOWN_INITIAL_DAYS = 30;
const KNOWN_MAX_DAYS = 180;
const AGAIN_DELAY_MS = 10 * 60 * 1000;

function addDays(from: Date, days: number): string {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function againReviewAt(now: Date): string {
  return new Date(now.getTime() + AGAIN_DELAY_MS).toISOString();
}

function normalizeStreak(value: number | null | undefined): number {
  const n = Number(value) || 0;
  return n < 0 ? 0 : Math.floor(n);
}

/** Step down one Leitner rung (never hard-reset from 7 → 1). */
export function demoteInterval(current: number): number {
  if (current >= 7) {
    return INTERVAL_STEPS[1];
  }
  if (current >= 3) {
    return INTERVAL_STEPS[0];
  }
  return INTERVAL_STEPS[0];
}

/** Soft Leitner climb for spacing — does not promote to Known. */
function advanceLearningInterval(current: number): number {
  if (current < 1) {
    return INTERVAL_STEPS[0];
  }
  if (current < 3) {
    return INTERVAL_STEPS[1];
  }
  return INTERVAL_STEPS[2];
}

/** Easy: jump two spacing steps without Known promotion. */
function advanceLearningIntervalEasy(current: number): number {
  if (current < 1) {
    return INTERVAL_STEPS[1];
  }
  if (current < 3) {
    return INTERVAL_STEPS[2];
  }
  return INTERVAL_STEPS[2];
}

/** Card has a schedule timestamp that is due (or invalid). */
export function isScheduledDue(
  card: { next_review_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (!card.next_review_at) {
    return false;
  }

  const dueAt = new Date(card.next_review_at);
  if (Number.isNaN(dueAt.getTime())) {
    return true;
  }

  return dueAt.getTime() <= now.getTime();
}

/** Never-scheduled practice card (new / unscored learning). */
export function isNewCard(card: { status: CardStatus; next_review_at?: string | null }): boolean {
  if (card.status === "known") {
    return false;
  }

  return !card.next_review_at;
}

/** Eligible for Quest: Cards + Learning tabs only. */
export function isQuestEligible(card: { status: CardStatus }): boolean {
  return card.status === "new" || card.status === "learning";
}

/**
 * Due for Quest priority:
 * - new / unscheduled learning (no next_review_at)
 * - learning with next_review_at <= now
 */
export function isDue(
  card: { status: CardStatus; next_review_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (!isQuestEligible(card)) {
    return false;
  }

  if (isNewCard(card)) {
    return true;
  }

  return isScheduledDue(card, now);
}

function promoteToKnown(now: Date): ReviewFields {
  return {
    status: "known",
    interval_days: KNOWN_INITIAL_DAYS,
    next_review_at: addDays(now, KNOWN_INITIAL_DAYS),
    correct_streak: 0,
  };
}

function gradeGood(
  card: {
    status: CardStatus;
    interval_days?: number | null;
    correct_streak?: number | null;
  },
  now: Date,
): ReviewFields {
  const current = Number(card.interval_days) || 0;

  if (card.status === "known") {
    const base = Math.max(current, KNOWN_INITIAL_DAYS);
    const extended = Math.min(KNOWN_MAX_DAYS, Math.round(base * 1.5));

    return {
      status: "known",
      interval_days: extended,
      next_review_at: addDays(now, extended),
      correct_streak: 0,
    };
  }

  const streak = normalizeStreak(card.correct_streak) + 1;
  if (streak >= CORRECT_STREAK_TO_KNOWN) {
    return promoteToKnown(now);
  }

  const interval = advanceLearningInterval(current);
  return {
    status: "learning",
    interval_days: interval,
    next_review_at: addDays(now, interval),
    correct_streak: streak,
  };
}

function gradeEasy(
  card: {
    status: CardStatus;
    interval_days?: number | null;
    correct_streak?: number | null;
  },
  now: Date,
): ReviewFields {
  const current = Number(card.interval_days) || 0;

  if (card.status === "known") {
    const base = Math.max(current, KNOWN_INITIAL_DAYS);
    const extended = Math.min(KNOWN_MAX_DAYS, Math.round(base * 2));

    return {
      status: "known",
      interval_days: extended,
      next_review_at: addDays(now, extended),
      correct_streak: 0,
    };
  }

  const streak = normalizeStreak(card.correct_streak) + 1;
  if (streak >= CORRECT_STREAK_TO_KNOWN) {
    return promoteToKnown(now);
  }

  const interval = advanceLearningIntervalEasy(current);
  return {
    status: "learning",
    interval_days: interval,
    next_review_at: addDays(now, interval),
    correct_streak: streak,
  };
}

export function gradeCard(
  card: {
    status: CardStatus;
    interval_days?: number | null;
    correct_streak?: number | null;
  },
  grade: ReviewGrade,
  now: Date = new Date(),
): ReviewFields {
  const current = Number(card.interval_days) || 0;

  if (grade === "again") {
    const demoted =
      card.status === "known" && current >= KNOWN_INITIAL_DAYS
        ? INTERVAL_STEPS[1]
        : demoteInterval(current);

    return {
      status: "learning",
      interval_days: demoted,
      next_review_at: againReviewAt(now),
      correct_streak: 0,
    };
  }

  if (grade === "easy") {
    return gradeEasy(card, now);
  }

  return gradeGood(card, now);
}

/** Fields when manually setting status in the editor / drag. */
export function reviewFieldsForStatus(
  status: CardStatus,
  now: Date = new Date(),
): Pick<ReviewFields, "interval_days" | "next_review_at" | "correct_streak"> {
  if (status === "known") {
    return {
      interval_days: KNOWN_INITIAL_DAYS,
      next_review_at: addDays(now, KNOWN_INITIAL_DAYS),
      correct_streak: 0,
    };
  }

  return { interval_days: 0, next_review_at: null, correct_streak: 0 };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return copy;
}

export type SessionCounts = {
  due: number;
  news: number;
  sessionSize: number;
  poolSize: number;
};

/** Counts for Quest CTA: all new/learning in folder, session capped at 10. */
export function countSessionPool<T extends ReviewCard>(
  cards: T[],
  now: Date = new Date(),
): SessionCounts {
  const pool = cards.filter((card) => isQuestEligible(card));
  const due = pool.filter((card) => isDue(card, now)).length;
  const news = pool.filter((card) => isNewCard(card)).length;
  const poolSize = pool.length;
  const sessionSize = Math.min(MAX_SESSION_SIZE, poolSize);

  return { due, news, sessionSize, poolSize };
}

/**
 * Quest deck (new/learning only):
 * 1) shuffle due (scheduled due + unscheduled new)
 * 2) fill remaining slots from the rest of the pool (incl. ahead-of-schedule)
 */
export function buildQuestDeck<T extends ReviewCard>(
  cards: T[],
  options?: { maxSize?: number; now?: Date; shuffle?: boolean },
): T[] {
  const maxSize = options?.maxSize ?? MAX_SESSION_SIZE;
  const now = options?.now ?? new Date();
  const shouldShuffle = options?.shuffle !== false;

  const pool = cards.filter((card) => isQuestEligible(card));
  const priority = pool.filter((card) => isDue(card, now));
  const rest = pool.filter((card) => !isDue(card, now));

  const priorityOrdered = shouldShuffle ? shuffle(priority) : [...priority];
  const restOrdered = shouldShuffle ? shuffle(rest) : [...rest];

  const deck = priorityOrdered.slice(0, maxSize);
  const usedIds = new Set(deck.map((card) => card.id));

  for (const card of restOrdered) {
    if (deck.length >= maxSize) {
      break;
    }
    if (usedIds.has(card.id)) {
      continue;
    }
    deck.push(card);
    usedIds.add(card.id);
  }

  return deck;
}

/** @deprecated Use buildQuestDeck — kept as alias for older call sites. */
export function buildSessionDeck<T extends ReviewCard>(
  cards: T[],
  options?: { maxSize?: number; maxNew?: number; now?: Date; shuffle?: boolean },
): T[] {
  return buildQuestDeck(cards, options);
}

/** Build multiple-choice meanings: correct + distractors from other cards. */
export function buildMeaningOptions(
  correctMeaning: string,
  pool: Array<{ id: string; meaning: string }>,
  currentId: string,
  count = 4,
): string[] {
  const normalizedCorrect = correctMeaning.trim();
  const distractors = pool
    .filter((card) => card.id !== currentId)
    .map((card) => card.meaning.trim())
    .filter((meaning) => meaning && meaning.toLowerCase() !== normalizedCorrect.toLowerCase());

  const uniqueDistractors = Array.from(new Set(distractors));
  const picked = shuffle(uniqueDistractors).slice(0, Math.max(0, count - 1));
  return shuffle([normalizedCorrect, ...picked]);
}
