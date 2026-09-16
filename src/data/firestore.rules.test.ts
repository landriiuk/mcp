import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

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

const validSnapshot = {
  owner_uid: "alice",
  folder_name: "Travel",
  word_count: 1,
  published_at: "2026-09-14T00:00:00.000Z",
  schema_version: 1,
  status: "publishing",
};

const validSnapshotWord = {
  word: "journey",
  meaning: "подорож",
  example: "",
  tags: ["travel"],
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

describe("shared folder snapshots", () => {
  async function publishSnapshot() {
    const ownerDb = testEnv.authenticatedContext("alice").firestore();
    const snapshotRef = doc(ownerDb, "sharedSnapshots/share-1");
    await assertSucceeds(setDoc(snapshotRef, validSnapshot));
    await assertSucceeds(
      setDoc(
        doc(ownerDb, "sharedSnapshots/share-1/words/word-1"),
        validSnapshotWord,
      ),
    );
    await assertSucceeds(updateDoc(snapshotRef, { status: "active" }));
  }

  it("allows anonymous clients to read active snapshots and words", async () => {
    await publishSnapshot();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(db, "sharedSnapshots/share-1")));
    await assertSucceeds(
      getDoc(doc(db, "sharedSnapshots/share-1/words/word-1")),
    );
    await assertFails(getDocs(collection(db, "sharedSnapshots")));
  });

  it("denies anonymous access before publish and after revoke", async () => {
    const ownerDb = testEnv.authenticatedContext("alice").firestore();
    const snapshotRef = doc(ownerDb, "sharedSnapshots/share-1");
    await assertSucceeds(setDoc(snapshotRef, validSnapshot));

    const anonymousDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymousDb, "sharedSnapshots/share-1")));

    await assertSucceeds(updateDoc(snapshotRef, { status: "active" }));
    await assertSucceeds(updateDoc(snapshotRef, { status: "revoked" }));
    await assertFails(getDoc(doc(anonymousDb, "sharedSnapshots/share-1")));
  });

  it("allows only the owner to publish and revoke", async () => {
    const aliceDb = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(aliceDb, "sharedSnapshots/share-1"), validSnapshot),
    );

    const bobDb = testEnv.authenticatedContext("bob").firestore();
    await assertFails(
      setDoc(doc(bobDb, "sharedSnapshots/share-2"), validSnapshot),
    );
    await assertFails(
      updateDoc(doc(bobDb, "sharedSnapshots/share-1"), { status: "revoked" }),
    );
  });

  it("validates shared words and keeps them immutable", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(
      setDoc(doc(db, "sharedSnapshots/share-1"), validSnapshot),
    );
    const wordRef = doc(db, "sharedSnapshots/share-1/words/word-1");
    await assertFails(
      setDoc(wordRef, { ...validSnapshotWord, meaning: "" }),
    );
    await assertSucceeds(setDoc(wordRef, validSnapshotWord));
    await assertFails(updateDoc(wordRef, { meaning: "trip" }));
    await assertSucceeds(
      updateDoc(doc(db, "sharedSnapshots/share-1"), { status: "active" }),
    );
    await assertFails(deleteDoc(wordRef));
  });

  it("allows users to write copied cards only to their own account", async () => {
    const bobDb = testEnv.authenticatedContext("bob").firestore();
    await assertSucceeds(
      setDoc(doc(bobDb, "users/bob/words/copied-word"), validWord),
    );
    await assertFails(
      setDoc(doc(bobDb, "users/alice/words/copied-word"), validWord),
    );

    const receiptRef = doc(
      bobDb,
      "users/bob/importedSnapshots/share-1",
    );
    await assertSucceeds(
      setDoc(receiptRef, {
        folder_id: "folder-1",
        folder_name: "Travel",
        imported_at: "2026-09-14T00:00:00.000Z",
      }),
    );
    await assertFails(updateDoc(receiptRef, { folder_name: "Changed" }));
  });
});
