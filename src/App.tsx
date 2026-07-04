import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Wordbox } from "./components/wordbox/Wordbox";
import { CardEditor } from './components/wordbox/add-card/CardEditor';

type CardStatus = "new" | "learning" | "known";

type Card = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string[];
};

type Draft = {
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string;
};

const initialCards: Card[] = [
  {
    id: "brief",
    word: "brief",
    meaning: "short in time, duration, or length",
    example: "Keep the update brief and useful.",
    status: "learning",
    tags: ["work"],
  },
  {
    id: "accurate",
    word: "accurate",
    meaning: "correct and without mistakes",
    example: "The report has accurate numbers.",
    status: "new",
    tags: ["writing"],
  },
  {
    id: "smooth",
    word: "smooth",
    meaning: "easy and without problems or interruptions",
    example: "The meeting had a smooth start.",
    status: "known",
    tags: ["speaking"],
  },
];

const emptyDraft: Draft = {
  word: "",
  meaning: "",
  example: "",
  status: "new",
  tags: "",
};
const apiBaseUrl = import.meta.env.VITE_API_URL || "/api";
function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CardStatus | "all">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWords() {
      try {
        const response = await fetch(`${apiBaseUrl}/words`);
        if (!response.ok) {
          throw new Error("Failed to load words from backend");
        }

        const data = await response.json();
        setCards(data);
      } catch (error) {
        setLoadError("Unable to load backend data. Using local sample words.");
        setCards(initialCards);
      } finally {
        setIsLoading(false);
      }
    }

    loadWords();
  }, []);

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cards.filter((card) => {
      const matchesFilter = filter === "all" || card.status === filter;
      const searchable = [
        card.word,
        card.meaning,
        card.example,
        card.status,
        ...card.tags,
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && searchable.includes(normalizedQuery);
    });
  }, [cards, filter, query]);

  const counts = useMemo(
    () => ({
      all: cards.length,
      new: cards.filter((card) => card.status === "new").length,
      learning: cards.filter((card) => card.status === "learning").length,
      known: cards.filter((card) => card.status === "known").length,
    }),
    [cards],
  );

  function resetForm() {
    setEditingId(null);
    setIsEditorOpen(false);
  }

  function openNewCardForm() {
    setEditingId(null);
    setIsEditorOpen(true);
  }

  async function handleSubmit(card: Draft) {
    const word = card.word.trim();
    const meaning = card.meaning.trim();

    if (!word || !meaning) {
      return;
    }

    const payload = {
      word,
      meaning,
      example: card.example.trim(),
      status: card.status,
      tags: card.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    if (editingId) {
      const response = await fetch(`/api/words/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return;
      }

      const updatedCard = await response.json();
      setCards((current) =>
        current.map((card) => (card.id === editingId ? updatedCard : card)),
      );
    } else {
      const response = await fetch(`${apiBaseUrl}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return;
      }

      const createdCard = await response.json();
      setCards((current) => [createdCard, ...current]);
    }

    resetForm();
  }

  async function deleteCard(cardId) {
    const response = await fetch(`/api/words/${cardId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      return;
    }

    setCards((current) => current.filter((card) => card.id !== cardId));
    if (editingId === cardId) {
      resetForm();
    }
  }

  async function markKnown(cardId) {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    const response = await fetch(`/api/words/${cardId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...card,
        status: "known",
      }),
    });

    if (!response.ok) {
      return;
    }

    const updatedCard = await response.json();
    setCards((current) =>
      current.map((item) => (item.id === cardId ? updatedCard : item)),
    );
  }

  return (
    <main className="app">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Wordly home">
          <span className="brandIcon">Aa</span>
          <span>Wordly</span>
        </a>

        <nav className="nav" aria-label="Card sections">
          {[
            { value: "all", label: "Cards", count: counts.all },
            { value: "learning", label: "Review", count: counts.learning },
            { value: "known", label: "Known", count: counts.known },
          ].map(({ value, label, count }) => (
            <button
              className={filter === value ? "active" : ""}
              key={value}
              onClick={() => setFilter(value as CardStatus | "all")}
              type="button"
            >
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </nav>
      </aside>
      <Wordbox
        cards={filteredCards}
        query={query}
        onQueryChange={setQuery}
        onOpenNewCardForm={openNewCardForm}
      />

      {isEditorOpen && (
        <div className="modalOverlay" onClick={resetForm}>
          <div className="modalWindow" onClick={(event) => event.stopPropagation()}>
            <CardEditor
              editingId={editingId ?? undefined}
              onSubmit={handleSubmit}
              onReset={resetForm}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
