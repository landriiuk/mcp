import { useEffect, useRef, useState } from "react";
import {
  clearJsonSession,
  loadJsonSession,
  saveJsonSession,
} from "../../lib/sessionPersist";
import { MAX_SESSION_RETRIES, type ReviewGrade } from "../../utils/reviewAlgorithm";
import type { WordboxCard } from "./types";
import { PronounceButton } from "./PronounceButton";

const REVIEW_SESSION_KEY = "inklex.reviewSession";

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
  grade: ReviewGrade;
};

/** Face of the card before reveal. */
type PromptSide = "wordToMeaning" | "meaningToWord";

type PersistedReviewSession = {
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
  cardSides: Record<string, PromptSide>;
};

function assignPromptSides(deck: WordboxCard[]): Record<string, PromptSide> {
  // Alternate after deck order so the user gets word↔meaning mix.
  const sides: Record<string, PromptSide> = {};
  deck.forEach((card, index) => {
    sides[card.id] = index % 2 === 0 ? "wordToMeaning" : "meaningToWord";
  });
  return sides;
}

let persistedReviewSession: PersistedReviewSession | null = null;

function readPersistedReviewSession(): PersistedReviewSession | null {
  return persistedReviewSession ?? loadJsonSession<PersistedReviewSession>(REVIEW_SESSION_KEY);
}

export function clearPersistedReviewSession() {
  persistedReviewSession = null;
  clearJsonSession(REVIEW_SESSION_KEY);
}

export type ReviewSessionStats = {
  due: number;
  saved: number;
  known: number;
};

export type ReviewEndEarlyControls = {
  canEndEarly: boolean;
  endEarly: () => void;
};

type ReviewSessionProps = {
  cards: WordboxCard[];
  sessionScope: string;
  stats: ReviewSessionStats;
  onReviewGrade: (cardId: string, grade: ReviewGrade) => void | Promise<void>;
  onExitLearning: () => void;
  hasAheadOfSchedule: boolean;
  onEndEarlyControlsChange?: (controls: ReviewEndEarlyControls | null) => void;
};

export function ReviewSession({
  cards,
  sessionScope,
  stats,
  onReviewGrade,
  onExitLearning,
  hasAheadOfSchedule,
  onEndEarlyControlsChange,
}: ReviewSessionProps) {
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionQueue, setSessionQueue] = useState<WordboxCard[]>([]);
  const [sessionDeck, setSessionDeck] = useState<WordboxCard[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);
  const [skippedCards, setSkippedCards] = useState<WordboxCard[]>([]);
  const [cardSides, setCardSides] = useState<Record<string, PromptSide>>({});
  const tipsDockRef = useRef<HTMLDivElement>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const activeSessionScopeRef = useRef<string | null>(null);
  const sessionLockedRef = useRef(false);
  const sessionTotalRef = useRef(0);
  const sessionResultsRef = useRef<SessionResult[]>([]);
  const sessionQueueRef = useRef<WordboxCard[]>([]);
  const retryCountsRef = useRef<Record<string, number>>({});
  const progressCurrentRef = useRef(0);
  const answeredCountRef = useRef(0);
  const cardSidesRef = useRef<Record<string, PromptSide>>({});
  const isGradingRef = useRef(false);
  const restoredRef = useRef(false);

  function persistSnapshot(overrides: Partial<PersistedReviewSession> = {}) {
    if (!sessionLockedRef.current && !overrides.deck?.length) {
      return;
    }
    const deck = overrides.deck ?? sessionDeck;
    if (deck.length === 0 && !(overrides.results?.length || sessionResultsRef.current.length)) {
      return;
    }
    const snapshot: PersistedReviewSession = {
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
      cardSides: overrides.cardSides ?? cardSidesRef.current,
    };
    persistedReviewSession = snapshot;
    saveJsonSession(REVIEW_SESSION_KEY, snapshot);
  }

  function restorePersisted(snapshot: PersistedReviewSession) {
    sessionLockedRef.current = snapshot.deck.length > 0;
    sessionTotalRef.current = snapshot.sessionTotal;
    sessionResultsRef.current = snapshot.results;
    sessionQueueRef.current = snapshot.queue;
    activeSessionScopeRef.current = snapshot.scope;
    const sides = snapshot.cardSides ?? assignPromptSides(snapshot.deck);
    cardSidesRef.current = sides;
    setCardSides(sides);
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
    setRevealed(false);
    isGradingRef.current = false;
    setIsGrading(false);
    setIsTransitioning(false);
  }

  function seedSession(
    nextCards: WordboxCard[],
    options?: { shuffle?: boolean; reuseDeck?: boolean; force?: boolean },
  ) {
    if (sessionLockedRef.current && !options?.force) {
      return;
    }

    // Review uses every word in the folder — no due-first cap / max-10.
    const shouldShuffle = options?.shuffle !== false;
    const deck = shouldShuffle ? shuffleCards(nextCards) : [...nextCards];
    const sides = assignPromptSides(deck);
    sessionLockedRef.current = deck.length > 0;
    sessionTotalRef.current = deck.length;
    sessionResultsRef.current = [];
    sessionQueueRef.current = deck;
    cardSidesRef.current = sides;
    setCardSides(sides);
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
    setRevealed(false);
    isGradingRef.current = false;
    setIsGrading(false);
    setIsTransitioning(false);
    setEndedEarly(false);
    setSkippedCards([]);
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
      cardSides: sides,
    });
  }

  function bumpProgress() {
    const total = sessionTotalRef.current;
    const current = progressCurrentRef.current;
    const next = total > 0 ? Math.min(current + 1, total) : current + 1;
    progressCurrentRef.current = next;
    setProgressCurrent(next);
    return next;
  }

  useEffect(() => {
    function tryRestore(): boolean {
      const snapshot = readPersistedReviewSession();
      if (snapshot && snapshot.scope === sessionScope && snapshot.deck.length > 0) {
        persistedReviewSession = snapshot;
        restorePersisted(snapshot);
        return true;
      }
      return false;
    }

    if (!restoredRef.current) {
      restoredRef.current = true;
      if (tryRestore()) {
        return;
      }
    }

    const scopeChanged = activeSessionScopeRef.current !== sessionScope;

    if (scopeChanged) {
      activeSessionScopeRef.current = sessionScope;
      if (tryRestore()) {
        return;
      }
      // Different scope (or first visit) — drop a stale other-folder session.
      clearPersistedReviewSession();
      sessionLockedRef.current = false;
      if (cards.length > 0) {
        seedSession(cards, { force: true });
      }
      // Cards may still be loading — wait; do not seed an empty deck.
      return;
    }

    if (!sessionLockedRef.current && cards.length > 0) {
      if (tryRestore()) {
        return;
      }
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

  useEffect(() => {
    setRevealed(false);
  }, [sessionQueue, sessionIndex, isTransitioning]);

  const currentCard =
    !isTransitioning && sessionQueue.length > 0
      ? sessionQueue[Math.min(sessionIndex, sessionQueue.length - 1)]
      : null;

  const currentSide: PromptSide =
    currentCard != null
      ? cardSides[currentCard.id] ?? cardSidesRef.current[currentCard.id] ?? "wordToMeaning"
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

  const progressTotal = sessionTotal;
  const hasSkippedRemaining = skippedCards.length > 0;
  const isEarlyExit = endedEarly && hasSkippedRemaining;
  const isSessionComplete =
    !isTransitioning &&
    !currentCard &&
    sessionDeck.length > 0 &&
    (answeredCount > 0 || isEarlyExit);

  // Next while unattempted cards remain; last slot (N/N) ends the review.
  const canSkip =
    Boolean(currentCard) &&
    !isGrading &&
    sessionResults.length < sessionDeck.length;
  const canEndEarly =
    Boolean(currentCard) && !isGrading && sessionQueue.length > 0;

  const knownWell = sessionResults.filter((result) => result.grade !== "again");
  const needsWork = sessionResults.filter((result) => result.grade === "again");
  const isPerfectSession =
    isSessionComplete &&
    !isEarlyExit &&
    needsWork.length === 0 &&
    knownWell.length > 0 &&
    knownWell.length === sessionDeck.length;

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

    seedSession(sessionDeck, { shuffle: false, reuseDeck: true, force: true });
  }

  function settleGrade(grade: ReviewGrade) {
    if (!currentCard || isGradingRef.current || !revealed) {
      return;
    }

    const answeredCard = currentCard;
    const cardId = answeredCard.id;
    isGradingRef.current = true;
    setIsGrading(true);
    setIsTransitioning(true);

    void Promise.resolve(onReviewGrade(cardId, grade));

    const priorRetries = retryCountsRef.current[cardId] ?? 0;
    const alreadyRecorded = sessionResultsRef.current.some(
      (entry) => entry.card.id === cardId,
    );
    const progressBefore = progressCurrentRef.current;
    const atSessionBudget = progressBefore >= sessionTotalRef.current;
    const shouldRequeue =
      grade === "again" &&
      priorRetries < MAX_SESSION_RETRIES &&
      !alreadyRecorded &&
      !atSessionBudget;

    if (shouldRequeue) {
      const nextProgress = bumpProgress();
      const nextResults = [
        ...sessionResultsRef.current.filter((entry) => entry.card.id !== cardId),
        { card: answeredCard, grade },
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
        { card: answeredCard, grade },
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

    if (atSessionBudget) {
      const results = sessionResultsRef.current;
      const answeredIds = new Set(results.map((entry) => entry.card.id));
      const leftover = sessionQueueRef.current.filter((card) => !answeredIds.has(card.id));
      sessionQueueRef.current = [];
      setSessionQueue([]);
      if (leftover.length === 0) {
        setSkippedCards([]);
        setEndedEarly(false);
      } else {
        setSkippedCards(leftover);
        setEndedEarly(true);
      }
      persistSnapshot({
        results,
        queue: [],
        answeredCount: answeredCountRef.current,
        progressCurrent: progressCurrentRef.current,
        skippedCards: leftover,
        endedEarly: leftover.length > 0,
      });
    }

    window.setTimeout(() => {
      setRevealed(false);
      setIsTransitioning(false);
      isGradingRef.current = false;
      setIsGrading(false);
    }, 160);
  }

  function handleSkip() {
    if (!currentCard || !canSkip) {
      return;
    }

    // Session budget done (N/N) or sole card left — Next finishes the review.
    // Skipped cards are re-queued, so queueLen stays > 1 even on the last slot.
    if (
      sessionQueueRef.current.length <= 1 ||
      progressCurrentRef.current >= sessionTotalRef.current
    ) {
      handleEndEarly();
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
    setRevealed(false);

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

    if (remaining.length === 0 || results.length >= sessionDeck.length) {
      setSessionQueue([]);
      sessionQueueRef.current = [];
      setSkippedCards([]);
      setEndedEarly(false);
      setRevealed(false);
      persistSnapshot({ queue: [], skippedCards: [], endedEarly: false });
      return;
    }

    if (sessionResults.length !== results.length) {
      setSessionResults(results);
    }
    setSkippedCards(remaining);
    setSessionQueue([]);
    sessionQueueRef.current = [];
    setEndedEarly(true);
    setRevealed(false);
    persistSnapshot({
      results,
      queue: [],
      skippedCards: remaining,
      endedEarly: true,
    });
  }

  useEffect(() => {
    if (!onEndEarlyControlsChange) {
      return;
    }

    if (isSessionComplete) {
      onEndEarlyControlsChange(null);
      return () => onEndEarlyControlsChange(null);
    }

    onEndEarlyControlsChange({
      canEndEarly,
      endEarly: handleEndEarly,
    });

    return () => onEndEarlyControlsChange(null);
  }, [canEndEarly, isSessionComplete, onEndEarlyControlsChange]);

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
    setRevealed(false);
    const sides = assignPromptSides(remaining);
    cardSidesRef.current = sides;
    setCardSides(sides);
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
      cardSides: sides,
    });
  }

  return (
    <div className="reviewSession reviewSessionFlip">
      {progressTotal > 0 && !isSessionComplete ? (
        <p className="reviewProgress" aria-live="polite">
          {progressCurrent} / {progressTotal}
        </p>
      ) : null}

      {isTransitioning ? (
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
      ) : currentCard ? (
        <div className="reviewShell">
          <article className={`reviewFlipCard${revealed ? " isRevealed" : ""}`}>
            <div className="reviewCardPronounce">
              <PronounceButton word={currentCard.word} compact />
            </div>
            <button
              className="reviewFlipFace"
              onClick={() => {
                if (!revealed && !isGrading) {
                  setRevealed(true);
                }
              }}
              type="button"
              disabled={revealed || isGrading}
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
                    disabled={isGrading}
                    onClick={() => settleGrade("again")}
                    type="button"
                  >
                    Bad
                  </button>
                  <button
                    className="gradePill gradeGood"
                    disabled={isGrading}
                    onClick={() => settleGrade("good")}
                    type="button"
                  >
                    Good
                  </button>
                </div>
              </div>
            ) : null}

            <div className="reviewNavRow">
              <button
                className="gradeNext"
                disabled={!canSkip || isGrading}
                onClick={handleSkip}
                title={
                  progressCurrent >= sessionTotal
                    ? "Last card — Next finishes the review"
                    : "Skip without rating — move to the end of the session"
                }
                type="button"
              >
                Next
              </button>
            </div>
          </article>

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
      ) : isSessionComplete ? (
        isPerfectSession ? (
          <div className="sessionSuccess" role="status" aria-live="polite">
            <p className="sessionSuccessBadge">Quest complete</p>
            <h2>Perfect run</h2>
            <p className="sessionSuccessScore">
              {knownWell.length} / {sessionDeck.length}
            </p>
            <p className="sessionSummaryLead">
              Every word in this session is marked ok. Nice work — head back to your cards whenever
              you like.
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
                    {knownWell.map(({ card, grade }) => (
                      <li key={`ok-${card.id}`}>
                        <strong>{card.word}</strong>
                        <span>
                          {card.meaning}
                          {grade === "easy" ? " · easy" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="sessionSummaryEmpty">No confident recalls this round.</p>
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
          <h2>No words in this folder</h2>
          <p>
            {hasAheadOfSchedule
              ? "All scheduled reviews are in the future. Check back later or add new words."
              : "Nothing to review right now. Add new words to start practicing."}
          </p>
        </div>
      )}

      <div className="learningTipsDock" ref={tipsDockRef}>
        {tipsOpen ? (
          <aside className="learningTips" aria-label="How review works">
            <h2>How it works</h2>
            <ul>
              <li>Cards alternate: sometimes the word, sometimes the meaning — tap to reveal the other side.</li>
              <li>
                <strong>Bad</strong> brings it back sooner; <strong>Good</strong> spaces it out and
                builds toward Known.
              </li>
              <li>
                <strong>Next</strong> skips without rating; <strong>End Review</strong> stops early.
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
