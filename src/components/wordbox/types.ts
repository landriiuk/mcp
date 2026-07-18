export type WordboxCard = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  status: "new" | "learning" | "known";
  tags: string[];
  folder: string;
  interval_days?: number;
  next_review_at?: string | null;
  correct_streak?: number;
};

export type CardFilter = "all" | "learning" | "known";

export type Section = {
  value: CardFilter;
  label: string;
};

export type SectionCounts = {
  all: number;
  learning: number;
  known: number;
};
