import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { useMockDb } from "../lib/dataMode";
import { getAuth } from "../lib/firebase";
import { ensureUserAccess } from "../data/api";
import type { UserProfile } from "../types/access";
import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
} from "./AuthContext";

export const MOCK_USER_UID = "local-dev";

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    isMock: false,
  };
}

const mockUser: AuthUser = {
  uid: MOCK_USER_UID,
  email: "local@inklex.dev",
  displayName: "Local development",
  photoURL: null,
  isMock: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const mockMode = useMockDb();
  const [user, setUser] = useState<AuthUser | null>(mockMode ? mockUser : null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mockMode) {
      setUser(mockUser);
      ensureUserAccess(mockUser.uid, mockUser.email, mockUser.displayName)
        .then(setProfile)
        .finally(() => setLoading(false));
      return;
    }

    const unsubscribe = onAuthStateChanged(
      getAuth(),
      async (nextUser) => {
        const nextAuthUser = nextUser ? toAuthUser(nextUser) : null;
        setUser(nextAuthUser);
        if (!nextAuthUser) {
          setProfile(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          setProfile(
            await ensureUserAccess(
              nextAuthUser.uid,
              nextAuthUser.email,
              nextAuthUser.displayName,
            ),
          );
        } catch (error) {
          console.error("[InkLex] access profile load failed", error);
          setProfile(null);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setUser(null);
        setProfile(null);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [mockMode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      role: profile?.role ?? "student",
      loading,
      async refreshAccess() {
        if (!user) return;
        setProfile(
          await ensureUserAccess(user.uid, user.email, user.displayName),
        );
      },
      async signInWithGoogle() {
        if (mockMode) return;
        await signInWithPopup(getAuth(), new GoogleAuthProvider());
      },
      async signInWithEmail(email, password) {
        if (mockMode) return;
        await signInWithEmailAndPassword(getAuth(), email.trim(), password);
      },
      async signUpWithEmail(email, password) {
        if (mockMode) return;
        await createUserWithEmailAndPassword(getAuth(), email.trim(), password);
      },
      async signOut() {
        if (mockMode) return;
        await firebaseSignOut(getAuth());
      },
    }),
    [loading, mockMode, profile, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
