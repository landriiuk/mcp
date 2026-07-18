import type { Card } from "../types/card";

export const sampleFolders = [
  { id: "sample-work", name: "Work" },
  { id: "sample-study", name: "Study" },
  { id: "sample-travel", name: "Travel" },
] as const;

export const sampleCards: Card[] = [
  {
    id: "1",
    word: "brief",
    meaning: "short in time, duration, or length",
    example: "Keep the update brief and useful.",
    status: "learning",
    tags: ["work"],
    folder: "sample-work",
    interval_days: 1,
    next_review_at: null,
    correct_streak: 1,
  },
  {
    id: "2",
    word: "accurate",
    meaning: "correct and without mistakes",
    example: "The report has accurate numbers.",
    status: "new",
    tags: ["writing"],
    folder: "sample-study",
    interval_days: 0,
    next_review_at: null,
    correct_streak: 0,
  },
  {
    id: "3",
    word: "itinerary",
    meaning: "a detailed plan for a journey",
    example: "We shared the itinerary before the trip.",
    status: "known",
    tags: ["travel"],
    folder: "sample-travel",
    interval_days: 14,
    next_review_at: null,
    correct_streak: 0,
  },
];
