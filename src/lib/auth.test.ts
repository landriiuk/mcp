import { FirebaseError } from "firebase/app";
import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./authErrors";
import {
  requireUid,
  userFolderPath,
  userFoldersPath,
  userWordPath,
  userWordsPath,
} from "./userDataPath";

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
});
