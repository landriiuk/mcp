import './Wordbox.css';
import Card from './card/Card';

interface WordboxCard {
  id: string;
  word: string;
  meaning: string;
  example: string;
  status: 'new' | 'learning' | 'known';
  tags: string[];
  folder: string;
}

type CardFilter = "all" | "learning" | "known";

type Section = {
  value: CardFilter;
  label: string;
};

type SectionCounts = {
  all: number;
  learning: number;
  known: number;
};

interface WordboxProps {
  cards: WordboxCard[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenNewCardForm: () => void;
  onOpenImport: () => void;
  filter: CardFilter;
  sectionCounts: SectionCounts;
  sections: readonly Section[];
  onFilterChange: (value: CardFilter) => void;
  onDeleteCard: (cardId: string) => void;
}

export function Wordbox({
  cards,
  query,
  onQueryChange,
  onOpenNewCardForm,
  onOpenImport,
  filter,
  sectionCounts,
  sections,
  onFilterChange,
  onDeleteCard,
}: WordboxProps) {
  const newCount = cards.filter((card) => card.status === "new").length;

  return (
    <section className="content">
      <div className="contentHeader">
        <div>
          <p className="eyebrow">Vocabulary workspace</p>
          <h1>Cards</h1>
          <p className="intro">
            Capture new words and revisit them in short review sessions.
          </p>
        </div>

        <div className="headerMeta">
          <span className="pill">{cards.length} cards</span>
          <button className="ghost" onClick={onOpenImport} type="button">
            Import CSV
          </button>
          <button className="primary" onClick={onOpenNewCardForm} type="button">
            + Add card
          </button>
        </div>
      </div>

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

        <span className="pill subtle">{newCount} new</span>
      </section>

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
            <p>Try a different search.</p>
          </div>
        )}
      </div>
    </section>
  );
}
