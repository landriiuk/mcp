import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  isDataStoreConfigured,
  useFirestoreEmulator,
  useMockDb,
} from "./dataMode";

export {
  isDataStoreConfigured,
  isFirebaseConfigured,
  useFirestoreEmulator,
  useMockDb,
} from "./dataMode";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let emulatorConnected = false;

export function getFirebaseApp(): FirebaseApp {
  if (useMockDb()) {
    throw new Error("Mock DB is enabled — Firebase must not be initialized.");
  }

  if (!isDataStoreConfigured()) {
    throw new Error(
      "Firebase is not configured. Set VITE_FIREBASE_* in .env (see .env.example).",
    );
  }

  if (useFirestoreEmulator() && import.meta.env.PROD) {
    throw new Error(
      "VITE_USE_FIREBASE_EMULATOR must not be enabled in production builds.",
    );
  }

  if (!app) {
    app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  }

  return app;
}

export function getDb(): Firestore {
  if (useMockDb()) {
    throw new Error("Mock DB is enabled — Firestore must not be used.");
  }

  if (!db) {
    db = getFirestore(getFirebaseApp());

    if (useFirestoreEmulator() && !emulatorConnected) {
      const host = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || "127.0.0.1";
      const port = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);
      connectFirestoreEmulator(db, host, port);
      emulatorConnected = true;

      if (import.meta.env.DEV) {
        console.info(
          `[InkLex] Firestore emulator → ${host}:${port} (project ${firebaseConfig.projectId}).`,
        );
      }
    }
  }

  return db;
}
