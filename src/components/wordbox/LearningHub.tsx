import type { LearningMode } from "../../lib/learningMode";
import { CORRECT_STREAK_TO_KNOWN, MAX_SESSION_SIZE } from "../../utils/reviewAlgorithm";

type LearningHubProps = {
  dueCount: number;
  sessionSize: number;
  poolSize: number;
  folderWordCount: number;
  preferredMode: LearningMode;
  onStart: (mode: LearningMode) => void;
};

export function LearningHub({
  dueCount,
  sessionSize,
  poolSize,
  folderWordCount,
  preferredMode,
  onStart,
}: LearningHubProps) {
  const questHint =
    poolSize > 0
      ? dueCount > 0
        ? `${dueCount} due first · up to ${sessionSize} of ${poolSize} Cards/Learning`
        : `${sessionSize} of ${poolSize} Cards/Learning ready`
      : "No Cards or Learning words in this folder";

  const reviewHint =
    folderWordCount > 0
      ? `All ${folderWordCount} words in this folder`
      : "No words in this folder yet";

  const canStartQuest = sessionSize > 0;
  const canStartReview = folderWordCount > 0;

  return (
    <div className="learningHubPage" aria-labelledby="learning-hub-title">
      <div className="learningHubHeader">
        <p id="learning-hub-title" className="learningHubLead">
          Choose how you want to practice.
        </p>
      </div>

      <div className="learningHubModes">
        <article
          className={`learningHubCard${preferredMode === "quest" ? " isPreferred" : ""}`}
        >
          <div className="learningHubCardTop">
            <h3>Quest</h3>
            <span className="learningHubBadge">Multiple choice</span>
          </div>
          <p>
            See the word, then pick the correct meaning from four options. Fast recognition
            practice — good for warming up and checking what you already know.
          </p>
          <ul>
            <li>Up to {MAX_SESSION_SIZE} random Cards/Learning words per session</li>
            <li>Due words first, then the rest of the pool — start another quest anytime</li>
            <li>
              {CORRECT_STREAK_TO_KNOWN} correct in a row → Known; wrong resets the streak
            </li>
          </ul>
          <p className="learningHubCardMeta">{questHint}</p>
          <button
            className="primary"
            disabled={!canStartQuest}
            onClick={() => onStart("quest")}
            type="button"
          >
            Start Quest
          </button>
        </article>

        <article
          className={`learningHubCard${preferredMode === "review" ? " isPreferred" : ""}`}
        >
          <div className="learningHubCardTop">
            <h3>Review</h3>
            <span className="learningHubBadge">Self-grade</span>
          </div>
          <p>
            Cards alternate between word and meaning. Tap to reveal, then rate how well you
            recalled it: Bad or Good. Next skips without rating.
          </p>
          <ul>
            <li>All words in the current folder</li>
            <li>Prompt alternates: word ↔ meaning (no example)</li>
            <li>Bad / Good update the schedule; Next skips</li>
          </ul>
          <p className="learningHubCardMeta">{reviewHint}</p>
          <button
            className="primary"
            disabled={!canStartReview}
            onClick={() => onStart("review")}
            type="button"
          >
            Start Review
          </button>
        </article>
      </div>
    </div>
  );
}
