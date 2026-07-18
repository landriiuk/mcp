import { clearJsonSession, loadJsonSession, saveJsonSession } from "./sessionPersist";

export type LearningMode = "quest" | "review";

const STORAGE_KEY = "inklex.learningMode";
const ACTIVE_SESSION_KEY = "inklex.learning.active";

export type ActiveLearningSession = {
  scope: string;
  mode: LearningMode;
};

export function readLearningMode(): LearningMode {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "quest" || value === "review") {
      return value;
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
  if (
    typeof value.scope !== "string" ||
    (value.mode !== "quest" && value.mode !== "review")
  ) {
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
