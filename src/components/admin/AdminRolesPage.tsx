import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { assignUserRole, listUserProfiles } from "../../data/api";
import { useAuth } from "../../hooks/useAuth";
import type { UserProfile, UserRole } from "../../types/access";
import { Input } from "../ui/Input";

export function AdminRolesPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUserProfiles()
      .then(setProfiles)
      .catch(() => setError("Could not load users."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return profiles.filter((profile) =>
      `${profile.email} ${profile.displayName ?? ""} ${profile.uid}`
        .toLowerCase()
        .includes(value),
    );
  }, [profiles, query]);

  async function changeRole(profile: UserProfile, role: UserRole) {
    if (!user || profile.uid === user.uid || profile.role === role) return;
    setSavingUid(profile.uid);
    setError(null);
    try {
      await assignUserRole(user.uid, profile.uid, role);
      setProfiles((current) =>
        current.map((entry) =>
          entry.uid === profile.uid ? { ...entry, role } : entry,
        ),
      );
    } catch (roleError) {
      setError(
        roleError instanceof Error
          ? roleError.message
          : "Could not update this role.",
      );
    } finally {
      setSavingUid(null);
    }
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
          <p className="eyebrow">Administration</p>
          <h1>User roles</h1>
          <p>
            New accounts stay regular users. Promote someone to teacher after
            they email support. This screen does not expose private vocabulary.
          </p>
        </section>

        <section className="managementPanel">
          <Input
            aria-label="Search users"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by email, name, or UID"
            type="search"
            value={query}
          />
          {error ? (
            <p className="accessError" role="alert">
              {error}
            </p>
          ) : null}
          {loading ? <p>Loading users…</p> : null}
          <div className="managementList">
            {filtered.map((profile) => {
              const isCurrentAdmin = profile.uid === user?.uid;
              return (
                <article className="managementRow" key={profile.uid}>
                  <div>
                    <strong>{profile.displayName || profile.email || "User"}</strong>
                    <span>{profile.email || profile.uid}</span>
                  </div>
                  <select
                    aria-label={`Role for ${profile.email || profile.uid}`}
                    disabled={isCurrentAdmin || savingUid === profile.uid}
                    onChange={(event) =>
                      void changeRole(profile, event.target.value as UserRole)
                    }
                    value={profile.role}
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </article>
              );
            })}
          </div>
          {!loading && filtered.length === 0 ? (
            <p className="managementEmpty">No matching users.</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
