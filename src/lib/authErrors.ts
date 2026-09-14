import { FirebaseError } from "firebase/app";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled.",
  "auth/popup-blocked": "Allow pop-ups to sign in with Google.",
  "auth/too-many-requests": "Too many attempts. Try again later.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/weak-password": "Use a password with at least 6 characters.",
};

export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return AUTH_ERROR_MESSAGES[error.code] ?? "Could not sign in. Try again.";
  }
  return error instanceof Error ? error.message : "Could not sign in. Try again.";
}
