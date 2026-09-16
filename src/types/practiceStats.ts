export type PracticeStats = {
  questCompletedCount: number;
  lastQuestCompletedAt: string | null;
};

export function emptyPracticeStats(): PracticeStats {
  return {
    questCompletedCount: 0,
    lastQuestCompletedAt: null,
  };
}

export function questsCompletedLabel(count: number): string {
  if (count === 1) {
    return "1 quest completed";
  }
  return `${count} quests completed`;
}
