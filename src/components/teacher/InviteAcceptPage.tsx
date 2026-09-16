import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { acceptTeacherInvite, getTeacherInvite } from "../../data/api";
import { useAuth } from "../../hooks/useAuth";
import type { TeacherInvite } from "../../types/access";

export function InviteAcceptPage() {
  const { inviteId = "" } = useParams();
  const { loading: authLoading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<TeacherInvite | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTeacherInvite(inviteId)
      .then((result) => {
        if (!cancelled) setInvite(result);
      })
      .catch(() => {
        if (!cancelled) setError("This invitation is unavailable.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, inviteId, user]);

  async function accept() {
    if (!user?.email) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptTeacherInvite(
        inviteId,
        user.uid,
        user.email,
        user.displayName,
      );
      setAccepted(true);
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Could not accept this invitation.",
      );
    } finally {
      setAccepting(false);
    }
  }

  if (authLoading) {
    return <main className="accessPageMessage">Checking your account…</main>;
  }

  if (!user) {
    return (
      <main className="accessPageShell">
        <section className="accessCard">
          <p className="eyebrow">Teacher invitation</p>
          <h1>Join your teacher on InkLex</h1>
          <p>Sign in with the invited email address to continue.</p>
          <button
            className="primary"
            onClick={() =>
              navigate("/login", {
                state: { from: `${location.pathname}${location.search}` },
              })
            }
            type="button"
          >
            Sign in to accept
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="accessPageShell">
      <section className="accessCard">
        <p className="eyebrow">Teacher invitation</p>
        {accepted ? (
          <>
            <h1>You joined the teacher</h1>
            <p>You can now open student-only vocabulary links they share.</p>
            <Link className="primary accessLinkButton" to="/">
              Go to InkLex
            </Link>
          </>
        ) : (
          <>
            <h1>{invite?.teacherName ?? "Join your teacher"}</h1>
            {loading ? <p>Loading invitation…</p> : null}
            {invite && invite.status === "pending" ? (
              <>
                <p>
                  This invitation is for <strong>{invite.studentEmail}</strong> and
                  expires in seven days.
                </p>
                {user.email?.toLowerCase() !== invite.studentEmail ? (
                  <p className="accessError" role="alert">
                    Sign in as {invite.studentEmail} to accept this invitation.
                  </p>
                ) : null}
                <button
                  className="primary"
                  disabled={accepting || user.email?.toLowerCase() !== invite.studentEmail}
                  onClick={() => void accept()}
                  type="button"
                >
                  {accepting ? "Joining…" : "Accept invitation"}
                </button>
              </>
            ) : null}
            {invite && invite.status !== "pending" ? (
              <p>This invitation is {invite.status}.</p>
            ) : null}
          </>
        )}
        {error ? (
          <p className="accessError" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
