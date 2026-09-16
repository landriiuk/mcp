import { useEffect, useMemo, useRef, useState } from "react";
import {
  listPublishedSnapshots,
  publishFolderSnapshot,
  revokeSharedSnapshot,
} from "../../data/api";
import type { Folder } from "../../types/card";
import type { UserRole } from "../../types/access";
import type {
  PublishedSnapshot,
  SharedSnapshotVisibility,
} from "../../types/sharedSnapshot";
import { SUPPORT_EMAIL } from "../../lib/support";
import { sharePath } from "../../utils/routes";

type ShareFolderModalProps = {
  uid: string;
  folder: Folder;
  role: UserRole;
  onClose: () => void;
};

export function ShareFolderModal({
  uid,
  folder,
  role,
  onClose,
}: ShareFolderModalProps) {
  const [snapshots, setSnapshots] = useState<PublishedSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"publish" | "revoke" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [visibility, setVisibility] =
    useState<SharedSnapshotVisibility>(
      role === "teacher" || role === "admin" ? "students" : "public",
    );
  const dialogRef = useRef<HTMLElement>(null);

  const activeSnapshot = useMemo(
    () => snapshots.find((snapshot) => snapshot.status === "active") ?? null,
    [snapshots],
  );
  const shareUrl = activeSnapshot
    ? `${window.location.origin}${sharePath(activeSnapshot.id)}`
    : "";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSnapshots([]);
    setLoadFailed(false);
    setError(null);
    listPublishedSnapshots(uid, folder.id)
      .then((result) => {
        if (!cancelled) {
          setSnapshots(result);
          setError(null);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load sharing details.");
          setLoadFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [folder.id, loadVersion, uid]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !action) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [action, onClose]);

  async function publish() {
    setAction("publish");
    setError(null);
    try {
      const result = await publishFolderSnapshot(uid, folder.id, visibility);
      setSnapshots((current) => [
        {
          id: result.shareId,
          sourceFolderId: folder.id,
          folderName: result.folderName,
          wordCount: result.wordCount,
          publishedAt: new Date().toISOString(),
          status: "active",
          visibility: result.visibility,
        },
        ...current,
      ]);
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Could not create a share link.",
      );
    } finally {
      setAction(null);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the link. Select and copy it manually.");
    }
  }

  async function revoke() {
    if (!activeSnapshot) return;
    if (
      !window.confirm(
        "Revoke this link? Anyone using it will immediately lose access.",
      )
    ) {
      return;
    }
    setAction("revoke");
    setError(null);
    try {
      await revokeSharedSnapshot(uid, activeSnapshot.id);
      setSnapshots((current) =>
        current.map((snapshot) =>
          snapshot.id === activeSnapshot.id
            ? { ...snapshot, status: "revoked" }
            : snapshot,
        ),
      );
    } catch {
      setError("Could not revoke this link.");
    } finally {
      setAction(null);
    }
  }

  return (
    <section
      ref={dialogRef}
      className="shareModal"
      aria-labelledby="share-folder-title"
      aria-modal="true"
      role="dialog"
      tabIndex={-1}
    >
      <header className="shareModalHeader">
        <div>
          <p className="eyebrow">Share folder</p>
          <h2 id="share-folder-title">{folder.name}</h2>
        </div>
        <button
          className="shareModalClose"
          disabled={Boolean(action)}
          onClick={onClose}
          type="button"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      {loading ? <p className="shareModalStatus">Loading sharing details…</p> : null}

      {!loading && loadFailed ? (
        <>
          <p className="shareModalLead">
            Sharing details could not be loaded. No new link was created.
          </p>
          <button
            className="shareRetryButton"
            onClick={() => setLoadVersion((version) => version + 1)}
            type="button"
          >
            Retry
          </button>
        </>
      ) : null}

      {!loading && !loadFailed && activeSnapshot ? (
        <>
          <p className="shareModalLead">
            {activeSnapshot.visibility === "students"
              ? `Only your students can open these ${activeSnapshot.wordCount} words after signing in.`
              : `Anyone with this link can preview ${activeSnapshot.wordCount} words and add a separate copy.`}
          </p>
          <div className="shareLinkRow">
            <input
              aria-label="Share link"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={shareUrl}
            />
            <button className="primary" onClick={() => void copyLink()} type="button">
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <button
            className="shareRevokeButton"
            disabled={Boolean(action)}
            onClick={() => void revoke()}
            type="button"
          >
            {action === "revoke" ? "Revoking…" : "Revoke link"}
          </button>
        </>
      ) : null}

      {!loading && !loadFailed && !activeSnapshot ? (
        <>
          <p className="shareModalLead">
            Create a read-only snapshot. Later changes to this folder will not
            change the shared copy.
          </p>
          {role === "teacher" || role === "admin" ? (
            <fieldset className="shareVisibilityOptions">
              <legend>Who can open this link?</legend>
              <label>
                <input
                  checked={visibility === "students"}
                  name="share-visibility"
                  onChange={() => setVisibility("students")}
                  type="radio"
                />
                <span>
                  <strong>My students only</strong>
                  <small>Students who accepted your invitation.</small>
                </span>
              </label>
              <label>
                <input
                  checked={visibility === "public"}
                  name="share-visibility"
                  onChange={() => setVisibility("public")}
                  type="radio"
                />
                <span>
                  <strong>Anyone with the link</strong>
                  <small>No InkLex teacher relationship required.</small>
                </span>
              </label>
            </fieldset>
          ) : (
            <p className="shareVisibilityHint">
              This creates a public link. To share only with your class, write to{" "}
              {SUPPORT_EMAIL}.
            </p>
          )}
          <button
            className="primary sharePublishButton"
            disabled={Boolean(action)}
            onClick={() => void publish()}
            type="button"
          >
            {action === "publish" ? "Creating link…" : "Create share link"}
          </button>
        </>
      ) : null}

      {error && !loadFailed ? (
        <p className="shareModalError" aria-live="polite" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
