import { createContext } from "react";
import type { UserProfile, UserRole } from "../types/access";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isMock: boolean;
};

export type AuthContextValue = {
  user: AuthUser | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  refreshAccess: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
