import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearJsonSession,
  loadJsonSession,
  saveJsonSession,
} from "../lib/sessionPersist";
import { MAX_SESSION_RETRIES, type ReviewGrade } from "../utils/reviewAlgorithm";
import type { WordboxCard } from "../components/wordbox/types";

export type PracticeSessionResult = {
  card: WordboxCard;
  grade: ReviewGrade;
};

export type PracticeEndEarlyControls = {
  canEndEarly: boolean;
  endEarly: () => void;
};

type PersistedPracticeSession = {
  scope: string;
  formatId: string;
  deck: WordboxCard[];
  queue: WordboxCard[];
  results: PracticeSessionResult[];
  sessionTotal: number;
  /** Display cursor 1..N — advances on leave (answer / skip / requeue), never forces end. */
  progressCurrent: number;
  answeredCount: number;
  retryCounts: Record<string, number>;
  /** Card ids that already wrote a grade to the DB this session. */
  gradedIds: string[];
  sessionIndex: number;
  endedEarly: boolean;
  skippedCards: WordboxCard[];
  formatState?: Record<string, unknown>;
};

type BuildDeckFn = (
  cards: WordboxCard[],
  options?: { shuffle?: boolean; reuseDeck?: boolean },
) => WordboxCard[];

type UsePracticeSessionOptions = {
  sessionKey: string;
  formatId: string;
  sessionScope: string;
  cards: WordboxCard[];
  buildDeck: BuildDeckFn;
  onReviewGrade: (cardId: string, grade: ReviewGrade) => void | Promise<void>;
  onEndEarlyControlsChange?: (controls: PracticeEndEarlyControls | null) => void;
  /** Extra snapshot fields (e.g. Review cardSides). */
  formatState?: Record<string, unknown>;
  onFormatStateChange?: (state: Record<string, unknown>) => void;
  initialFormatState?: (deck: WordboxCard[]) => Record<string, unknown>;
};

const memoryCache = new Map<string, PersistedPracticeSession | null>();

function readPersisted(key: string): PersistedPracticeSession | null {
  return memoryCache.get(key) ?? loadJsonSession<PersistedPracticeSession>(key);
}

export function clearPersistedPracticeSession(sessionKey: string) {
  memoryCache.set(sessionKey, null);
  clearJsonSession(sessionKey);
}

export function usePracticeSession({
  sessionKey,
  formatId,
  sessionScope,
  cards,
  buildDeck,
  onReviewGrade,
  onEndEarlyControlsChange,
  formatState,
  onFormatStateChange,
  initialFormatState,
}: UsePracticeSessionOptions) {
  const [sessionIndex, setSessionIndex] = useState(0);
  const [sessionQueue, setSessionQueue] = useState<WordboxCard[]>([]);
  const [sessionDeck, setSessionDeck] = useState<WordboxCard[]>([]);
  const [sessionResults, setSessionResults] = useState<PracticeSessionResult[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [retryCounts, setRetryCounts] = useState<Record<string, number>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);
  const [skippedCards, setSkippedCards] = useState<WordboxCard[]>([]);
  const [tipsOpen, setTipsOpen] = useState(false);

  const tipsDockRef = useRef<HTMLDivElement>(null);
  const activeSessionScopeRef = useRef<string | null>(null);
  const sessionLockedRef = useRef(false);
  const sessionTotalRef = useRef(0);
  const sessionResultsRef = useRef<PracticeSessionResult[]>([]);
  const sessionQueueRef = useRef<WordboxCard[]>([]);
  const sessionDeckRef = useRef<WordboxCard[]>([]);
  const retryCountsRef = useRef<Record<string, number>>({});
  const gradedIdsRef = useRef<Set<string>>(new Set());
  const answeredCountRef = useRef(0);
  const progressCurrentRef = useRef(0);
  const isGradingRef = useRef(false);
  const restoredRef = useRef(false);
  const formatStateRef = useRef<Record<string, unknown>>(formatState ?? {});
  const timeoutsRef = useRef<number[]>([]);

  const clearTimeouts = useCallback(() => {
    for (const id of timeoutsRef.current) {
      window.clearTimeout(id);
    }
    timeoutsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => () => clearTimeouts(), [clearTimeouts]);

  function persistSnapshot(overrides: Partial<PersistedPracticeSession> = {}) {
    if (!sessionLockedRef.current && !overrides.deck?.length) {
      return;
    }
    const deck = overrides.deck ?? sessionDeck;
    if (deck.length === 0 && !(overrides.results?.length || sessionResultsRef.current.length)) {
      return;
    }
    const snapshot: PersistedPracticeSession = {
      scope: sessionScope,
      formatId,
      deck,
      queue: overrides.queue ?? sessionQueueRef.current,
      results: overrides.results ?? sessionResultsRef.current,
      sessionTotal: overrides.sessionTotal ?? sessionTotalRef.current,
      progressCurrent: overrides.progressCurrent ?? progressCurrentRef.current,
      answeredCount: overrides.answeredCount ?? answeredCountRef.current,
      retryCounts: overrides.retryCounts ?? retryCountsRef.current,
      gradedIds: overrides.gradedIds ?? Array.from(gradedIdsRef.current),
      sessionIndex: overrides.sessionIndex ?? sessionIndex,
      endedEarly: overrides.endedEarly ?? endedEarly,
      skippedCards: overrides.skippedCards ?? skippedCards,
      formatState: overrides.formatState ?? formatStateRef.current,
    };
    memoryCache.set(sessionKey, snapshot);
    saveJsonSession(sessionKey, snapshot);
  }

  function restorePersisted(snapshot: PersistedPracticeSession) {
    sessionLockedRef.current = snapshot.deck.length > 0;
    sessionTotalRef.current = snapshot.sessionTotal;
    sessionResultsRef.current = snapshot.results;
    sessionQueueRef.current = snapshot.queue;
    sessionDeckRef.current = snapshot.deck;
    activeSessionScopeRef.current = snapshot.scope;
    gradedIdsRef.current = new Set(snapshot.gradedIds ?? []);
    formatStateRef.current = snapshot.formatState ?? {};
    onFormatStateChange?.(formatStateRef.current);
    setSessionDeck(snapshot.deck);
    setSessionQueue(snapshot.queue);
    setSessionResults(snapshot.results);
    setSessionTotal(snapshot.sessionTotal);
    const restoredProgress =
      typeof snapshot.progressCurrent === "number" && snapshot.progressCurrent > 0
        ? snapshot.progressCurrent
        : snapshot.results.length > 0
          ? Math.min(snapshot.results.length + (snapshot.queue.length > 0 ? 1 : 0), snapshot.sessionTotal)
          : snapshot.deck.length > 0
            ? 1
            : 0;
    progressCurrentRef.current = restoredProgress;
    setProgressCurrent(restoredProgress);
    answeredCountRef.current = snapshot.answeredCount;
    setAnsweredCount(snapshot.answeredCount);
    retryCountsRef.current = snapshot.retryCounts;
    setRetryCounts(snapshot.retryCounts);
    setSessionIndex(snapshot.sessionIndex);
    setEndedEarly(snapshot.endedEarly);
    setSkippedCards(snapshot.skippedCards);
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

    clearTimeouts();
    const shouldShuffle = options?.shuffle !== false;
    const deck = buildDeck(nextCards, {
      shuffle: shouldShuffle,
      reuseDeck: options?.reuseDeck,
    });
    const nextFormatState = initialFormatState?.(deck) ?? {};
    formatStateRef.current = nextFormatState;
    onFormatStateChange?.(nextFormatState);

    sessionLockedRef.current = deck.length > 0;
    sessionTotalRef.current = deck.length;
    sessionResultsRef.current = [];
    sessionQueueRef.current = deck;
    sessionDeckRef.current = deck;
    gradedIdsRef.current = new Set();
    setSessionDeck(deck);
    setSessionQueue(deck);
    setSessionTotal(deck.length);
    setSessionResults([]);
    answeredCountRef.current = 0;
    setAnsweredCount(0);
    progressCurrentRef.current = deck.length > 0 ? 1 : 0;
    setProgressCurrent(progressCurrentRef.current);
    retryCountsRef.current = {};
    setRetryCounts({});
    setSessionIndex(0);
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
      progressCurrent: progressCurrentRef.current,
      answeredCount: 0,
      retryCounts: {},
      gradedIds: [],
      sessionIndex: 0,
      endedEarly: false,
      skippedCards: [],
      formatState: nextFormatState,
    });
  }

  /** Advance 1/N when leaving a card. Does not end the session by itself. */
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
      const snapshot = readPersisted(sessionKey);
      if (
        snapshot &&
        snapshot.scope === sessionScope &&
        snapshot.formatId === formatId &&
        snapshot.deck.length > 0
      ) {
        memoryCache.set(sessionKey, snapshot);
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
      clearPersistedPracticeSession(sessionKey);
      sessionLockedRef.current = false;
      if (cards.length > 0) {
        seedSession(cards, { force: true });
      }
      return;
    }

    if (!sessionLockedRef.current && cards.length > 0) {
      if (tryRestore()) {
        return;
      }
      seedSession(cards);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on scope/cards only
  }, [sessionScope, cards, sessionKey, formatId]);

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

  const settledCount = sessionResults.length;
  const progressTotal = sessionTotal;

  const hasSkippedRemaining = skippedCards.length > 0;
  const isEarlyExit = endedEarly && hasSkippedRemaining;
  const isSessionComplete =
    !isTransitioning &&
    !currentCard &&
    sessionDeck.length > 0 &&
    (answeredCount > 0 || isEarlyExit);

  const canSkip =
    Boolean(currentCard) && !isGrading && settledCount < sessionDeck.length;
  const canEndEarly = Boolean(currentCard) && !isGrading && sessionQueue.length > 0;

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

  /**
   * Final settle for a card attempt.
   * Again may requeue once unless the session is already at N/N budget.
   */
  function settleAttempt(grade: ReviewGrade, options?: { transitionMs?: number }) {
    if (!currentCard || isGradingRef.current) {
      return false;
    }

    const answeredCard = currentCard;
    const cardId = answeredCard.id;
    const transitionMs = options?.transitionMs ?? 160;
    const progressBefore = progressCurrentRef.current;
    const atSessionBudget = progressBefore >= sessionTotalRef.current;

    isGradingRef.current = true;
    setIsGrading(true);
    setIsTransitioning(true);

    const priorRetries = retryCountsRef.current[cardId] ?? 0;
    const alreadyGraded = gradedIdsRef.current.has(cardId);
    const shouldRequeue =
      grade === "again" &&
      priorRetries < MAX_SESSION_RETRIES &&
      !alreadyGraded &&
      !atSessionBudget;

    // Always persist the grade (including again on first fail) so streak → Known stays honest.
    // Requeue only affects in-session order, not whether again resets the streak.
    void Promise.resolve(onReviewGrade(cardId, grade));
    gradedIdsRef.current.add(cardId);

    if (shouldRequeue) {
      const nextProgress = bumpProgress();
      const nextRetries = { ...retryCountsRef.current, [cardId]: priorRetries + 1 };
      retryCountsRef.current = nextRetries;
      setRetryCounts(nextRetries);
      // Keep a provisional "needs work" result until a later good overwrites it.
      const nextResults = [
        ...sessionResultsRef.current.filter((entry) => entry.card.id !== cardId),
        { card: answeredCard, grade },
      ];
      sessionResultsRef.current = nextResults;
      setSessionResults(nextResults);
      setSessionQueue((current) => {
        const without = current.filter((card) => card.id !== cardId);
        const nextQueue = [...without, answeredCard];
        sessionQueueRef.current = nextQueue;
        persistSnapshot({
          queue: nextQueue,
          results: nextResults,
          retryCounts: nextRetries,
          progressCurrent: nextProgress,
          gradedIds: Array.from(gradedIdsRef.current),
        });
        return nextQueue;
      });
    } else {
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
        progressCurrentRef.current = sessionTotalRef.current;
        setProgressCurrent(sessionTotalRef.current);
      } else if (!atSessionBudget) {
        bumpProgress();
      }
      const nextAnswered = Math.max(answeredCountRef.current + 1, nextResults.length);
      answeredCountRef.current = nextAnswered;
      setAnsweredCount(nextAnswered);
      persistSnapshot({
        results: nextResults,
        queue: remainingQueue,
        answeredCount: nextAnswered,
        progressCurrent: progressCurrentRef.current,
        gradedIds: Array.from(gradedIdsRef.current),
        skippedCards: remainingQueue.length === 0 ? [] : skippedCards,
        endedEarly: remainingQueue.length === 0 ? false : endedEarly,
      });
    }

    // N/N answered — force summary even if retries / skips remain in the queue.
    if (atSessionBudget) {
      const results = sessionResultsRef.current;
      const answeredIds = new Set(results.map((entry) => entry.card.id));
      const leftover = sessionQueueRef.current.filter((card) => !answeredIds.has(card.id));
      sessionQueueRef.current = [];
      setSessionQueue([]);
      progressCurrentRef.current = sessionTotalRef.current;
      setProgressCurrent(sessionTotalRef.current);
      if (leftover.length === 0) {
        setSkippedCards([]);
        setEndedEarly(false);
      } else {
        setSkippedCards(leftover);
        setEndedEarly(true);
      }
      const nextAnswered = Math.max(answeredCountRef.current, results.length);
      answeredCountRef.current = nextAnswered;
      setAnsweredCount(nextAnswered);
      persistSnapshot({
        results,
        queue: [],
        answeredCount: nextAnswered,
        progressCurrent: sessionTotalRef.current,
        gradedIds: Array.from(gradedIdsRef.current),
        skippedCards: leftover,
        endedEarly: leftover.length > 0,
      });
    }

    scheduleTimeout(() => {
      setIsTransitioning(false);
      isGradingRef.current = false;
      setIsGrading(false);
    }, transitionMs);

    return true;
  }

  function handleSkip() {
    if (!currentCard || !canSkip) {
      return;
    }

    // Last card, or already at N/N — Next/Skip finishes the session.
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

    scheduleTimeout(() => {
      setIsTransitioning(false);
    }, 140);
  }

  function handleEndEarly() {
    if (sessionQueueRef.current.length === 0) {
      return;
    }

    const results = sessionResultsRef.current;
    const answeredIds = new Set(results.map((entry) => entry.card.id));
    const remaining = sessionQueueRef.current.filter((card) => !answeredIds.has(card.id));

    if (remaining.length === 0 || results.length >= sessionDeckRef.current.length) {
      setSessionQueue([]);
      sessionQueueRef.current = [];
      setSkippedCards([]);
      setEndedEarly(false);
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
    const nextFormatState = initialFormatState?.(remaining) ?? formatStateRef.current;
    formatStateRef.current = nextFormatState;
    onFormatStateChange?.(nextFormatState);

    sessionLockedRef.current = remaining.length > 0;
    sessionTotalRef.current = remaining.length;
    sessionResultsRef.current = [];
    sessionQueueRef.current = remaining;
    sessionDeckRef.current = remaining;
    gradedIdsRef.current = new Set();
    setSessionDeck(remaining);
    setSessionQueue(remaining);
    setSessionTotal(remaining.length);
    setSessionResults([]);
    answeredCountRef.current = 0;
    setAnsweredCount(0);
    progressCurrentRef.current = remaining.length > 0 ? 1 : 0;
    setProgressCurrent(progressCurrentRef.current);
    retryCountsRef.current = {};
    setRetryCounts({});
    setSessionIndex(0);
    setSkippedCards([]);
    setEndedEarly(false);
    isGradingRef.current = false;
    setIsGrading(false);
    setIsTransitioning(false);
    persistSnapshot({
      deck: remaining,
      queue: remaining,
      results: [],
      sessionTotal: remaining.length,
      progressCurrent: progressCurrentRef.current,
      answeredCount: 0,
      retryCounts: {},
      gradedIds: [],
      sessionIndex: 0,
      endedEarly: false,
      skippedCards: [],
      formatState: nextFormatState,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- endEarly closes over latest refs
  }, [canEndEarly, isSessionComplete, onEndEarlyControlsChange]);

  function updateFormatState(next: Record<string, unknown>) {
    formatStateRef.current = next;
    onFormatStateChange?.(next);
    persistSnapshot({ formatState: next });
  }

  return {
    currentCard,
    sessionDeck,
    sessionQueue,
    sessionResults,
    progressCurrent,
    progressTotal,
    answeredCount,
    retryCounts,
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
    clearTimeouts,
    formatState: formatStateRef.current,
    updateFormatState,
    isBusy: isGrading || isTransitioning,
  };
}
