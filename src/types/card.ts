export type CardStatus = "new" | "learning" | "known";

export type Folder = {
  id: string;
  name: string;
};

export type Card = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string[];
  /** Folder id (not display name). Empty string = no folder. */
  folder: string;
  interval_days: number;
  next_review_at: string | null;
  /** Consecutive correct grades toward Known (resets on Again). */
  correct_streak: number;
};

export type Draft = {
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string[];
  /** Folder id (not display name). */
  folder: string;
};
