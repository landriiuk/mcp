import { MAX_SESSION_SIZE, type ReviewGrade } from "../../utils/reviewAlgorithm";
import {
  isCardDrag,
  readDraggedCardId,
  setDraggedCardId,
} from "../../utils/cardDrag";
import {
  clearActiveLearningSession,
  readActiveLearningSession,
  readLearningMode,
  writeActiveLearningSession,
  writeLearningMode,
  type LearningMode,
} from "../../lib/learningMode";
import type { Folder } from "../../types/card";
import "./Wordbox.css";
import Card from "./card/Card";
import { clearPersistedLearningSession, LearningSession } from "./LearningSession";
import {
  clearPersistedReviewSession,
  ReviewSession,
  type ReviewEndEarlyControls,
} from "./ReviewSession";
import { LearningHub } from "./LearningHub";
import { FolderPickerModal } from "./FolderPickerModal";
import { FolderPickerPage } from "./FolderPickerPage";
import { PronounceButton } from "./PronounceButton";
import type { CardFilter, Section, SectionCounts, WordboxCard } from "./types";
import { useEffect, useState } from "react";

export type { CardFilter, Section, SectionCounts, WordboxCard };

interface WordboxProps {
  cards: WordboxCard[];
  /** Cards/Learning words for Quest (active folder). */
  questCards: WordboxCard[];
  /** All words in the active folder — used by Review (no due / max-10 limit). */
  reviewCards: WordboxCard[];
  optionPool: WordboxCard[];
  sessionScope: string;
  folders: Folder[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenNewCardForm: () => void;
  onOpenImport: () => void;
  onOpenFolders?: () => void;
  filter: CardFilter;
  sectionCounts: SectionCounts;
  sections: readonly Section[];
  onFilterChange: (value: CardFilter) => void;
  onDeleteCard: (cardId: string) => void;
  onMoveCardToStatus?: (
    cardId: string,
    status: "new" | "learning" | "known",
  ) => void;
  onReviewGrade: (cardId: string, grade: ReviewGrade) => void | Promise<void>;
  isLearningMode: boolean;
  dueCount: number;
  sessionSize: number;
  poolSize: number;
  savedCount: number;
  knownCount: number;
  hasAheadOfSchedule: boolean;
  onStartLearning: () => void;
  onExitLearning: () => void;
  onSelectFolderForLearning: (folderId: string) => void;
}

function startLearningLabel(dueCount: number, sessionSize: number, poolSize: number) {
  if (sessionSize <= 0) {
    return null;
  }
  if (dueCount > 0) {
    return `Start Learning (${Math.min(dueCount, MAX_SESSION_SIZE)} due)`;
  }
  return `Start Learning (${Math.min(poolSize, MAX_SESSION_SIZE)})`;
}

function statusForTab(value: CardFilter): "new" | "learning" | "known" {
  if (value === "learning" || value === "known") {
    return value;
  }
  return "new";
}

export function Wordbox({
  cards,
  questCards,
  reviewCards,
  optionPool,
  sessionScope,
  folders,
  query,
  onQueryChange,
  onOpenNewCardForm,
  onOpenImport,
  onOpenFolders,
  filter,
  sectionCounts,
  sections,
  onFilterChange,
  onDeleteCard,
  onMoveCardToStatus,
  onReviewGrade,
  isLearningMode,
  dueCount,
  sessionSize,
  poolSize,
  savedCount,
  knownCount,
  hasAheadOfSchedule,
  onStartLearning,
  onExitLearning,
  onSelectFolderForLearning,
}: WordboxProps) {
  const [dropTab, setDropTab] = useState<CardFilter | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [preferredMode, setPreferredMode] = useState<LearningMode>(() => readLearningMode());
  const [activeSessionMode, setActiveSessionMode] = useState<LearningMode | null>(() => {
    if (!isLearningMode) {
      return null;
    }
    const active = readActiveLearningSession();
    return active && active.scope === sessionScope ? active.mode : null;
  });
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [reviewEndEarly, setReviewEndEarly] = useState<ReviewEndEarlyControls | null>(
    null,
  );

  const isAllFolder = sessionScope === "all";
  const canStartQuest = sessionSize > 0;
  const canStartReview = reviewCards.length > 0;
  const canOpenLearning = isAllFolder
    ? folders.length > 0
    : canStartQuest || canStartReview;

  function openStartLearning() {
    if (isAllFolder) {
      setIsFolderPickerOpen(true);
      return;
    }
    if (!canOpenLearning) {
      return;
    }
    onStartLearning();
  }

  function startSession(mode: LearningMode) {
    // Hub start = new run; drop any leftover deck from a previous attempt.
    clearPersistedLearningSession();
    clearPersistedReviewSession();
    setPreferredMode(mode);
    writeLearningMode(mode);
    writeActiveLearningSession(sessionScope, mode);
    setActiveSessionMode(mode);
  }

  function handlePickFolder(folderId: string) {
    setIsFolderPickerOpen(false);
    onSelectFolderForLearning(folderId);
  }

  useEffect(() => {
    if (!isLearningMode) {
      clearPersistedLearningSession();
      clearPersistedReviewSession();
      clearActiveLearningSession();
      setActiveSessionMode(null);
      setIsFolderPickerOpen(false);
      setReviewEndEarly(null);
      return;
    }

    setPreferredMode(readLearningMode());
    const active = readActiveLearningSession();
    // Reload / remount: resume the same Quest/Review for this folder.
    setActiveSessionMode(active && active.scope === sessionScope ? active.mode : null);
    setReviewEndEarly(null);
  }, [isLearningMode, sessionScope]);

  useEffect(() => {
    if (!isFolderPickerOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFolderPickerOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFolderPickerOpen]);

  useEffect(() => {
    document.body.classList.toggle("isCardDragging", Boolean(draggingCardId));
    return () => document.body.classList.remove("isCardDragging");
  }, [draggingCardId]);

  const learningIntro =
    !activeSessionMode
      ? isAllFolder
        ? "Pick a folder to continue."
        : null
      : activeSessionMode === "review"
        ? "Tap to reveal, then Bad / Good — or Next to skip."
        : "Pick the correct meaning. Example stays under a spoiler.";

  return (
    <>
      <section className={`content${isLearningMode ? " contentLearning" : ""}`}>
        <div className="contentHeader">
          <div className="contentHeaderLead">
            <div>
              <h1>{isLearningMode ? "Learning" : "Cards"}</h1>
              {isLearningMode ? (
                learningIntro ? <p className="intro">{learningIntro}</p> : null
              ) : (
                <p className="intro">
                  Drag a card onto a folder or a tab (Cards / Learning / Known) to move it.
                  Quest practices up to 10 Cards/Learning words at a time.
                </p>
              )}
            </div>
          </div>

          <div className="headerMeta">
            {onOpenFolders ? (
              <button
                className="mobileBurger"
                type="button"
                onClick={onOpenFolders}
                aria-label="Open folders"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            ) : null}
            {isLearningMode ? (
              <>
                {activeSessionMode === "review" && reviewEndEarly ? (
                  <button
                    className="ghost"
                    disabled={!reviewEndEarly.canEndEarly}
                    onClick={() => reviewEndEarly.endEarly()}
                    type="button"
                  >
                    End Review
                  </button>
                ) : null}
                <button className="ghost" onClick={onExitLearning} type="button">
                  Back to cards
                </button>
              </>
            ) : (
              <>
                {filter === "all" ? (
                  <>
                    <button className="ghost" onClick={onOpenImport} type="button">
                      Import
                    </button>
                    <button className="ghost" onClick={onOpenNewCardForm} type="button">
                      Add card
                    </button>
                  </>
                ) : null}
                <span
                  className={`startLearningWrap${canOpenLearning ? "" : " isDisabled"}`}
                  data-tooltip={
                    !canOpenLearning
                      ? isAllFolder
                        ? "Create a folder to start practicing."
                        : "Add words to this folder to start practicing."
                      : isAllFolder
                        ? "Choose a folder to practice in."
                        : canStartQuest
                          ? dueCount > 0
                            ? `${dueCount} due for Quest · ${savedCount} words for Review.`
                            : `${poolSize} Cards/Learning for Quest · ${savedCount} for Review.`
                          : `${savedCount} words ready for Review.`
                  }
                >
                  <button
                    className="primary"
                    disabled={!canOpenLearning}
                    onClick={openStartLearning}
                    type="button"
                  >
                    {isAllFolder
                      ? "Start Learning"
                      : canStartQuest
                        ? startLearningLabel(dueCount, sessionSize, poolSize) ??
                          "Start Learning"
                        : canStartReview
                          ? `Start Learning (${savedCount})`
                          : "Start Learning"}
                  </button>
                </span>
              </>
            )}
          </div>
        </div>

        {!isLearningMode ? (
          <nav className="contentSections" aria-label="Card sections">
            {sections.map(({ value, label }) => (
              <button
                className={`${filter === value ? "active" : ""}${
                  dropTab === value ? " isDropTarget" : ""
                }`}
                key={value}
                onClick={() => onFilterChange(value)}
                type="button"
                onDragEnter={(event) => {
                  if (!onMoveCardToStatus || !isCardDrag(event.dataTransfer)) {
                    return;
                  }
                  event.preventDefault();
                  setDropTab(value);
                }}
                onDragOver={(event) => {
                  if (!onMoveCardToStatus || !isCardDrag(event.dataTransfer)) {
                    return;
                  }
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDropTab(value);
                }}
                onDragLeave={(event) => {
                  const next = event.relatedTarget as Node | null;
                  if (next && event.currentTarget.contains(next)) {
                    return;
                  }
                  setDropTab((current) => (current === value ? null : current));
                }}
                onDrop={(event) => {
                  if (!onMoveCardToStatus) {
                    return;
                  }
                  event.preventDefault();
                  setDropTab(null);
                  const cardId = readDraggedCardId(event.dataTransfer);
                  if (cardId) {
                    onMoveCardToStatus(cardId, statusForTab(value));
                  }
                }}
              >
                <span>{label}</span>
                <strong>{sectionCounts[value]}</strong>
              </button>
            ))}
          </nav>
        ) : null}

        {!isLearningMode ? (
          <section className="toolbar" aria-label="Search and filters">
            <label className="search">
              <span aria-hidden="true" className="searchIcon">
                ⌕
              </span>
              <input
                aria-label="Search words, translations, notes"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search words, translations, notes"
                type="search"
                value={query}
              />
            </label>
          </section>
        ) : null}

        {isLearningMode ? (
          isAllFolder ? (
            <FolderPickerPage folders={folders} onSelect={onSelectFolderForLearning} />
          ) : activeSessionMode === null ? (
            <LearningHub
              dueCount={dueCount}
              sessionSize={sessionSize}
              poolSize={poolSize}
              folderWordCount={reviewCards.length}
              preferredMode={preferredMode}
              onStart={startSession}
            />
          ) : activeSessionMode === "review" ? (
            <ReviewSession
              cards={reviewCards}
              sessionScope={sessionScope}
              stats={{ due: dueCount, saved: savedCount, known: knownCount }}
              onReviewGrade={onReviewGrade}
              onExitLearning={onExitLearning}
              hasAheadOfSchedule={hasAheadOfSchedule}
              onEndEarlyControlsChange={setReviewEndEarly}
            />
          ) : (
            <LearningSession
              cards={questCards}
              optionPool={optionPool}
              sessionScope={sessionScope}
              onReviewGrade={onReviewGrade}
              onExitLearning={onExitLearning}
              hasAheadOfSchedule={hasAheadOfSchedule}
            />
          )
        ) : (
          <div className="wordboxGrid">
            {cards.map((word) => (
              <div
                key={word.id}
                className={`wordboxCardDrag${draggingCardId === word.id ? " isDragging" : ""}`}
                draggable
                onDragStart={(event) => {
                  setDraggedCardId(event.dataTransfer, word.id);
                  setDraggingCardId(word.id);
                }}
                onDragEnd={() => setDraggingCardId(null)}
              >
                <div className="wordboxCardPronounce">
                  <PronounceButton word={word.word} compact />
                </div>
                <Card
                  title={word.word}
                  subtitle={word.meaning}
                  className="wordboxCard"
                  footer={
                    <div className="cardFooterActions">
                      {word.folder ? <span className="chip">{word.folder}</span> : null}
                      <span className={`chip status ${word.status}`}>{word.status}</span>
                      {word.tags.map((tag) => (
                        <span className="chip" key={tag}>
                          {tag}
                        </span>
                      ))}
                      <button
                        className="chip danger"
                        onClick={() => onDeleteCard(word.id)}
                        onPointerDown={(event) => event.stopPropagation()}
                        type="button"
                      >
                        delete
                      </button>
                    </div>
                  }
                >
                  {word.example ? <blockquote>{word.example}</blockquote> : null}
                </Card>
              </div>
            ))}

            {cards.length === 0 && (
              <div className="emptyState">
                <h2>No cards found</h2>
                <p>
                  {query.trim()
                    ? "Try a different search."
                    : filter === "learning"
                      ? "No words in Learning yet."
                      : filter === "known"
                        ? "No known words yet."
                        : "This folder is empty."}
                </p>
                {filter === "all" ? (
                  <button
                    className="primary emptyStateAction"
                    onClick={onOpenNewCardForm}
                    type="button"
                  >
                    Add a new word
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>

      {isFolderPickerOpen ? (
        <FolderPickerModal
          folders={folders}
          onClose={() => setIsFolderPickerOpen(false)}
          onSelect={handlePickFolder}
        />
      ) : null}
    </>
  );
}
