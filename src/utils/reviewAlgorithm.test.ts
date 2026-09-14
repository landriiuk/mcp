import { describe, expect, it } from "vitest";
import {
  answersMatch,
  buildMeaningOptions,
  buildQuestDeck,
  buildWordOptions,
  CORRECT_STREAK_TO_KNOWN,
  countSessionPool,
  demoteInterval,
  gradeCard,
  isDue,
  isNearDuplicateMeaning,
  isNewCard,
  isQuestEligible,
  MAX_SESSION_SIZE,
  normalizeAnswer,
  reviewFieldsForStatus,
  type ReviewCard,
} from "./reviewAlgorithm";

function card(
  partial: Partial<ReviewCard> & Pick<ReviewCard, "id" | "status">,
): ReviewCard {
  return {
    interval_days: 0,
    next_review_at: null,
    correct_streak: 0,
    ...partial,
  };
}

describe("isQuestEligible / isDue / isNewCard", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  it("excludes known from quest", () => {
    expect(isQuestEligible({ status: "known" })).toBe(false);
    expect(isDue(card({ id: "1", status: "known" }), now)).toBe(false);
  });

  it("treats unscheduled new/learning as due", () => {
    expect(isNewCard(card({ id: "1", status: "new" }))).toBe(true);
    expect(isDue(card({ id: "1", status: "learning" }), now)).toBe(true);
  });

  it("respects next_review_at for learning", () => {
    const due = card({
      id: "1",
      status: "learning",
      next_review_at: "2026-01-14T12:00:00.000Z",
    });
    const ahead = card({
      id: "2",
      status: "learning",
      next_review_at: "2026-01-16T12:00:00.000Z",
    });
    expect(isDue(due, now)).toBe(true);
    expect(isDue(ahead, now)).toBe(false);
  });
});

describe("buildQuestDeck", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  it("takes due first then fills from ahead, capped at max", () => {
    const cards = [
      card({ id: "ahead", status: "learning", next_review_at: "2026-01-20T00:00:00.000Z" }),
      card({ id: "due1", status: "new" }),
      card({ id: "due2", status: "learning", next_review_at: "2026-01-10T00:00:00.000Z" }),
      card({ id: "known", status: "known", next_review_at: "2026-02-01T00:00:00.000Z" }),
    ];
    const deck = buildQuestDeck(cards, { now, shuffle: false, maxSize: 2 });
    expect(deck.map((c) => c.id)).toEqual(["due1", "due2"]);
  });

  it("fills from ahead when due is fewer than max", () => {
    const cards = [
      card({ id: "due", status: "new" }),
      card({ id: "ahead", status: "learning", next_review_at: "2026-01-20T00:00:00.000Z" }),
    ];
    const deck = buildQuestDeck(cards, { now, shuffle: false, maxSize: 10 });
    expect(deck.map((c) => c.id)).toEqual(["due", "ahead"]);
  });

  it("never exceeds MAX_SESSION_SIZE", () => {
    const cards = Array.from({ length: 20 }, (_, i) =>
      card({ id: `c${i}`, status: "new" }),
    );
    expect(buildQuestDeck(cards, { now, shuffle: false })).toHaveLength(MAX_SESSION_SIZE);
  });
});

describe("countSessionPool", () => {
  it("counts pool and caps session size", () => {
    const cards = [
      card({ id: "1", status: "new" }),
      card({ id: "2", status: "learning" }),
      card({ id: "3", status: "known" }),
    ];
    const counts = countSessionPool(cards);
    expect(counts.poolSize).toBe(2);
    expect(counts.sessionSize).toBe(2);
    expect(counts.due).toBe(2);
  });
});

describe("gradeCard", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  it("again resets streak and schedules ~10 minutes", () => {
    const result = gradeCard(
      { status: "learning", interval_days: 3, correct_streak: 2 },
      "again",
      now,
    );
    expect(result.status).toBe("learning");
    expect(result.correct_streak).toBe(0);
    expect(result.interval_days).toBe(1);
    expect(new Date(result.next_review_at!).getTime() - now.getTime()).toBe(10 * 60 * 1000);
  });

  it("good increments streak and promotes at threshold", () => {
    const almost = gradeCard(
      { status: "learning", interval_days: 1, correct_streak: CORRECT_STREAK_TO_KNOWN - 2 },
      "good",
      now,
    );
    expect(almost.status).toBe("learning");
    expect(almost.correct_streak).toBe(CORRECT_STREAK_TO_KNOWN - 1);

    const promoted = gradeCard(
      { status: "learning", interval_days: 3, correct_streak: CORRECT_STREAK_TO_KNOWN - 1 },
      "good",
      now,
    );
    expect(promoted.status).toBe("known");
    expect(promoted.interval_days).toBe(30);
    expect(promoted.correct_streak).toBe(0);
  });

  it("easy uses longer spacing than good for learning", () => {
    const good = gradeCard({ status: "new", interval_days: 0, correct_streak: 0 }, "good", now);
    const easy = gradeCard({ status: "new", interval_days: 0, correct_streak: 0 }, "easy", now);
    expect(good.interval_days).toBe(1);
    expect(easy.interval_days).toBe(3);
  });

  it("easy extends known farther than good", () => {
    const good = gradeCard(
      { status: "known", interval_days: 30, correct_streak: 0 },
      "good",
      now,
    );
    const easy = gradeCard(
      { status: "known", interval_days: 30, correct_streak: 0 },
      "easy",
      now,
    );
    expect(good.interval_days).toBe(45);
    expect(easy.interval_days).toBe(60);
  });
});

describe("demoteInterval / reviewFieldsForStatus", () => {
  it("soft-demotes one Leitner step", () => {
    expect(demoteInterval(7)).toBe(3);
    expect(demoteInterval(3)).toBe(1);
    expect(demoteInterval(1)).toBe(1);
  });

  it("resets streak when setting status manually", () => {
    expect(reviewFieldsForStatus("known").correct_streak).toBe(0);
    expect(reviewFieldsForStatus("learning").next_review_at).toBeNull();
  });
});

describe("MCQ distractors / typed match", () => {
  it("normalizes and matches typed answers", () => {
    expect(normalizeAnswer("  Hello   World ")).toBe("hello world");
    expect(answersMatch("Café", "café")).toBe(true);
    expect(answersMatch("a", "b")).toBe(false);
  });

  it("detects near-duplicate meanings", () => {
    expect(isNearDuplicateMeaning("to run", "to run")).toBe(true);
    expect(isNearDuplicateMeaning("running quickly", "running")).toBe(true);
    expect(isNearDuplicateMeaning("cat", "dog")).toBe(false);
  });

  it("avoids near-duplicate distractors in meaning options", () => {
    const options = buildMeaningOptions(
      "to run",
      [
        { id: "1", meaning: "to run" },
        { id: "2", meaning: "to run fast" },
        { id: "3", meaning: "to jump" },
        { id: "4", meaning: "to swim" },
        { id: "5", meaning: "to fly" },
      ],
      "1",
      4,
    );
    expect(options).toContain("to run");
    expect(options).toHaveLength(4);
    expect(options.filter((o) => isNearDuplicateMeaning(o, "to run")).length).toBe(1);
  });

  it("builds word options for reverse MCQ", () => {
    const options = buildWordOptions(
      "apple",
      [
        { id: "1", word: "apple" },
        { id: "2", word: "banana" },
        { id: "3", word: "cherry" },
      ],
      "1",
      3,
    );
    expect(options).toContain("apple");
    expect(options).toHaveLength(3);
  });
});
