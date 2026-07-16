import type { Card } from "../types/card";

export const sampleCards: Card[] = [
  {
    id: "brief",
    word: "brief",
    meaning: "short in time, duration, or length",
    example: "Keep the update brief and useful.",
    status: "learning",
    tags: ["work"],
    folder: "Work",
    interval_days: 1,
    next_review_at: null,
  },
  {
    id: "accurate",
    word: "accurate",
    meaning: "correct and without mistakes",
    example: "The report has accurate numbers.",
    status: "new",
    tags: ["writing"],
    folder: "Study",
    interval_days: 0,
    next_review_at: null,
  },
  {
    id: "smooth",
    word: "smooth",
    meaning: "easy and without problems or interruptions",
    example: "The meeting had a smooth start.",
    status: "known",
    tags: ["speaking"],
    folder: "General",
    interval_days: 30,
    next_review_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
