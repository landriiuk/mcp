import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  clearPersistedPracticeSession,
  usePracticeSession,
  type PracticeEndEarlyControls,
} from "../../hooks/usePracticeSession";
import {
  answersMatch,
  buildMeaningOptions,
  buildWordOptions,
  CORRECT_STREAK_TO_KNOWN,
  type ReviewGrade,
} from "../../utils/reviewAlgorithm";
import {
  buildDeckForFormat,
  getPracticeFormat,
  QUEST_SESSION_KEYS,
  type PracticeFormatId,
} from "../../lib/practiceFormats";
import type { WordboxCard } from "./types";
import { PronounceButton } from "./PronounceButton";

export type { PracticeEndEarlyControls as ReviewEndEarlyControls };

export function clearPersistedLearningSession() {
  clearPersistedPracticeSession(QUEST_SESSION_KEYS.quest);
  clearPersistedPracticeSession(QUEST_SESSION_KEYS["quest-reverse"]);
  clearPersistedPracticeSession(QUEST_SESSION_KEYS["quest-typed"]);
}

export function clearPersistedReviewSession() {
  clearPersistedPracticeSession(QUEST_SESSION_KEYS.review);
}

type PromptSide = "wordToMeaning" | "meaningToWord";

function assignPromptSides(deck: WordboxCard[]): Record<string, PromptSide> {
  const sides: Record<string, PromptSide> = {};
  deck.forEach((card, index) => {
    sides[card.id] = index % 2 === 0 ? "wordToMeaning" : "meaningToWord";
  });
  return sides;
}

export type ReviewSessionStats = {
  due: number;
  saved: number;
  known: number;
};

type PracticeSessionProps = {
  formatId: PracticeFormatId;
  cards: WordboxCard[];
  optionPool?: WordboxCard[];
  sessionScope: string;
  onReviewGrade: (cardId: string, grade: ReviewGrade) => void | Promise<void>;
  onExitLearning: () => void;
  hasAheadOfSchedule?: boolean;
  onEndEarlyControlsChange?: (controls: PracticeEndEarlyControls | null) => void;
  stats?: ReviewSessionStats;
};

export function PracticeSession({
  formatId,
  cards,
  optionPool = cards,
  sessionScope,
  onReviewGrade,
  onExitLearning,
  hasAheadOfSchedule = false,
  onEndEarlyControlsChange,
  stats,
}: PracticeSessionProps) {
  const format = getPracticeFormat(formatId);
  const sessionKey = QUEST_SESSION_KEYS[formatId];
  const [cardSides, setCardSides] = useState<Record<string, PromptSide>>({});
  const [choiceState, setChoiceState] = useState<"idle" | "selected" | "correct" | "wrong">(
    "idle",
  );
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [optionSeed, setOptionSeed] = useState(0);
  const [exampleRevealed, setExampleRevealed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [typedFeedback, setTypedFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [pendingTypedGrade, setPendingTypedGrade] = useState<ReviewGrade | null>(null);
  const typedInputRef = useRef<HTMLInputElement>(null);
  const typedContinueRef = useRef<HTMLButtonElement>(null);

  const session = usePracticeSession({
    sessionKey,
    formatId,
    sessionScope,
    cards,
    buildDeck: (pool, options) => buildDeckForFormat(formatId, pool, options),
    onReviewGrade,
    onEndEarlyControlsChange,
    initialFormatState: (deck) =>
      formatId === "review" ? { cardSides: assignPromptSides(deck) } : {},
    onFormatStateChange: (state) => {
      if (formatId === "review" && state.cardSides) {
        setCardSides(state.cardSides as Record<string, PromptSide>);
      }
    },
  });

  const {
    currentCard,
    sessionDeck,
    sessionQueue,
    progressCurrent,
    progressTotal,
    isGrading,
    isTransitioning,
    isSessionComplete,
    isEarlyExit,
    isPerfectSession,
    knownWell,
    needsWork,
    skippedCards,
    canSkip,
    canEndEarly,
    tipsOpen,
    setTipsOpen,
    tipsDockRef,
    settleAttempt,
    handleSkip,
    handleEndEarly,
    continueRemaining,
    restartSession,
    scheduleTimeout,
    isBusy,
  } = session;

  const liveCard =
    currentCard == null
      ? null
      : (cards.find((card) => card.id === currentCard.id) ?? currentCard);
  const liveStreak = liveCard ? Math.max(0, Number(liveCard.correct_streak) || 0) : 0;
  const streakLabel =
    liveCard && liveCard.status !== "known"
      ? liveStreak > 0
        ? `${liveStreak}/${CORRECT_STREAK_TO_KNOWN} toward Known`
        : `${CORRECT_STREAK_TO_KNOWN} correct in a row → Known`
      : null;

  const meaningOptions = useMemo(() => {
    if (!currentCard || formatId !== "quest") {
      return [];
    }
    void optionSeed;
    return buildMeaningOptions(currentCard.meaning, optionPool, currentCard.id);
  }, [currentCard, optionPool, optionSeed, formatId]);

  const wordOptions = useMemo(() => {
    if (!currentCard || formatId !== "quest-reverse") {
      return [];
    }
    void optionSeed;
    return buildWordOptions(currentCard.word, optionPool, currentCard.id);
  }, [currentCard, optionPool, optionSeed, formatId]);

  function resetPromptUi() {
    setChoiceState("idle");
    setSelectedOption(null);
    setExampleRevealed(false);
    setRevealed(false);
    setTypedValue("");
    setTypedFeedback("idle");
    setPendingTypedGrade(null);
    setOptionSeed((value) => value + 1);
  }

  function finishAttempt(grade: ReviewGrade, revealMs: number) {
    scheduleTimeout(() => {
      settleAttempt(grade, { transitionMs: 160 });
      resetPromptUi();
    }, revealMs);
  }

  function continueTypedAfterFeedback() {
    if (!pendingTypedGrade || isBusy) {
      return;
    }
    const grade = pendingTypedGrade;
    setPendingTypedGrade(null);
    settleAttempt(grade, { transitionMs: 160 });
    resetPromptUi();
  }

  function handleMcqSelect(option: string, correctValue: string) {
    if (!currentCard || isBusy || choiceState !== "idle") {
      return;
    }
    const isCorrect = answersMatch(option, correctValue);
    setSelectedOption(option);
    setChoiceState("selected");

    scheduleTimeout(() => {
      setChoiceState(isCorrect ? "correct" : "wrong");
      finishAttempt(isCorrect ? "good" : "again", isCorrect ? 280 : 420);
    }, 120);
  }

  function handleTypedSubmit() {
    if (!currentCard || isBusy) {
      return;
    }

    // Wrong answer: wait for the learner to review, then continue manually.
    if (typedFeedback === "wrong" && pendingTypedGrade) {
      continueTypedAfterFeedback();
      return;
    }

    if (typedFeedback !== "idle") {
      return;
    }

    const isCorrect = answersMatch(typedValue, currentCard.word);
    if (isCorrect) {
      setTypedFeedback("correct");
      finishAttempt("good", 280);
      return;
    }

    setTypedFeedback("wrong");
    setPendingTypedGrade("again");
  }

  function handleReviewGrade(grade: ReviewGrade) {
    if (!currentCard || isBusy || !revealed) {
      return;
    }
    settleAttempt(grade, { transitionMs: 160 });
    resetPromptUi();
  }

  // Keyboard: 1–4 for MCQ, S skip, Esc tips
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        if (event.key === "Escape") {
          setTipsOpen(false);
        }
        return;
      }

      if (event.key === "Escape") {
        setTipsOpen(false);
        return;
      }

      if (!currentCard || isBusy || isSessionComplete) {
        return;
      }

      if (event.key === "s" || event.key === "S") {
        event.preventDefault();
        handleSkip();
        return;
      }

      if (formatId === "quest" || formatId === "quest-reverse") {
        const options = formatId === "quest" ? meaningOptions : wordOptions;
        const index = Number(event.key) - 1;
        if (index >= 0 && index < options.length && choiceState === "idle") {
          event.preventDefault();
          const correct =
            formatId === "quest" ? currentCard.meaning : currentCard.word;
          handleMcqSelect(options[index], correct);
        }
      }

      if (formatId === "review" && revealed && !isGrading) {
        if (event.key === "1") {
          event.preventDefault();
          handleReviewGrade("again");
        } else if (event.key === "2") {
          event.preventDefault();
          handleReviewGrade("good");
        } else if (event.key === "3") {
          event.preventDefault();
          handleReviewGrade("easy");
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    if (formatId !== "quest-typed" || !currentCard || isBusy) {
      return;
    }
    if (typedFeedback === "idle") {
      typedInputRef.current?.focus();
      return;
    }
    if (typedFeedback === "wrong") {
      typedContinueRef.current?.focus();
    }
  }, [formatId, currentCard, isBusy, typedFeedback]);

  const currentSide =
    currentCard && formatId === "review"
      ? (cardSides[currentCard.id] ?? "wordToMeaning")
      : "wordToMeaning";
  const promptText =
    currentCard == null
      ? ""
      : currentSide === "wordToMeaning"
        ? currentCard.word
        : currentCard.meaning;
  const answerText =
    currentCard == null
      ? ""
      : currentSide === "wordToMeaning"
        ? currentCard.meaning
        : currentCard.word;
  const revealHint =
    currentSide === "wordToMeaning" ? "Tap to reveal meaning" : "Tap to reveal word";

  function renderMcqOptions(
    options: string[],
    correctValue: string,
  ): ReactNode {
    if (!currentCard) {
      return null;
    }
    return (
      <div className="reviewOptions" role="group" aria-label="Answer options">
        {options.map((option, index) => {
          const isSelected = selectedOption === option;
          const isCorrectOption = answersMatch(option, correctValue);
          let optionClass = "reviewOption";
          if (choiceState === "selected" && isSelected) {
            optionClass += " isSelected";
          } else if (choiceState === "correct" && isSelected) {
            optionClass += " isCorrect";
          } else if (choiceState === "wrong" && isSelected) {
            optionClass += " isWrong";
          } else if (choiceState === "wrong" && isCorrectOption) {
            optionClass += " isCorrect";
          }
          return (
            <button
              className={optionClass}
              disabled={choiceState !== "idle" || isBusy}
              key={option}
              onClick={() => handleMcqSelect(option, correctValue)}
              type="button"
            >
              <span className="reviewOptionKey" aria-hidden="true">
                {index + 1}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    );
  }

  function renderCardActions() {
    const actionsLocked =
      isBusy ||
      choiceState !== "idle" ||
      typedFeedback !== "idle" ||
      (formatId === "review" && isGrading);
    return (
      <div className="reviewCardActions">
        <button
          className={formatId === "review" ? "gradeNext" : "ghost"}
          disabled={!canSkip || actionsLocked}
          onClick={handleSkip}
          title={
            sessionQueue.length <= 1
              ? `Last card — ${format.skipLabel.toLowerCase()} to finish`
              : "Move this word to the end of the session"
          }
          type="button"
        >
          {format.skipLabel}
        </button>
        {formatId === "review" ? null : (
          <button
            className="ghost reviewEndEarly"
            disabled={!canEndEarly || actionsLocked}
            onClick={handleEndEarly}
            type="button"
          >
            {format.endEarlyLabel}
          </button>
        )}
      </div>
    );
  }

  function renderActiveCard() {
    if (!currentCard) {
      return null;
    }

    if (formatId === "review") {
      return (
        <div className="reviewShell">
          <article className={`reviewFlipCard${revealed ? " isRevealed" : ""}`}>
            <div className="reviewCardPronounce">
              <PronounceButton word={currentCard.word} compact />
            </div>
            {streakLabel ? <p className="questStreak">{streakLabel}</p> : null}
            <button
              className="reviewFlipFace"
              onClick={() => {
                if (!revealed && !isBusy) {
                  setRevealed(true);
                }
              }}
              type="button"
              disabled={revealed || isBusy}
            >
              <p className="reviewWord">{promptText}</p>
              {!revealed ? (
                <p className="reviewFlipHint">{revealHint}</p>
              ) : (
                <div className="reviewFlipReveal">
                  <p className="reviewFlipMeaning">{answerText}</p>
                </div>
              )}
            </button>

            {revealed ? (
              <div className="reviewGradeBlock">
                <p className="reviewRecallPrompt">How well did you recall it?</p>
                <div className="gradePillsRates" role="group" aria-label="Rate recall">
                  <button
                    className="gradePill gradeAgain"
                    disabled={isBusy}
                    onClick={() => handleReviewGrade("again")}
                    type="button"
                  >
                    Bad
                  </button>
                  <button
                    className="gradePill gradeGood"
                    disabled={isBusy}
                    onClick={() => handleReviewGrade("good")}
                    type="button"
                  >
                    Good
                  </button>
                  <button
                    className="gradePill gradeEasy"
                    disabled={isBusy}
                    onClick={() => handleReviewGrade("easy")}
                    type="button"
                  >
                    Easy
                  </button>
                </div>
              </div>
            ) : null}

            {renderCardActions()}
          </article>
          {stats ? (
            <aside className="reviewStats" aria-label="Session stats">
              <div className="reviewStat">
                <strong>{stats.due}</strong>
                <span>cards due today</span>
              </div>
              <div className="reviewStat">
                <strong>{stats.saved}</strong>
                <span>saved words</span>
              </div>
              <div className="reviewStat">
                <strong>{stats.known}</strong>
                <span>known words</span>
              </div>
            </aside>
          ) : null}
        </div>
      );
    }

    if (formatId === "quest-typed") {
      const waitingAfterWrong = typedFeedback === "wrong" && pendingTypedGrade != null;
      return (
        <article className="reviewCard">
          <div className="reviewCardPronounce">
            <PronounceButton word={currentCard.word} compact />
          </div>
          {streakLabel ? <p className="questStreak">{streakLabel}</p> : null}
          <p className="reviewPrompt">Type the word for this meaning</p>
          <p className="reviewWord reviewWordMeaning">{currentCard.meaning}</p>
          <form
            className="typedRecallForm"
            onSubmit={(event) => {
              event.preventDefault();
              handleTypedSubmit();
            }}
          >
            <input
              aria-label="Type the word"
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              className={`typedRecallInput${
                typedFeedback === "correct"
                  ? " isCorrect"
                  : typedFeedback === "wrong"
                    ? " isWrong"
                    : ""
              }`}
              disabled={isBusy || typedFeedback !== "idle"}
              onChange={(event) => setTypedValue(event.target.value)}
              placeholder="Type the word…"
              ref={typedInputRef}
              spellCheck={false}
              type="text"
              value={typedValue}
            />
            {waitingAfterWrong ? (
              <p className="typedRecallAnswer" role="status">
                Answer: <strong>{currentCard.word}</strong>
              </p>
            ) : null}
            {waitingAfterWrong ? (
              <button
                className="primary"
                disabled={isBusy}
                ref={typedContinueRef}
                type="submit"
              >
                Continue
              </button>
            ) : (
              <button
                className="primary"
                disabled={isBusy || typedFeedback !== "idle" || !typedValue.trim()}
                type="submit"
              >
                Check
              </button>
            )}
          </form>
          {waitingAfterWrong ? null : renderCardActions()}
        </article>
      );
    }

    // quest + quest-reverse MCQ
    const isReverse = formatId === "quest-reverse";
    const options = isReverse ? wordOptions : meaningOptions;
    const correctValue = isReverse ? currentCard.word : currentCard.meaning;

    return (
      <article className="reviewCard">
        <div className="reviewCardPronounce">
          <PronounceButton word={currentCard.word} compact />
        </div>
        {streakLabel ? <p className="questStreak">{streakLabel}</p> : null}
        {isReverse ? (
          <>
            <p className="reviewPrompt">Choose the correct word</p>
            <p className="reviewWord reviewWordMeaning">{currentCard.meaning}</p>
          </>
        ) : (
          <>
            <p className="reviewWord">{currentCard.word}</p>
            {currentCard.example ? (
              <div className="exampleSpoiler">
                {exampleRevealed ? (
                  <blockquote className="reviewExample">{currentCard.example}</blockquote>
                ) : (
                  <button
                    className="exampleSpoilerButton"
                    onClick={() => setExampleRevealed(true)}
                    type="button"
                  >
                    <span className="exampleSpoilerLabel">Example</span>
                    <span className="exampleSpoilerHint">
                      Are you sure you want to see the example?
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <p className="reviewPrompt">Choose the correct meaning below.</p>
            )}
          </>
        )}
        {renderMcqOptions(options, correctValue)}
        {renderCardActions()}
      </article>
    );
  }

  const rootClass =
    formatId === "review" ? "reviewSession reviewSessionFlip" : "reviewSession";

  return (
    <div className={rootClass}>
      {progressTotal > 0 && !isSessionComplete ? (
        <p className="reviewProgress" aria-live="polite">
          {progressCurrent} / {progressTotal}
        </p>
      ) : null}

      {isTransitioning ? (
        formatId === "review" && stats ? (
          <div className="reviewShell">
            <div className="reviewCard reviewCardLoading" aria-busy="true" aria-live="polite">
              <div className="reviewSpinner" aria-hidden="true" />
              <p className="reviewLoadingText">Next card…</p>
            </div>
            <aside className="reviewStats" aria-label="Session stats">
              <div className="reviewStat">
                <strong>{stats.due}</strong>
                <span>cards due today</span>
              </div>
              <div className="reviewStat">
                <strong>{stats.saved}</strong>
                <span>saved words</span>
              </div>
              <div className="reviewStat">
                <strong>{stats.known}</strong>
                <span>known words</span>
              </div>
            </aside>
          </div>
        ) : (
          <div className="reviewCard reviewCardLoading" aria-busy="true" aria-live="polite">
            <div className="reviewSpinner" aria-hidden="true" />
            <p className="reviewLoadingText">Next card…</p>
          </div>
        )
      ) : currentCard ? (
        renderActiveCard()
      ) : isSessionComplete ? (
        isPerfectSession ? (
          <div className="sessionSuccess" role="status" aria-live="polite">
            <p className="sessionSuccessBadge">{format.completeBadge}</p>
            <h2>Perfect run</h2>
            <p className="sessionSuccessScore">
              {knownWell.length} / {sessionDeck.length}
            </p>
            <p className="sessionSummaryLead">
              Every word in this session is marked ok. Nice work — head back to your cards
              whenever you like.
            </p>
            <ul className="sessionSuccessWords" aria-label="Words you mastered this round">
              {knownWell.map(({ card }) => (
                <li key={`perfect-${card.id}`}>
                  <strong>{card.word}</strong>
                  <span>{card.meaning}</span>
                </li>
              ))}
            </ul>
            <div className="sessionSummaryActions">
              <button className="primary" onClick={onExitLearning} type="button">
                Back to cards
              </button>
              <button className="ghost" onClick={() => restartSession(true)} type="button">
                Shuffle &amp; repeat
              </button>
            </div>
          </div>
        ) : (
          <div className="sessionSummary">
            <h2>{isEarlyExit ? "Session ended early" : "Session complete"}</h2>
            <p className="sessionSummaryLead">
              {knownWell.length} ok · {needsWork.length} to improve
              {isEarlyExit ? ` · ${skippedCards.length} skipped` : ""}
            </p>

            <div className={`sessionSummaryColumns${isEarlyExit ? " hasSkipped" : ""}`}>
              <section className="sessionSummaryBlock isOk" aria-label="Words you got right">
                <h3>Ok ({knownWell.length})</h3>
                {knownWell.length > 0 ? (
                  <ul>
                    {knownWell.map(({ card }) => (
                      <li key={`ok-${card.id}`}>
                        <strong>{card.word}</strong>
                        <span>{card.meaning}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sessionSummaryEmpty">
                    {formatId === "review"
                      ? "No confident recalls this round."
                      : "No correct answers this round."}
                  </p>
                )}
              </section>

              <section className="sessionSummaryBlock isWork" aria-label="Words to improve">
                <h3>Needs work ({needsWork.length})</h3>
                {needsWork.length > 0 ? (
                  <ul>
                    {needsWork.map(({ card }) => (
                      <li key={`work-${card.id}`}>
                        <strong>{card.word}</strong>
                        <span>{card.meaning}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sessionSummaryEmpty">Everything looked solid.</p>
                )}
              </section>

              {isEarlyExit ? (
                <section className="sessionSummaryBlock isSkipped" aria-label="Skipped words">
                  <h3>Skipped ({skippedCards.length})</h3>
                  <ul>
                    {skippedCards.map((card) => (
                      <li key={`skip-${card.id}`}>
                        <strong>{card.word}</strong>
                        <span>{card.meaning}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <div className="sessionSummaryActions">
              {isEarlyExit ? (
                <button className="primary" onClick={continueRemaining} type="button">
                  Finish remaining ({skippedCards.length})
                </button>
              ) : null}
              <button className="ghost" onClick={() => restartSession(false)} type="button">
                Repeat
              </button>
              <button
                className={isEarlyExit ? "ghost" : "primary"}
                onClick={() => restartSession(true)}
                type="button"
              >
                Shuffle &amp; repeat
              </button>
              <button className="ghost" onClick={onExitLearning} type="button">
                Back to cards
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="emptyState">
          <h2>{format.emptyTitle}</h2>
          <p>
            {format.emptyBody}
            {formatId === "review" && hasAheadOfSchedule
              ? " Some scheduled words are ahead of time — they still appear in Review."
              : ""}
          </p>
        </div>
      )}

      <div className="learningTipsDock" ref={tipsDockRef}>
        {tipsOpen ? (
          <aside className="learningTips" aria-label="How practice works">
            <h2>How it works</h2>
            <ul>
              {format.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
              <li>
                <strong>{format.skipLabel}</strong> moves a word to the end and advances the
                counter; unanswered words stay in the session until you finish or end early.
              </li>
              <li>
                <strong>{format.endEarlyLabel}</strong> stops early; unanswered words stay
                skipped until you finish them.
              </li>
              {(formatId === "quest" || formatId === "quest-reverse") && (
                <li>
                  Keys <strong>1–4</strong> pick an option; <strong>S</strong> skips.
                </li>
              )}
              {formatId === "review" && (
                <li>
                  Keys <strong>1 / 2 / 3</strong> = Bad / Good / Easy after reveal;{" "}
                  <strong>S</strong> skips.
                </li>
              )}
            </ul>
          </aside>
        ) : null}

        <button
          aria-expanded={tipsOpen}
          aria-label={tipsOpen ? "Hide how it works" : "Show how it works"}
          className={`learningTipsToggle${tipsOpen ? " isOpen" : ""}`}
          onClick={() => setTipsOpen((open) => !open)}
          type="button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 21h6v-1.5H9V21Zm3-19a7 7 0 0 0-4 12.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 12 2Zm2.1 11.2-.6.4V16h-3v-2.4l-.6-.4A5 5 0 1 1 14.1 13.2Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** @deprecated Prefer PracticeSession formatId="quest" */
export function LearningSession(
  props: Omit<PracticeSessionProps, "formatId"> & { formatId?: PracticeFormatId },
) {
  return <PracticeSession {...props} formatId={props.formatId ?? "quest"} />;
}

/** Review session via shared PracticeSession shell. */
export function ReviewSession(
  props: Omit<PracticeSessionProps, "formatId" | "optionPool"> & {
    stats: ReviewSessionStats;
  },
) {
  return <PracticeSession {...props} formatId="review" />;
}
