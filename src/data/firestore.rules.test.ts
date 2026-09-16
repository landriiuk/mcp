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
  increment,
  Timestamp,
  updateDoc,
  writeBatch,
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
  visibility: "public",
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

async function seed(path: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), path), data);
  });
}

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

  it("lets the owner increment quest completion stats", async () => {
    const stats = {
      quest_completed_count: 1,
      last_quest_completed_at: "2026-09-16T00:00:00.000Z",
      updated_at: "2026-09-16T00:00:00.000Z",
      schema_version: 1,
    };
    const db = testEnv.authenticatedContext("alice").firestore();
    const ref = doc(db, "users/alice/stats/practice");
    await assertSucceeds(setDoc(ref, stats));
    await assertSucceeds(
      updateDoc(ref, {
        quest_completed_count: increment(1),
        last_quest_completed_at: "2026-09-16T01:00:00.000Z",
        updated_at: "2026-09-16T01:00:00.000Z",
      }),
    );

    const otherDb = testEnv.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(otherDb, "users/alice/stats/practice")));
    await assertFails(
      setDoc(doc(db, "users/alice/stats/practice"), {
        ...stats,
        quest_completed_count: 9,
      }),
    );
  });
});

describe("roles and teacher access", () => {
  const role = (value: "student" | "teacher" | "admin", assignedBy: string | null = null) => ({
    role: value,
    assigned_at: "2026-09-16T00:00:00.000Z",
    assigned_by_uid: assignedBy,
    schema_version: 1,
  });

  it("defaults self-service roles to student and blocks privilege escalation", async () => {
    const db = testEnv.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(db, "roles/alice"), role("student")));
    await assertFails(setDoc(doc(db, "roles/bob"), role("student")));

    const otherDb = testEnv.authenticatedContext("mallory").firestore();
    await assertFails(setDoc(doc(otherDb, "roles/mallory"), role("admin")));
    await assertFails(updateDoc(doc(db, "roles/alice"), { role: "teacher" }));
  });

  it("lets admins assign roles without exposing private vocabulary", async () => {
    await seed("roles/admin", role("admin"));
    await seed("roles/bob", role("student"));
    await seed("users/bob/words/private", validWord);

    const db = testEnv.authenticatedContext("admin").firestore();
    await assertSucceeds(
      setDoc(doc(db, "roles/bob"), role("teacher", "admin")),
    );
    await assertFails(getDoc(doc(db, "users/bob/words/private")));
  });

  it("accepts an email invite atomically and creates membership", async () => {
    await seed("roles/teacher", role("teacher"));
    await seed("roles/student", role("student"));
    const teacherDb = testEnv
      .authenticatedContext("teacher", { email: "teacher@example.com" })
      .firestore();
    await assertSucceeds(
      setDoc(doc(teacherDb, "teacherInvites/invite-1"), {
        teacher_uid: "teacher",
        teacher_name: "Ms Green",
        student_email_lower: "student@example.com",
        status: "pending",
        created_at: "2026-09-16T00:00:00.000Z",
        expires_at: Timestamp.fromDate(new Date(Date.now() + 86_400_000)),
        accepted_by_uid: null,
        accepted_at: null,
        schema_version: 1,
      }),
    );

    const wrongDb = testEnv
      .authenticatedContext("mallory", { email: "wrong@example.com" })
      .firestore();
    await assertFails(getDoc(doc(wrongDb, "teacherInvites/invite-1")));

    const studentDb = testEnv
      .authenticatedContext("student", { email: "student@example.com" })
      .firestore();
    const batch = writeBatch(studentDb);
    batch.update(doc(studentDb, "teacherInvites/invite-1"), {
      status: "accepted",
      accepted_by_uid: "student",
      accepted_at: "2026-09-16T00:01:00.000Z",
    });
    batch.set(doc(studentDb, "teachers/teacher/students/student"), {
      invite_id: "invite-1",
      student_email_lower: "student@example.com",
      display_name: "Student",
      accepted_at: "2026-09-16T00:01:00.000Z",
      schema_version: 1,
    });
    await assertSucceeds(batch.commit());
  });

  it("limits student-only snapshots to enrolled students", async () => {
    await seed("roles/teacher", role("teacher"));
    await seed("teachers/teacher/students/student", {
      invite_id: "invite-1",
      student_email_lower: "student@example.com",
      display_name: "Student",
      accepted_at: "2026-09-16T00:01:00.000Z",
      schema_version: 1,
    });
    const teacherDb = testEnv.authenticatedContext("teacher").firestore();
    const snapshotRef = doc(teacherDb, "sharedSnapshots/private-share");
    await assertSucceeds(
      setDoc(snapshotRef, {
        ...validSnapshot,
        owner_uid: "teacher",
        visibility: "students",
      }),
    );
    await assertSucceeds(
      setDoc(
        doc(teacherDb, "sharedSnapshots/private-share/words/word-1"),
        validSnapshotWord,
      ),
    );
    await assertSucceeds(updateDoc(snapshotRef, { status: "active" }));

    await assertFails(
      getDoc(
        doc(
          testEnv.unauthenticatedContext().firestore(),
          "sharedSnapshots/private-share",
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          testEnv.authenticatedContext("outsider").firestore(),
          "sharedSnapshots/private-share",
        ),
      ),
    );
    const studentDb = testEnv.authenticatedContext("student").firestore();
    await assertSucceeds(
      getDoc(doc(studentDb, "sharedSnapshots/private-share")),
    );
    await assertSucceeds(
      getDoc(doc(studentDb, "sharedSnapshots/private-share/words/word-1")),
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
