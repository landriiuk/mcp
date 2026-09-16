import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  copySharedSnapshot,
  createFolder,
  createWord,
  getPublicSnapshot,
  listFolders,
  listPublishedSnapshots,
  listWords,
  publishFolderSnapshot,
  revokeSharedSnapshot,
} from "./mockApi";

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

describe("shared snapshot mock API", () => {
  it("publishes, previews, copies, and revokes an immutable folder", async () => {
    const sourceFolder = await createFolder("teacher", "Travel");
    await createWord("teacher", {
      word: "journey",
      meaning: "подорож",
      example: "A long journey",
      status: "known",
      tags: ["travel"],
      folder: sourceFolder.id,
    });

    const published = await publishFolderSnapshot("teacher", sourceFolder.id);
    const preview = await getPublicSnapshot(published.shareId);
    expect(preview.meta.folderName).toBe("Travel");
    expect(preview.words).toHaveLength(1);

    await createFolder("student", "Travel");
    const copied = await copySharedSnapshot("student", published.shareId);
    expect(copied.folderName).toBe("Travel (2)");
    expect(await listFolders("student")).toHaveLength(2);
    expect(await listWords("student")).toEqual([
      expect.objectContaining({
        word: "journey",
        folder: copied.folderId,
        status: "new",
        interval_days: 0,
        next_review_at: null,
        correct_streak: 0,
      }),
    ]);
    const repeatedCopy = await copySharedSnapshot("student", published.shareId);
    expect(repeatedCopy).toEqual(
      expect.objectContaining({
        folderId: copied.folderId,
        imported: 0,
        alreadyImported: true,
      }),
    );
    expect(await listFolders("student")).toHaveLength(2);
    expect(await listWords("student")).toHaveLength(1);

    expect(await listPublishedSnapshots("teacher", sourceFolder.id)).toEqual([
      expect.objectContaining({ id: published.shareId, status: "active" }),
    ]);

    await revokeSharedSnapshot("teacher", published.shareId);
    await expect(getPublicSnapshot(published.shareId)).rejects.toThrow(
      "unavailable",
    );
  });

  it("rejects an empty or corrupted public snapshot", async () => {
    const folder = await createFolder("teacher", "Travel");
    await createWord("teacher", {
      word: "journey",
      meaning: "подорож",
      example: "",
      status: "new",
      tags: [],
      folder: folder.id,
    });
    const published = await publishFolderSnapshot("teacher", folder.id);
    const stored = JSON.parse(
      values.get("inklex.sharedSnapshots.v1") ?? "[]",
    );
    stored[0].words = [];
    values.set("inklex.sharedSnapshots.v1", JSON.stringify(stored));

    await expect(getPublicSnapshot(published.shareId)).rejects.toThrow(
      "incomplete",
    );
  });
});
