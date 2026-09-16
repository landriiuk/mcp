import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPracticeStats, recordQuestCompletion } from "./mockApi";
import { questsCompletedLabel } from "../types/practiceStats";

const values = new Map<string, string>();
const localStorage = {
  get length() {
    return values.size;
  },
  clear() {
    values.clear();
  },
  getItem(key: string) {
    return values.get(key) ?? null;
  },
  key(index: number) {
    return [...values.keys()][index] ?? null;
  },
  removeItem(key: string) {
    values.delete(key);
  },
  setItem(key: string, value: string) {
    values.set(key, value);
  },
};

beforeEach(() => {
  values.clear();
  vi.stubGlobal("window", { localStorage });
});

describe("practice stats", () => {
  it("starts at zero and increments quest completions", async () => {
    await expect(getPracticeStats("owner")).resolves.toEqual({
      questCompletedCount: 0,
      lastQuestCompletedAt: null,
    });

    const first = await recordQuestCompletion("owner");
    expect(first.questCompletedCount).toBe(1);
    expect(first.lastQuestCompletedAt).toEqual(expect.any(String));

    const second = await recordQuestCompletion("owner");
    expect(second.questCompletedCount).toBe(2);
    expect(await getPracticeStats("other")).toMatchObject({
      questCompletedCount: 0,
    });
  });

  it("labels quest counts", () => {
    expect(questsCompletedLabel(0)).toBe("0 quests completed");
    expect(questsCompletedLabel(1)).toBe("1 quest completed");
    expect(questsCompletedLabel(4)).toBe("4 quests completed");
  });
});
