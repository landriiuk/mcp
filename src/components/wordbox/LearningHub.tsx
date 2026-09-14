import type { LearningMode } from "../../lib/learningMode";
import {
  canStartPracticeFormat,
  PRACTICE_FORMATS,
  practiceFormatUnavailableHint,
} from "../../lib/practiceFormats";
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

  return (
    <div className="learningHubPage" aria-labelledby="learning-hub-title">
      <div className="learningHubHeader">
        <p id="learning-hub-title" className="learningHubLead">
          Choose how you want to practice.
        </p>
      </div>

      <div className="learningHubModes learningHubModesWide">
        {PRACTICE_FORMATS.map((format) => {
          const isQuest = format.pool === "quest";
          const canStart = canStartPracticeFormat(format, poolSize, folderWordCount);
          const unavailable = practiceFormatUnavailableHint(
            format,
            poolSize,
            folderWordCount,
          );
          const hint = canStart
            ? isQuest
              ? questHint
              : reviewHint
            : (unavailable ?? (isQuest ? questHint : reviewHint));
          const bullets = format.bullets.map((bullet) =>
            bullet.includes("3 correct")
              ? bullet.replace("3 correct", `${CORRECT_STREAK_TO_KNOWN} correct`)
              : bullet.includes(`Up to ${MAX_SESSION_SIZE}`)
                ? bullet
                : bullet,
          );

          return (
            <article
              className={`learningHubCard${preferredMode === format.id ? " isPreferred" : ""}`}
              key={format.id}
            >
              <div className="learningHubCardTop">
                <h3>{format.title}</h3>
                <span className="learningHubBadge">{format.badge}</span>
              </div>
              <p>{format.description}</p>
              <ul>
                {bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
              <p className="learningHubCardMeta">{hint}</p>
              <button
                className="primary"
                disabled={!canStart}
                onClick={() => onStart(format.id)}
                type="button"
              >
                Start {format.title}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
