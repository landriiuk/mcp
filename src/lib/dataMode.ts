/**
 * Data-mode flags (no Firebase SDK imports).
 * Safe to import from the mock path.
 */

export function useMockDb(): boolean {
  return import.meta.env.VITE_USE_MOCK_DB === "true";
}

export function useFirestoreEmulator(): boolean {
  if (useMockDb()) {
    return false;
  }
  return import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true";
}

export function isDataStoreConfigured(): boolean {
  if (useMockDb()) {
    return true;
  }

  if (useFirestoreEmulator()) {
    return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);
  }

  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID,
  );
}

/** @deprecated use isDataStoreConfigured */
export function isFirebaseConfigured(): boolean {
  return isDataStoreConfigured();
}
