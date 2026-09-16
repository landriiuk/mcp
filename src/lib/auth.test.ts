import { FirebaseError } from "firebase/app";
import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./authErrors";
import {
  requireShareId,
  requireUid,
  sharedSnapshotPath,
  sharedSnapshotWordPath,
  sharedSnapshotWordsPath,
  userFolderPath,
  userFoldersPath,
  userImportedSnapshotPath,
  userPublishedSnapshotPath,
  userWordPath,
  userWordsPath,
} from "./userDataPath";
import { nextAvailableFolderName } from "./sharedSnapshots";
import { sharePath } from "../utils/routes";

describe("authErrorMessage", () => {
  it("maps Firebase auth errors to user-facing copy", () => {
    expect(
      authErrorMessage(new FirebaseError("auth/invalid-credential", "raw")),
    ).toBe("Email or password is incorrect.");
  });

  it("falls back for unknown errors", () => {
    expect(authErrorMessage(new FirebaseError("auth/unknown", "raw"))).toBe(
      "Could not sign in. Try again.",
    );
  });
});

describe("user-scoped Firestore paths", () => {
  it("builds words and folders paths under the uid", () => {
    expect(userWordsPath("alice")).toBe("users/alice/words");
    expect(userFoldersPath("alice")).toBe("users/alice/folders");
    expect(userWordPath("alice", "word-1")).toBe("users/alice/words/word-1");
    expect(userFolderPath("alice", "folder-1")).toBe(
      "users/alice/folders/folder-1",
    );
  });

  it("rejects missing or path-like uid values", () => {
    expect(() => requireUid("")).toThrow("valid user id");
    expect(() => requireUid("a/b")).toThrow("valid user id");
  });

  it("builds and validates shared snapshot paths", () => {
    expect(sharedSnapshotPath("share-1")).toBe("sharedSnapshots/share-1");
    expect(sharedSnapshotWordsPath("share-1")).toBe(
      "sharedSnapshots/share-1/words",
    );
    expect(sharedSnapshotWordPath("share-1", "word-1")).toBe(
      "sharedSnapshots/share-1/words/word-1",
    );
    expect(userPublishedSnapshotPath("alice", "share-1")).toBe(
      "users/alice/publishedSnapshots/share-1",
    );
    expect(userImportedSnapshotPath("alice", "share-1")).toBe(
      "users/alice/importedSnapshots/share-1",
    );
    expect(() => requireShareId("a/b")).toThrow("valid share id");
  });

  it("creates safe unique names and share URLs", () => {
    expect(nextAvailableFolderName("Travel", ["Travel", "Travel (2)"])).toBe(
      "Travel (3)",
    );
    expect(sharePath("share id")).toBe("/share/share%20id");
  });
});
