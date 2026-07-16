export type CardStatus = "new" | "learning" | "known";
export type ReviewGrade = "again" | "good";

export type ReviewFields = {
  status: CardStatus;
  interval_days: number;
  next_review_at: string | null;
};

export type ReviewCard = {
  id: string;
  status: CardStatus;
  interval_days?: number | null;
  next_review_at?: string | null;
};

/** Max cards in one learning test session. */
export const MAX_SESSION_SIZE = 10;

/** Max brand-new cards introduced when filling a due-first session. */
export const MAX_NEW_PER_SESSION = 5;

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

/**
 * Due for Start Learning:
 * - new / unscheduled learning (no next_review_at)
 * - learning or known with next_review_at <= now
 * Legacy known with null schedule stay out until they get a decay date.
 */
export function isDue(
  card: { status: CardStatus; next_review_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (isNewCard(card)) {
    return true;
  }

  return isScheduledDue(card, now);
}

export function gradeCard(
  card: { status: CardStatus; interval_days?: number | null },
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
    };
  }

  // Maintenance review for known (including decayed known).
  if (card.status === "known") {
    const base = Math.max(current, KNOWN_INITIAL_DAYS);
    const extended = Math.min(KNOWN_MAX_DAYS, Math.round(base * 1.5));

    return {
      status: "known",
      interval_days: extended,
      next_review_at: addDays(now, extended),
    };
  }

  // Leitner climb: 0 → 1 → 3 → 7 → known@30d
  if (current < 1) {
    return {
      status: "learning",
      interval_days: INTERVAL_STEPS[0],
      next_review_at: addDays(now, INTERVAL_STEPS[0]),
    };
  }

  if (current < 3) {
    return {
      status: "learning",
      interval_days: INTERVAL_STEPS[1],
      next_review_at: addDays(now, INTERVAL_STEPS[1]),
    };
  }

  if (current < 7) {
    return {
      status: "learning",
      interval_days: INTERVAL_STEPS[2],
      next_review_at: addDays(now, INTERVAL_STEPS[2]),
    };
  }

  return {
    status: "known",
    interval_days: KNOWN_INITIAL_DAYS,
    next_review_at: addDays(now, KNOWN_INITIAL_DAYS),
  };
}

/** Fields when manually setting status in the editor. */
export function reviewFieldsForStatus(
  status: CardStatus,
  now: Date = new Date(),
): Pick<ReviewFields, "interval_days" | "next_review_at"> {
  if (status === "known") {
    return {
      interval_days: KNOWN_INITIAL_DAYS,
      next_review_at: addDays(now, KNOWN_INITIAL_DAYS),
    };
  }

  return { interval_days: 0, next_review_at: null };
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
};

/** Counts for CTA: scheduled due + new fill (capped like a real session). */
export function countSessionPool<T extends ReviewCard>(
  cards: T[],
  now: Date = new Date(),
): SessionCounts {
  const due = cards.filter((card) => isScheduledDue(card, now)).length;
  const news = cards.filter((card) => isNewCard(card)).length;
  const newCap = due === 0 ? MAX_SESSION_SIZE : MAX_NEW_PER_SESSION;
  const sessionSize = Math.min(MAX_SESSION_SIZE, due + Math.min(newCap, news));

  return { due, news, sessionSize };
}

/**
 * Due-first session deck:
 * 1) shuffle scheduled-due cards (learning + decayed known)
 * 2) fill remaining slots with new cards (max MAX_NEW_PER_SESSION)
 */
export function buildSessionDeck<T extends ReviewCard>(
  cards: T[],
  options?: { maxSize?: number; maxNew?: number; now?: Date; shuffle?: boolean },
): T[] {
  const maxSize = options?.maxSize ?? MAX_SESSION_SIZE;
  const maxNew = options?.maxNew ?? MAX_NEW_PER_SESSION;
  const now = options?.now ?? new Date();
  const shouldShuffle = options?.shuffle !== false;

  const scheduledDue = cards.filter((card) => isScheduledDue(card, now));
  const newCards = cards.filter((card) => isNewCard(card));

  const dueOrdered = shouldShuffle ? shuffle(scheduledDue) : [...scheduledDue];
  const newOrdered = shouldShuffle ? shuffle(newCards) : [...newCards];

  const deck = dueOrdered.slice(0, maxSize);
  const usedIds = new Set(deck.map((card) => card.id));
  // When nothing is scheduled, allow a full session of new cards.
  const newCap = dueOrdered.length === 0 ? maxSize : maxNew;
  const newSlots = Math.min(maxSize - deck.length, newCap);
  let newsAdded = 0;

  for (const card of newOrdered) {
    if (newsAdded >= newSlots) {
      break;
    }
    if (usedIds.has(card.id)) {
      continue;
    }
    deck.push(card);
    usedIds.add(card.id);
    newsAdded += 1;
  }

  return deck;
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
