import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { authErrorMessage } from "../../lib/authErrors";
import { Input } from "../ui/Input";

type AuthMode = "login" | "signup";

export function AuthPage({ mode }: { mode: AuthMode }) {
  const { loading, user, signInWithEmail, signInWithGoogle, signUpWithEmail } =
    useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"google" | "email" | null>(null);

  const from =
    typeof location.state === "object" &&
    location.state &&
    "from" in location.state &&
    typeof location.state.from === "string"
      ? location.state.from
      : "/";

  useEffect(() => {
    setError(null);
    setPassword("");
  }, [mode]);

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function run(action: "google" | "email", callback: () => Promise<void>) {
    setSubmitting(action);
    setError(null);
    try {
      await callback();
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setSubmitting(null);
    }
  }

  const isSignup = mode === "signup";

  return (
    <main className="authShell">
      <section className="authCard" aria-labelledby="auth-title">
        <div className="authBrand">
          <img src="/favi.png" alt="" width={56} height={56} />
          <span>InkLex</span>
        </div>
        <div>
          <p className="eyebrow">Your personal lexicon</p>
          <h1 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="authLead">
            {isSignup
              ? "Save your vocabulary and keep it synced across devices."
              : "Sign in to continue learning your words."}
          </p>
        </div>

        <button
          className="authGoogle"
          disabled={Boolean(submitting)}
          onClick={() => void run("google", signInWithGoogle)}
          type="button"
        >
          {submitting === "google" ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="authDivider">
          <span>or</span>
        </div>

        <form
          className="authForm"
          onSubmit={(event) => {
            event.preventDefault();
            void run("email", () =>
              isSignup
                ? signUpWithEmail(email, password)
                : signInWithEmail(email, password),
            );
          }}
        >
          <label>
            Email
            <Input
              autoComplete="email"
              invalid={Boolean(error)}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <Input
              autoComplete={isSignup ? "new-password" : "current-password"}
              invalid={Boolean(error)}
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              required
              type="password"
              value={password}
            />
          </label>
          {error ? (
            <p className="authError" role="alert">
              {error}
            </p>
          ) : null}
          <button className="primary authSubmit" disabled={Boolean(submitting)} type="submit">
            {submitting === "email"
              ? "Please wait…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="authSwitch">
          {isSignup ? "Already have an account?" : "New to InkLex?"}{" "}
          <button
            className="authLink"
            onClick={() =>
              navigate(isSignup ? "/login" : "/signup", {
                state: { from },
              })
            }
            type="button"
          >
            {isSignup ? "Sign in" : "Create account"}
          </button>
        </p>
      </section>
    </main>
  );
}
