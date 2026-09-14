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
  const [loading, setLoading] = useState(!mockMode);

  useEffect(() => {
    if (mockMode) {
      setUser(mockUser);
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      getAuth(),
      (nextUser) => {
        setUser(nextUser ? toAuthUser(nextUser) : null);
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [mockMode]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
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
    [loading, mockMode, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
