import './Wordbox.css';
import Card from './card/Card';

interface WordboxCard {
  id: string;
  word: string;
  meaning: string;
  example: string;
  status: 'new' | 'learning' | 'known';
  tags: string[];
}

interface WordboxProps {
  cards: WordboxCard[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenNewCardForm: () => void;
}

export function Wordbox({ cards, query, onQueryChange, onOpenNewCardForm }: WordboxProps) {
  return (
    <section className="content">
      <section className="toolbar" aria-label="Search and filters">
        <label className="search">
          <input
            aria-label="Search words, translations, notes"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search words, translations, notes"
            type="search"
            value={query}
          />
        </label>

        <button className="primary" onClick={onOpenNewCardForm} type="button">
          + Add card
        </button>
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
                <span className={`chip status ${word.status}`}>{word.status}</span>
                {word.tags.map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                  </span>
                ))}
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
