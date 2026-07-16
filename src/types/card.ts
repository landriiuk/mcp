export type CardStatus = "new" | "learning" | "known";

export type Card = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string[];
  folder: string;
  interval_days: number;
  next_review_at: string | null;
};

export type Draft = {
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string[];
  folder: string;
};
