import { clearJsonSession, loadJsonSession, saveJsonSession } from "./sessionPersist";

/** Practice formats available from Learning Hub. */
export type LearningMode = "quest" | "quest-reverse" | "quest-typed" | "review";

const STORAGE_KEY = "inklex.learningMode";
const ACTIVE_SESSION_KEY = "inklex.learning.active";

const VALID_MODES = new Set<LearningMode>([
  "quest",
  "quest-reverse",
  "quest-typed",
  "review",
]);

export type ActiveLearningSession = {
  scope: string;
  mode: LearningMode;
};

export function readLearningMode(): LearningMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && VALID_MODES.has(value as LearningMode)) {
      return value as LearningMode;
    }
  } catch {
    // ignore
  }
  return "quest";
}

export function writeLearningMode(mode: LearningMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

export function readActiveLearningSession(): ActiveLearningSession | null {
  const value = loadJsonSession<ActiveLearningSession>(ACTIVE_SESSION_KEY);
  if (!value) {
    return null;
  }
  if (typeof value.scope !== "string" || !VALID_MODES.has(value.mode)) {
    return null;
  }
  return value;
}

export function writeActiveLearningSession(scope: string, mode: LearningMode) {
  saveJsonSession(ACTIVE_SESSION_KEY, { scope, mode } satisfies ActiveLearningSession);
}

export function clearActiveLearningSession() {
  clearJsonSession(ACTIVE_SESSION_KEY);
}
