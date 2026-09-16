import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { copySharedSnapshot, getPublicSnapshot } from "../../data/api";
import { useAuth } from "../../hooks/useAuth";
import type { SharedSnapshot } from "../../types/sharedSnapshot";
import { folderPath } from "../../utils/routes";

export function SharePreviewPage() {
  const { shareId = "" } = useParams();
  const { loading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [snapshot, setSnapshot] = useState<SharedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoImportStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    autoImportStarted.current = false;
    setLoading(true);
    setSnapshot(null);
    setCopying(false);
    setError(null);
    getPublicSnapshot(shareId)
      .then((result) => {
        if (!cancelled) setSnapshot(result);
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot(null);
          setError("This shared folder is unavailable or the link was revoked.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  async function addToInkLex() {
    if (!user) {
      navigate("/login", {
        state: { from: `${location.pathname}?add=1` },
      });
      return;
    }

    await copyIntoAccount(user.uid);
  }

  async function copyIntoAccount(uid: string) {
    setCopying(true);
    setError(null);
    try {
      const result = await copySharedSnapshot(uid, shareId);
      navigate(folderPath(result.folderId), { replace: true });
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Could not add this folder.",
      );
    } finally {
      setCopying(false);
    }
  }

  useEffect(() => {
    const shouldAutoImport = new URLSearchParams(location.search).get("add") === "1";
    if (
      !shouldAutoImport ||
      authLoading ||
      loading ||
      !snapshot ||
      !user ||
      autoImportStarted.current
    ) {
      return;
    }
    autoImportStarted.current = true;
    void copyIntoAccount(user.uid);
  }, [authLoading, loading, location.search, snapshot, user]);

  return (
    <main className="sharePreviewShell">
      <header className="sharePreviewTopbar">
        <Link className="sharePreviewBrand" to="/">
          <img src="/favi.png" alt="" width={44} height={44} />
          <span>InkLex</span>
        </Link>
        {!authLoading && user ? (
          <span className="sharePreviewAccount">
            {user.displayName || user.email || "Signed in"}
          </span>
        ) : null}
      </header>

      <section className="sharePreviewContent">
        {loading ? (
          <div className="sharePreviewMessage">Loading shared folder…</div>
        ) : null}

        {!loading && !snapshot ? (
          <div className="sharePreviewMessage">
            <p className="eyebrow">Shared folder</p>
            <h1>Link unavailable</h1>
            <p>{error}</p>
            <Link className="primary sharePreviewHome" to="/">
              Go to InkLex
            </Link>
          </div>
        ) : null}

        {!loading && snapshot ? (
          <>
            <div className="sharePreviewHero">
              <div>
                <p className="eyebrow">Shared InkLex folder</p>
                <h1>{snapshot.meta.folderName}</h1>
                <p>
                  {snapshot.words.length}{" "}
                  {snapshot.words.length === 1 ? "word" : "words"} · read-only
                  snapshot
                </p>
              </div>
              <button
                className="primary sharePreviewAdd"
                disabled={authLoading || copying}
                onClick={() => void addToInkLex()}
                type="button"
              >
                {copying
                  ? "Adding…"
                  : user
                    ? "Add to my InkLex"
                    : "Sign in to add"}
              </button>
            </div>

            {error ? (
              <p className="sharePreviewError" role="alert">
                {error}
              </p>
            ) : null}

            <div className="sharePreviewGrid">
              {snapshot.words.map((entry) => (
                <article className="sharePreviewCard" key={entry.id}>
                  <h2>{entry.word}</h2>
                  <p className="sharePreviewMeaning">{entry.meaning}</p>
                  {entry.example ? (
                    <p className="sharePreviewExample">{entry.example}</p>
                  ) : null}
                  {entry.tags.length > 0 ? (
                    <div className="sharePreviewTags">
                      {entry.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
