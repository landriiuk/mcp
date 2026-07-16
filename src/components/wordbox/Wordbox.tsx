import {
  MAX_NEW_PER_SESSION,
  MAX_SESSION_SIZE,
  type ReviewGrade,
} from "../../utils/reviewAlgorithm";
import "./Wordbox.css";
import Card from "./card/Card";
import { clearPersistedLearningSession, LearningSession } from "./LearningSession";
import type { CardFilter, Section, SectionCounts, WordboxCard } from "./types";
import { useEffect } from "react";

export type { CardFilter, Section, SectionCounts, WordboxCard };

interface WordboxProps {
  cards: WordboxCard[];
  optionPool: WordboxCard[];
  sessionScope: string;
  query: string;
  onQueryChange: (value: string) => void;
  onOpenNewCardForm: () => void;
  onOpenImport: () => void;
  filter: CardFilter;
  sectionCounts: SectionCounts;
  sections: readonly Section[];
  onFilterChange: (value: CardFilter) => void;
  onDeleteCard: (cardId: string) => void;
  onReviewGrade: (cardId: string, grade: ReviewGrade) => void | Promise<void>;
  isLearningMode: boolean;
  dueCount: number;
  newCount: number;
  sessionSize: number;
  hasAheadOfSchedule: boolean;
  onStartLearning: () => void;
  onExitLearning: () => void;
}

function startLearningLabel(dueCount: number, newCount: number, sessionSize: number) {
  if (sessionSize <= 0) {
    return null;
  }
  if (dueCount > 0 && newCount > 0) {
    return `Start Learning (${dueCount} due)`;
  }
  if (dueCount > 0) {
    return `Start Learning (${Math.min(dueCount, MAX_SESSION_SIZE)} due)`;
  }
  return `Start Learning (${sessionSize})`;
}

export function Wordbox({
  cards,
  optionPool,
  sessionScope,
  query,
  onQueryChange,
  onOpenNewCardForm,
  onOpenImport,
  filter,
  sectionCounts,
  sections,
  onFilterChange,
  onDeleteCard,
  onReviewGrade,
  isLearningMode,
  dueCount,
  newCount,
  sessionSize,
  hasAheadOfSchedule,
  onStartLearning,
  onExitLearning,
}: WordboxProps) {
  useEffect(() => {
    if (!isLearningMode) {
      clearPersistedLearningSession();
    }
  }, [isLearningMode]);

  return (
    <section className={`content${isLearningMode ? " contentLearning" : ""}`}>
      <div className="contentHeader">
        <div>
          <h1>{isLearningMode ? "Learning" : "Cards"}</h1>
          <p className="intro">
            {isLearningMode
              ? "Pick the correct meaning for the word. Example stays under a spoiler."
              : "Each session practices up to 10 words that are due now. Your full list stays here — start another session whenever more words are ready."}
          </p>
        </div>

        <div className="headerMeta">
          {isLearningMode ? (
            <button className="ghost" onClick={onExitLearning} type="button">
              Back to cards
            </button>
          ) : (
            <>
              <button className="ghost" onClick={onOpenImport} type="button">
                Import
              </button>
              {filter === "all" ? (
                <button className="ghost" onClick={onOpenNewCardForm} type="button">
                  Add card
                </button>
              ) : null}
              <span
                className={`startLearningWrap${sessionSize <= 0 ? " isDisabled" : ""}`}
                data-tooltip={
                  sessionSize <= 0
                    ? "Nothing due right now. Come back later, or add new words to practice."
                    : dueCount > 0 && newCount > 0
                      ? `${dueCount} due now · up to ${Math.min(newCount, MAX_NEW_PER_SESSION)} new words in this session (max 10).`
                      : dueCount > 0
                        ? `${Math.min(dueCount, MAX_SESSION_SIZE)} words due now. One session = up to 10.`
                        : `${sessionSize} words ready. One session = up to 10.`
                }
              >
                <button
                  className="primary"
                  disabled={sessionSize <= 0}
                  onClick={onStartLearning}
                  type="button"
                >
                  {sessionSize > 0
                    ? startLearningLabel(dueCount, newCount, sessionSize)
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
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => onFilterChange(value)}
              type="button"
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
        <LearningSession
          cards={cards}
          optionPool={optionPool}
          sessionScope={sessionScope}
          onReviewGrade={onReviewGrade}
          hasAheadOfSchedule={hasAheadOfSchedule}
        />
      ) : (
        <div className="wordboxGrid">
          {cards.map((word) => (
            <Card
              key={word.id}
              title={word.word}
              subtitle={word.meaning}
              className="wordboxCard"
              footer={
                <div className="cardFooterActions">
                  <span className="chip">{word.folder}</span>
                  <span className={`chip status ${word.status}`}>{word.status}</span>
                  {word.tags.map((tag) => (
                    <span className="chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                  <button
                    className="chip danger"
                    onClick={() => onDeleteCard(word.id)}
                    type="button"
                  >
                    delete
                  </button>
                </div>
              }
            >
              {word.example ? <blockquote>{word.example}</blockquote> : null}
            </Card>
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
                <button className="primary emptyStateAction" onClick={onOpenNewCardForm} type="button">
                  Add a new word
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
