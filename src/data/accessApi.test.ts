import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptTeacherInvite,
  assignUserRole,
  createFolder,
  createTeacherInvite,
  createWord,
  ensureUserAccess,
  getPublicSnapshot,
  listTeacherStudents,
  publishFolderSnapshot,
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

describe("roles and teacher invites", () => {
  it("makes the mock local-dev user an admin", async () => {
    const profile = await ensureUserAccess(
      "local-dev",
      "local@inklex.dev",
      "Local development",
    );
    expect(profile.role).toBe("admin");
  });

  it("lets an admin promote a teacher and accept a student invite", async () => {
    await ensureUserAccess("local-dev", "local@inklex.dev", "Admin");
    await ensureUserAccess("teacher", "teacher@example.com", "Ms Green");
    await assignUserRole("local-dev", "teacher", "teacher");

    const invite = await createTeacherInvite(
      "teacher",
      "Ms Green",
      "student@example.com",
    );
    expect(invite.status).toBe("pending");

    const teacherUid = await acceptTeacherInvite(
      invite.id,
      "student",
      "student@example.com",
      "Student",
    );
    expect(teacherUid).toBe("teacher");
    expect(await listTeacherStudents("teacher")).toEqual([
      expect.objectContaining({
        uid: "student",
        email: "student@example.com",
      }),
    ]);
  });

  it("limits student-only snapshots to enrolled students", async () => {
    await ensureUserAccess("local-dev", "local@inklex.dev", "Admin");
    await ensureUserAccess("teacher", "teacher@example.com", "Ms Green");
    await assignUserRole("local-dev", "teacher", "teacher");
    const folder = await createFolder("teacher", "Travel");
    await createWord("teacher", {
      word: "journey",
      meaning: "подорож",
      example: "",
      status: "new",
      tags: [],
      folder: folder.id,
    });
    const invite = await createTeacherInvite(
      "teacher",
      "Ms Green",
      "student@example.com",
    );
    await acceptTeacherInvite(
      invite.id,
      "student",
      "student@example.com",
      "Student",
    );

    const published = await publishFolderSnapshot(
      "teacher",
      folder.id,
      "students",
    );
    await expect(getPublicSnapshot(published.shareId)).rejects.toThrow(
      "only to this teacher's students",
    );
    await expect(
      getPublicSnapshot(published.shareId, "outsider"),
    ).rejects.toThrow("only to this teacher's students");
    const preview = await getPublicSnapshot(published.shareId, "student");
    expect(preview.meta.visibility).toBe("students");
    expect(preview.words).toHaveLength(1);
  });
});
