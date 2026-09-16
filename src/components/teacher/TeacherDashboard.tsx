import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  createTeacherInvite,
  listTeacherInvites,
  listTeacherStudents,
  removeTeacherStudent,
  revokeTeacherInvite,
} from "../../data/api";
import { useAuth } from "../../hooks/useAuth";
import type { TeacherInvite, TeacherStudent } from "../../types/access";
import { Input } from "../ui/Input";

export function TeacherDashboard() {
  const { profile, user } = useAuth();
  const uid = user?.uid ?? "";
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [invites, setInvites] = useState<TeacherInvite[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingInvites = useMemo(
    () => invites.filter((invite) => invite.status === "pending"),
    [invites],
  );

  async function load() {
    if (!uid) return;
    setLoading(true);
    try {
      const [nextStudents, nextInvites] = await Promise.all([
        listTeacherStudents(uid),
        listTeacherInvites(uid),
      ]);
      setStudents(nextStudents);
      setInvites(nextInvites);
      setError(null);
    } catch {
      setError("Could not load your students.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [uid]);

  async function inviteStudent(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const invite = await createTeacherInvite(
        uid,
        profile?.displayName || user?.displayName || user?.email || "InkLex teacher",
        email,
      );
      setInvites((current) => [
        invite,
        ...current.filter((entry) => entry.id !== invite.id),
      ]);
      setEmail("");
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Could not create an invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function inviteUrl(inviteId: string) {
    return `${window.location.origin}/invite/${encodeURIComponent(inviteId)}`;
  }

  async function copyInvite(invite: TeacherInvite) {
    try {
      await navigator.clipboard.writeText(inviteUrl(invite.id));
      setCopiedId(invite.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setError("Could not copy the invite link. Select and copy it manually.");
    }
  }

  async function revoke(invite: TeacherInvite) {
    if (!window.confirm(`Revoke invitation for ${invite.studentEmail}?`)) return;
    await revokeTeacherInvite(uid, invite.id);
    setInvites((current) =>
      current.map((entry) =>
        entry.id === invite.id ? { ...entry, status: "revoked" } : entry,
      ),
    );
  }

  async function remove(student: TeacherStudent) {
    if (!window.confirm(`Remove ${student.email} from your students?`)) return;
    await removeTeacherStudent(uid, student.uid);
    setStudents((current) =>
      current.filter((entry) => entry.uid !== student.uid),
    );
  }

  return (
    <main className="managementShell">
      <header className="managementTopbar">
        <Link className="sharePreviewBrand" to="/">
          <img src="/favi.png" alt="" width={44} height={44} />
          <span>InkLex</span>
        </Link>
        <Link className="managementBack" to="/">
          Back to cards
        </Link>
      </header>

      <div className="managementContent">
        <section className="managementHero">
          <p className="eyebrow">Teacher workspace</p>
          <h1>Students</h1>
          <p>
            Invite a student by email. They must sign in with that address and
            accept the link.
          </p>
        </section>

        <section className="managementPanel">
          <h2>Invite student</h2>
          <form className="managementInviteForm" onSubmit={inviteStudent}>
            <Input
              aria-label="Student email"
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@example.com"
              required
              type="email"
              value={email}
            />
            <button className="primary" disabled={submitting} type="submit">
              {submitting ? "Creating…" : "Create invite"}
            </button>
          </form>
          {error ? (
            <p className="accessError" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        <section className="managementPanel">
          <h2>Active invitations</h2>
          {loading ? <p>Loading…</p> : null}
          {!loading && pendingInvites.length === 0 ? (
            <p className="managementEmpty">No pending invitations.</p>
          ) : null}
          <div className="managementList">
            {pendingInvites.map((invite) => (
              <article className="managementRow" key={invite.id}>
                <div>
                  <strong>{invite.studentEmail}</strong>
                  <span>Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                </div>
                <div className="managementActions">
                  <button onClick={() => void copyInvite(invite)} type="button">
                    {copiedId === invite.id ? "Copied" : "Copy link"}
                  </button>
                  <button
                    className="isDanger"
                    onClick={() => void revoke(invite)}
                    type="button"
                  >
                    Revoke
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="managementPanel">
          <h2>My students</h2>
          {!loading && students.length === 0 ? (
            <p className="managementEmpty">No students have joined yet.</p>
          ) : null}
          <div className="managementList">
            {students.map((student) => (
              <article className="managementRow" key={student.uid}>
                <div>
                  <strong>{student.displayName || student.email}</strong>
                  <span>{student.email}</span>
                </div>
                <button
                  className="managementRemove isDanger"
                  onClick={() => void remove(student)}
                  type="button"
                >
                  Remove
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
