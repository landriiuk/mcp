import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const validWord = {
  word: "brief",
  meaning: "short",
  example: "",
  status: "new",
  tags: [],
  folder: "",
  interval_days: 0,
  next_review_at: null,
  correct_streak: 0,
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z",
};

beforeAll(async () => {
  const [host, portText] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080").split(":");
  testEnv = await initializeTestEnvironment({
    projectId: "demo-inklex-local",
    firestore: {
      host,
      port: Number(portText),
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("user-owned Firestore data", () => {
  it("allows the owner to create and read a word", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    const ref = doc(db, "users/alice/words/word-1");
    await assertSucceeds(setDoc(ref, validWord));
    await assertSucceeds(getDoc(ref));
  });

  it("denies another user and anonymous clients", async () => {
    const ownerDb = testEnv.authenticatedContext("alice").firestore();
    const ownerRef = doc(ownerDb, "users/alice/words/word-1");
    await assertSucceeds(setDoc(ownerRef, validWord));

    const otherDb = testEnv.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(otherDb, "users/alice/words/word-1")));

    const anonymousDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymousDb, "users/alice/words/word-1")));
  });

  it("denies legacy global collections", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(db, "words/legacy-word"), validWord));
  });

  it("validates folder fields", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(db, "users/alice/folders/folder-1"), {
        name: "Work",
        updated_at: "2026-09-14T00:00:00.000Z",
      }),
    );
    await assertFails(
      setDoc(doc(db, "users/alice/folders/folder-2"), {
        name: "",
        updated_at: "2026-09-14T00:00:00.000Z",
      }),
    );
  });
});
