import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildMeaningOptions,
  buildSessionDeck,
  MAX_SESSION_RETRIES,
  MAX_SESSION_SIZE,
  type ReviewGrade,
} from "../../utils/reviewAlgorithm";
import type { WordboxCard } from "./types";

function shuffleCards<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }
  return copy;
}

type SessionResult = {
  card: WordboxCard;
  correct: boolean;
};

type ChoiceState = "idle" | "selected" | "correct" | "wrong";

type PersistedLearningSession = {
  scope: string;
  deck: WordboxCard[];
  queue: WordboxCard[];
  results: SessionResult[];
  sessionTotal: number;
  progressCurrent: number;
  answeredCount: number;
  retryCounts: Record<string, number>;
  sessionIndex: number;
  endedEarly: boolean;
  skippedCards: WordboxCard[];
};

/** Survives LearningSession remounts (StrictMode / parent re-render) so results are not wiped. */
let persistedLearningSession: PersistedLearningSession | null = null;

export function clearPersistedLearningSession() {
  persistedLearningSession = null;
}

type LearningSessionProps = {
  cards: WordboxCard[];
  optionPool: WordboxCard[];
  sessionScope: string;
  onReviewGrade: (cardId: string, grade: ReviewGrade) => void | Promise<void>;
  hasAheadOfSchedule: boolean;
};

export function LearningSession({
  cards,
  optionPool,
  sessionScope,
  onReviewGrade,
  hasAheadOfSchedule,
}: LearningSessionProps) {
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionQueue, setSessionQueue] = useState<WordboxCard[]>([]);
  const [sessionDeck, setSessionDeck] = useState<WordboxCard[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  const [choiceState, setChoiceState] = useState<ChoiceState>("idle");
  const [selectedMeaning, setSelectedMeaning] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [optionSeed, setOptionSeed] = useState(0);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [exampleRevealed, setExampleRevealed] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);
  const [skippedCards, setSkippedCards] = useState<WordboxCard[]>([]);
  const tipsDockRef = useRef<HTMLDivElement>(null);
  const activeSessionScopeRef = useRef<string | null>(null);
  /** Once a non-empty deck is seeded, ignore due-pool updates until scope exit / restart. */
  const sessionLockedRef = useRef(false);
  const sessionTotalRef = useRef(0);
  const sessionResultsRef = useRef<SessionResult[]>([]);
  const sessionQueueRef = useRef<WordboxCard[]>([]);
  const retryCountsRef = useRef<Record<string, number>>({});
  const progressCurrentRef = useRef(0);
  const answeredCountRef = useRef(0);
  const isGradingRef = useRef(false);
  const restoredRef = useRef(false);

  function persistSnapshot(overrides: Partial<PersistedLearningSession> = {}) {
    if (!sessionLockedRef.current && !overrides.deck?.length) {
      return;
    }
    const deck = overrides.deck ?? sessionDeck;
    if (deck.length === 0 && !(overrides.results?.length || sessionResultsRef.current.length)) {
      return;
    }
    persistedLearningSession = {
      scope: sessionScope,
      deck,
      queue: overrides.queue ?? sessionQueueRef.current,
      results: overrides.results ?? sessionResultsRef.current,
      sessionTotal: overrides.sessionTotal ?? sessionTotalRef.current,
      progressCurrent: overrides.progressCurrent ?? progressCurrentRef.current,
      answeredCount: overrides.answeredCount ?? answeredCountRef.current,
      retryCounts: overrides.retryCounts ?? retryCountsRef.current,
      sessionIndex: overrides.sessionIndex ?? sessionIndex,
      endedEarly: overrides.endedEarly ?? endedEarly,
      skippedCards: overrides.skippedCards ?? skippedCards,
    };
  }

  function restorePersisted(snapshot: PersistedLearningSession) {
    sessionLockedRef.current = snapshot.deck.length > 0;
    sessionTotalRef.current = snapshot.sessionTotal;
    sessionResultsRef.current = snapshot.results;
    sessionQueueRef.current = snapshot.queue;
    activeSessionScopeRef.current = snapshot.scope;
    setSessionDeck(snapshot.deck);
    setSessionQueue(snapshot.queue);
    setSessionResults(snapshot.results);
    setSessionTotal(snapshot.sessionTotal);
    progressCurrentRef.current = snapshot.progressCurrent;
    setProgressCurrent(snapshot.progressCurrent);
    answeredCountRef.current = snapshot.answeredCount;
    setAnsweredCount(snapshot.answeredCount);
    retryCountsRef.current = snapshot.retryCounts;
    setRetryCounts(snapshot.retryCounts);
    setSessionIndex(snapshot.sessionIndex);
    setEndedEarly(snapshot.endedEarly);
    setSkippedCards(snapshot.skippedCards);
    setChoiceState("idle");
    setSelectedMeaning(null);
    isGradingRef.current = false;
    setIsGrading(false);
    setIsTransitioning(false);
  }

  function seedSession(
    nextCards: WordboxCard[],
    options?: { shuffle?: boolean; reuseDeck?: boolean; force?: boolean },
  ) {
    // Mid-session due-pool updates must not wipe results / queue.
    if (sessionLockedRef.current && !options?.force) {
      return;
    }

    const shouldShuffle = options?.shuffle !== false;
    const deck = options?.reuseDeck
      ? shouldShuffle
        ? shuffleCards(nextCards).slice(0, MAX_SESSION_SIZE)
        : nextCards.slice(0, MAX_SESSION_SIZE)
      : buildSessionDeck(nextCards, { shuffle: shouldShuffle });
    sessionLockedRef.current = deck.length > 0;
    sessionTotalRef.current = deck.length;
    sessionResultsRef.current = [];
    sessionQueueRef.current = deck;
    setSessionDeck(deck);
    setSessionQueue(deck);
    setSessionTotal(deck.length);
    progressCurrentRef.current = deck.length > 0 ? 1 : 0;
    setProgressCurrent(progressCurrentRef.current);
    setSessionResults([]);
    answeredCountRef.current = 0;
    setAnsweredCount(0);
    retryCountsRef.current = {};
    setRetryCounts({});
    setSessionIndex(0);
    setChoiceState("idle");
    setSelectedMeaning(null);
    isGradingRef.current = false;
    setIsGrading(false);
    setIsTransitioning(false);
    setExampleRevealed(false);
    setEndedEarly(false);
    setSkippedCards([]);
    setOptionSeed((value) => value + 1);
    persistSnapshot({
      deck,
      queue: deck,
      results: [],
      sessionTotal: deck.length,
      progressCurrent: deck.length > 0 ? 1 : 0,
      answeredCount: 0,
      retryCounts: {},
      sessionIndex: 0,
      endedEarly: false,
      skippedCards: [],
    });
  }

  /** Move 1/N forward when the visible card changes (settle, wrong-requeue, or skip). */
  function bumpProgress() {
    const total = sessionTotalRef.current;
    const current = progressCurrentRef.current;
    const next = total > 0 ? Math.min(current + 1, total) : current + 1;
    progressCurrentRef.current = next;
    setProgressCurrent(next);
    return next;
  }

  useEffect(() => {
    // Remount recovery: keep answered cards after parent re-render / StrictMode.
    if (!restoredRef.current) {
      restoredRef.current = true;
      const snapshot = persistedLearningSession;
      if (
        snapshot &&
        snapshot.scope === sessionScope &&
        snapshot.deck.length > 0 &&
        (snapshot.results.length > 0 || snapshot.answeredCount > 0 || snapshot.progressCurrent > 1)
      ) {
        restorePersisted(snapshot);
        return;
      }
    }

    const scopeChanged = activeSessionScopeRef.current !== sessionScope;

    if (scopeChanged) {
      activeSessionScopeRef.current = sessionScope;
      // Real folder/scope switch — only force-seed when we are not mid-answer progress
      // for this same remounted scope (handled above).
      sessionLockedRef.current = false;
      if (cards.length > 0) {
        seedSession(cards, { force: true });
      } else {
        sessionTotalRef.current = 0;
        sessionResultsRef.current = [];
        sessionQueueRef.current = [];
        setSessionDeck([]);
        setSessionQueue([]);
        setSessionTotal(0);
        answeredCountRef.current = 0;
        setAnsweredCount(0);
        progressCurrentRef.current = 0;
        setProgressCurrent(0);
        setSessionResults([]);
        retryCountsRef.current = {};
        setRetryCounts({});
        setSkippedCards([]);
        setEndedEarly(false);
        clearPersistedLearningSession();
      }
      return;
    }

    // Recover only when this scope never got a deck (e.g. /learning before data loaded).
    // Do NOT reseed when the due pool shrinks after each grade — that reset progress to 1/N.
    if (!sessionLockedRef.current && cards.length > 0) {
      seedSession(cards);
    }
  }, [sessionScope, cards]);

  useEffect(() => {
    if (!tipsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (tipsDockRef.current?.contains(target)) {
        return;
      }

      setTipsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [tipsOpen]);

  useEffect(() => {
    if (sessionIndex >= sessionQueue.length && sessionQueue.length > 0) {
      setSessionIndex(0);
    }
  }, [sessionQueue.length, sessionIndex]);

  const currentCard =
    !isTransitioning && sessionQueue.length > 0
      ? sessionQueue[Math.min(sessionIndex, sessionQueue.length - 1)]
      : null;

  const progressTotal = sessionTotal;
  const hasSkippedRemaining = skippedCards.length > 0;
  /** True only when user pressed End session and left unanswered cards. */
  const isEarlyExit = endedEarly && hasSkippedRemaining;
  const isSessionComplete =
    !isTransitioning &&
    !currentCard &&
    sessionDeck.length > 0 &&
    (answeredCount > 0 || isEarlyExit);

  // Skip only before every deck card has been attempted — otherwise 2/2 can loop forever.
  const canSkip =
    Boolean(currentCard) &&
    sessionQueue.length > 1 &&
    !isGrading &&
    choiceState === "idle" &&
    sessionResults.length < sessionDeck.length;
  /** Allow early exit while the queue still has cards (including pending retries). */
  const canEndEarly =
    Boolean(currentCard) &&
    !isGrading &&
    choiceState === "idle" &&
    sessionQueue.length > 0;

  const knownWell = sessionResults.filter((result) => result.correct);
  const needsWork = sessionResults.filter((result) => !result.correct);

  const meaningOptions = useMemo(() => {
    if (!currentCard) {
      return [];
    }

    void optionSeed;
    return buildMeaningOptions(currentCard.meaning, optionPool, currentCard.id);
  }, [currentCard, optionPool, optionSeed]);

  function resetChoice() {
    setChoiceState("idle");
    setSelectedMeaning(null);
    setExampleRevealed(false);
    setOptionSeed((value) => value + 1);
  }

  function restartSession(shouldShuffle: boolean) {
    if (shouldShuffle) {
      if (cards.length === 0 && sessionDeck.length === 0) {
        return;
      }
      const fromPool = cards.length > 0;
      seedSession(fromPool ? cards : sessionDeck, {
        shuffle: true,
        reuseDeck: !fromPool,
        force: true,
      });
      return;
    }

    if (sessionDeck.length === 0) {
      return;
    }

    // Same batch, same order.
    seedSession(sessionDeck, { shuffle: false, reuseDeck: true, force: true });
  }

  function handleSelectMeaning(meaning: string) {
    if (!currentCard || isGradingRef.current || choiceState !== "idle") {
      return;
    }

    const answeredCard = currentCard;
    const cardId = answeredCard.id;
    setSelectedMeaning(meaning);
    const isCorrect =
      meaning.trim().toLowerCase() === answeredCard.meaning.trim().toLowerCase();
    setChoiceState("selected");
    isGradingRef.current = true;
    setIsGrading(true);

    // Keep feedback snappy: short flash, then move on without waiting for the API.
    const SELECTED_MS = 120;
    const REVEAL_MS = isCorrect ? 280 : 420;
    const TRANSITION_MS = 160;

    window.setTimeout(() => {
      setChoiceState(isCorrect ? "correct" : "wrong");

      window.setTimeout(() => {
        setIsTransitioning(true);

        // Fire grade in background — App already applies optimistic update.
        void Promise.resolve(onReviewGrade(cardId, isCorrect ? "good" : "again"));

        const priorRetries = retryCountsRef.current[cardId] ?? 0;
        const alreadyRecorded = sessionResultsRef.current.some(
          (entry) => entry.card.id === cardId,
        );
        // One wrong→requeue only; never requeue a card already in results.
        const shouldRequeue =
          !isCorrect && priorRetries < MAX_SESSION_RETRIES && !alreadyRecorded;

        if (shouldRequeue) {
          // Keep the wrong attempt in summary if the user ends before the retry.
          const nextProgress = bumpProgress();
          const nextResults = [
            ...sessionResultsRef.current.filter((entry) => entry.card.id !== cardId),
            { card: answeredCard, correct: false },
          ];
          sessionResultsRef.current = nextResults;
          setSessionResults(nextResults);
          const nextRetries = { ...retryCountsRef.current, [cardId]: priorRetries + 1 };
          retryCountsRef.current = nextRetries;
          setRetryCounts(nextRetries);
          const nextAnswered = Math.max(answeredCountRef.current, nextResults.length);
          answeredCountRef.current = nextAnswered;
          setAnsweredCount(nextAnswered);
          setSessionQueue((current) => {
            const without = current.filter((card) => card.id !== cardId);
            const nextQueue = [...without, answeredCard];
            sessionQueueRef.current = nextQueue;
            persistSnapshot({
              queue: nextQueue,
              results: nextResults,
              retryCounts: nextRetries,
              progressCurrent: nextProgress,
              answeredCount: nextAnswered,
            });
            return nextQueue;
          });
        } else {
          const nextProgress = bumpProgress();
          const nextResults = [
            ...sessionResultsRef.current.filter((entry) => entry.card.id !== cardId),
            { card: answeredCard, correct: isCorrect },
          ];
          sessionResultsRef.current = nextResults;
          setSessionResults(nextResults);

          const remainingQueue = sessionQueueRef.current.filter((card) => card.id !== cardId);
          sessionQueueRef.current = remainingQueue;
          setSessionQueue(remainingQueue);
          if (remainingQueue.length === 0) {
            setEndedEarly(false);
            setSkippedCards([]);
          }
          const nextAnswered = Math.max(answeredCountRef.current + 1, nextResults.length);
          answeredCountRef.current = nextAnswered;
          setAnsweredCount(nextAnswered);
          persistSnapshot({
            results: nextResults,
            queue: remainingQueue,
            answeredCount: nextAnswered,
            progressCurrent: nextProgress,
            skippedCards: remainingQueue.length === 0 ? [] : skippedCards,
            endedEarly: remainingQueue.length === 0 ? false : endedEarly,
          });
        }

        resetChoice();

        window.setTimeout(() => {
          setIsTransitioning(false);
          isGradingRef.current = false;
          setIsGrading(false);
        }, TRANSITION_MS);
      }, REVEAL_MS);
    }, SELECTED_MS);
  }

  function handleSkip() {
    if (!currentCard || !canSkip) {
      return;
    }

    const skippedCard = currentCard;
    const nextProgress = bumpProgress();
    setIsTransitioning(true);
    setSessionQueue((current) => {
      const without = current.filter((card) => card.id !== skippedCard.id);
      const nextQueue = [...without, skippedCard];
      sessionQueueRef.current = nextQueue;
      persistSnapshot({ queue: nextQueue, progressCurrent: nextProgress });
      return nextQueue;
    });
    resetChoice();

    window.setTimeout(() => {
      setIsTransitioning(false);
    }, 140);
  }

  function handleEndEarly() {
    if (!canEndEarly) {
      return;
    }

    const results = sessionResultsRef.current;
    const answeredIds = new Set(results.map((entry) => entry.card.id));
    const remaining = sessionQueueRef.current.filter((card) => !answeredIds.has(card.id));

    // Nothing left unanswered relative to the deck → normal complete.
    if (remaining.length === 0 || results.length >= sessionDeck.length) {
      setSessionQueue([]);
      sessionQueueRef.current = [];
      setSkippedCards([]);
      setEndedEarly(false);
      resetChoice();
      persistSnapshot({ queue: [], skippedCards: [], endedEarly: false });
      return;
    }

    // Keep answered results visible in the summary even if state was partially reset.
    if (sessionResults.length !== results.length) {
      setSessionResults(results);
    }
    setSkippedCards(remaining);
    setSessionQueue([]);
    sessionQueueRef.current = [];
    setEndedEarly(true);
    resetChoice();
    persistSnapshot({
      results,
      queue: [],
      skippedCards: remaining,
      endedEarly: true,
    });
  }

  function continueRemaining() {
    if (skippedCards.length === 0) {
      return;
    }

    const remaining = skippedCards;
    sessionLockedRef.current = remaining.length > 0;
    sessionTotalRef.current = remaining.length;
    sessionResultsRef.current = [];
    sessionQueueRef.current = remaining;
    setSessionDeck(remaining);
    setSessionQueue(remaining);
    setSessionTotal(remaining.length);
    progressCurrentRef.current = remaining.length > 0 ? 1 : 0;
    setProgressCurrent(progressCurrentRef.current);
    setSessionResults([]);
    answeredCountRef.current = 0;
    setAnsweredCount(0);
    retryCountsRef.current = {};
    setRetryCounts({});
    setSessionIndex(0);
    setSkippedCards([]);
    setEndedEarly(false);
    resetChoice();
    isGradingRef.current = false;
    setIsGrading(false);
    setIsTransitioning(false);
    persistSnapshot({
      deck: remaining,
      queue: remaining,
      results: [],
      sessionTotal: remaining.length,
      progressCurrent: remaining.length > 0 ? 1 : 0,
      answeredCount: 0,
      retryCounts: {},
      sessionIndex: 0,
      endedEarly: false,
      skippedCards: [],
    });
  }


  return (
        <div className="reviewSession">
          {progressTotal > 0 && !isSessionComplete ? (
            <p className="reviewProgress" aria-live="polite">
              {progressCurrent} / {progressTotal}
            </p>
          ) : null}

          {isTransitioning ? (
            <div className="reviewCard reviewCardLoading" aria-busy="true" aria-live="polite">
              <div className="reviewSpinner" aria-hidden="true" />
              <p className="reviewLoadingText">Next card…</p>
            </div>
          ) : currentCard ? (
            <article className="reviewCard">
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

              <div className="reviewOptions" role="group" aria-label="Meaning options">
                {meaningOptions.map((meaning) => {
                  const isSelected = selectedMeaning === meaning;
                  const isCorrectOption =
                    meaning.trim().toLowerCase() ===
                    currentCard.meaning.trim().toLowerCase();
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
                      disabled={choiceState !== "idle" || isGrading}
                      key={meaning}
                      onClick={() => void handleSelectMeaning(meaning)}
                      type="button"
                    >
                      {meaning}
                    </button>
                  );
                })}
              </div>

              <div className="reviewCardActions">
                <button
                  className="ghost"
                  disabled={!canSkip}
                  onClick={handleSkip}
                  title={
                    sessionQueue.length <= 1
                      ? "Last card — answer it or end the session"
                      : "Move this word to the end of the session"
                  }
                  type="button"
                >
                  Skip
                </button>
                <button
                  className="ghost reviewEndEarly"
                  disabled={!canEndEarly}
                  onClick={handleEndEarly}
                  type="button"
                >
                  End session
                </button>
              </div>
            </article>
          ) : isSessionComplete ? (
            <div className="sessionSummary">
              <h2>{isEarlyExit ? "Session ended early" : "Session complete"}</h2>
              <p className="sessionSummaryLead">
                {knownWell.length} ok · {needsWork.length} to improve
                {isEarlyExit ? ` · ${skippedCards.length} skipped` : ""}
              </p>

              <div
                className={`sessionSummaryColumns${isEarlyExit ? " hasSkipped" : ""}`}
              >
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
                    <p className="sessionSummaryEmpty">No correct answers this round.</p>
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
              </div>
            </div>
          ) : (
            <div className="emptyState">
              <h2>Nothing due now</h2>
              <p>
                {hasAheadOfSchedule
                  ? "All scheduled reviews are in the future. Check back later or add new words."
                  : "Nothing to review right now. Add new words to start practicing."}
              </p>
            </div>
          )}

          <div className="learningTipsDock" ref={tipsDockRef}>
            {tipsOpen ? (
              <aside className="learningTips" aria-label="How spaced review works">
                <h2>How it works</h2>
                <ul>
                  <li>Sessions prioritize due cards, then add a few new ones (max 10).</li>
                  <li>
                    <strong>Skip</strong> goes to the next word and advances the counter; skipped words return at the end.
                  </li>
                  <li>
                    <strong>End session</strong> stops early; you can finish remaining words later.
                  </li>
                  <li>
                    <strong>Wrong</strong> steps one level down and repeats once in this session.
                  </li>
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
