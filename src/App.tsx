import { useEffect, useMemo, useState, type FormEvent } from "react";
import "./App.css";
import { Wordbox } from "./components/wordbox/Wordbox";
import { CardEditor } from './components/wordbox/add-card/CardEditor';
import { ImportWords } from "./components/wordbox/import/ImportWords";
import type { ImportWordRow } from "./utils/importWords";

type CardStatus = "new" | "learning" | "known";

type Card = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string[];
  folder: string;
};

type Draft = {
  word: string;
  meaning: string;
  example: string;
  status: CardStatus;
  tags: string;
  folder: string;
};

const initialCards: Card[] = [
  {
    id: "brief",
    word: "brief",
    meaning: "short in time, duration, or length",
    example: "Keep the update brief and useful.",
    status: "learning",
    tags: ["work"],
    folder: "Work",
  },
  {
    id: "accurate",
    word: "accurate",
    meaning: "correct and without mistakes",
    example: "The report has accurate numbers.",
    status: "new",
    tags: ["writing"],
    folder: "Study",
  },
  {
    id: "smooth",
    word: "smooth",
    meaning: "easy and without problems or interruptions",
    example: "The meeting had a smooth start.",
    status: "known",
    tags: ["speaking"],
    folder: "General",
  },
];

const emptyDraft: Draft = {
  word: "",
  meaning: "",
  example: "",
  status: "new",
  tags: "",
  folder: "General",
};
const apiBaseUrl = import.meta.env.VITE_API_URL || "/api";
function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState<string[]>(["General"]);
  const [filter, setFilter] = useState<CardStatus | "all">("all");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [folderDraft, setFolderDraft] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
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
        setFolders((currentFolders) => {
          const nextFolders = Array.from(
            new Set(["General", ...currentFolders, ...data.map((card: Card) => card.folder || "General")]),
          ).sort();
          return nextFolders;
        });
      } catch (error) {
        setLoadError("Unable to load backend data. Using local sample words.");
        setCards(initialCards);
        setFolders(["General", "Work", "Study", "Travel"]);
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
      const matchesFolder = activeFolder === "all" || card.folder === activeFolder;
      const searchable = [
        card.word,
        card.meaning,
        card.example,
        card.status,
        card.folder,
        ...card.tags,
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && matchesFolder && searchable.includes(normalizedQuery);
    });
  }, [cards, filter, query, activeFolder]);

  const counts = useMemo(
    () => ({
      all: cards.length,
      new: cards.filter((card) => card.status === "new").length,
      learning: cards.filter((card) => card.status === "learning").length,
      known: cards.filter((card) => card.status === "known").length,
    }),
    [cards],
  );

  const folderCounts = useMemo(() => {
    return cards.reduce<Record<string, number>>((accumulator, card) => {
      const folderName = card.folder || "General";
      accumulator[folderName] = (accumulator[folderName] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [cards]);

  useEffect(() => {
    setFolders((currentFolders) => {
      const nextFolders = Array.from(
        new Set(["General", ...currentFolders, ...cards.map((card) => card.folder || "General")]),
      ).sort();

      return nextFolders;
    });
  }, [cards]);

  function normalizeFolderName(value: string) {
    return value.trim().replace(/\s+/g, " ");
  }

  function resetFolderEditor() {
    setEditingFolder(null);
    setFolderDraft("");
    setFolderError(null);
  }

  async function handleFolderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = normalizeFolderName(folderDraft);

    if (!normalizedName) {
      setFolderError("Folder name is required.");
      return;
    }

    if (editingFolder) {
      const existingFolder = folders.find(
        (folder) => folder.toLowerCase() === normalizedName.toLowerCase() && folder !== editingFolder,
      );

      if (existingFolder) {
        setFolderError("Folder already exists.");
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/folders`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldName: editingFolder, newName: normalizedName }),
        });

        if (!response.ok) {
          throw new Error("Failed to rename folder");
        }

        setFolders((currentFolders) =>
          currentFolders.map((folder) => (folder === editingFolder ? normalizedName : folder)).sort(),
        );
        setCards((currentCards) =>
          currentCards.map((card) => (card.folder === editingFolder ? { ...card, folder: normalizedName } : card)),
        );

        if (activeFolder === editingFolder) {
          setActiveFolder(normalizedName);
        }
      } catch (error) {
        setFolderError("Could not rename folder.");
      }
    } else {
      const existingFolder = folders.find(
        (folder) => folder.toLowerCase() === normalizedName.toLowerCase(),
      );

      if (existingFolder) {
        setFolderError("Folder already exists.");
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/folders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: normalizedName }),
        });

        if (!response.ok) {
          throw new Error("Failed to create folder");
        }

        setFolders((currentFolders) => [...currentFolders, normalizedName].sort());
        setActiveFolder(normalizedName);
      } catch (error) {
        setFolderError("Could not create folder.");
      }
    }

    resetFolderEditor();
  }

  function startEditingFolder(folder: string) {
    setEditingFolder(folder);
    setFolderDraft(folder);
    setFolderError(null);
  }

  async function deleteFolder(folder: string) {
    if (folder === "General") {
      setFolderError("The General folder cannot be deleted.");
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/folders`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folder }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete folder");
      }

      setCards((currentCards) =>
        currentCards.map((card) => (card.folder === folder ? { ...card, folder: "General" } : card)),
      );
      setFolders((currentFolders) => currentFolders.filter((currentFolder) => currentFolder !== folder));

      if (activeFolder === folder) {
        setActiveFolder("all");
      }
    } catch (error) {
      setFolderError("Could not delete folder.");
    }

    resetFolderEditor();
  }

  function resetForm() {
    setEditingId(null);
    setIsEditorOpen(false);
  }

  function openNewCardForm() {
    setEditingId(null);
    setIsEditorOpen(true);
  }

  function openImportModal() {
    setIsImportOpen(true);
  }

  function closeImportModal() {
    setIsImportOpen(false);
  }

  async function handleImportWords(rows: ImportWordRow[]) {
    const response = await fetch(`${apiBaseUrl}/words/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        words: rows.map((row) => ({
          word: row.word,
          meaning: row.meaning,
          example: row.example,
          status: row.status,
          tags: row.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          folder: row.folder,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to import words");
    }

    const data = await response.json();
    const importedWords = Array.isArray(data.words) ? data.words : [];

    if (importedWords.length > 0) {
      setCards((current) => [...importedWords, ...current]);
      setFolders((currentFolders) =>
        Array.from(
          new Set([
            "General",
            ...currentFolders,
            ...importedWords.map((card: Card) => card.folder || "General"),
          ]),
        ).sort(),
      );
    }

    return {
      imported: data.imported ?? importedWords.length,
      skipped: data.skipped ?? 0,
      errors: (data.errors ?? []).map(
        (entry: { row?: number; error?: string }) =>
          entry.row ? `Row ${entry.row}: ${entry.error}` : entry.error || "Import error",
      ),
    };
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
      folder: card.folder.trim() || "General",
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

        <div className="folderPanel">
          <div className="folderPanelHeader">
            <p className="sectionLabel">Folders</p>
            <span className="folderHint">CRUD</span>
          </div>

          <form className="folderForm" onSubmit={handleFolderSubmit}>
            <input
              className="folderInput"
              onChange={(event) => {
                setFolderDraft(event.target.value);
                setFolderError(null);
              }}
              placeholder={editingFolder ? "Rename folder" : "New folder"}
              type="text"
              value={folderDraft}
            />
            <button className="folderActionButton" type="submit">
              {editingFolder ? "Save" : "Add"}
            </button>
            {editingFolder ? (
              <button className="folderActionButton ghost" onClick={resetFolderEditor} type="button">
                Cancel
              </button>
            ) : null}
          </form>

          {folderError ? <p className="folderError">{folderError}</p> : null}

          <div className="folderList">
            <button
              className={activeFolder === "all" ? "folderButton active" : "folderButton"}
              onClick={() => setActiveFolder("all")}
              type="button"
            >
              <span>All</span>
              <strong>{counts.all}</strong>
            </button>
            {folders.map((folder) => (
              <div className={activeFolder === folder ? "folderRow active" : "folderRow"} key={folder}>
                <button
                  className="folderButton"
                  onClick={() => setActiveFolder(folder)}
                  type="button"
                >
                  <span>{folder}</span>
                  <strong>{folderCounts[folder] ?? 0}</strong>
                </button>
                <div className="folderInlineActions">
                  <button
                    className="folderInlineButton"
                    onClick={() => startEditingFolder(folder)}
                    type="button"
                    title={`Rename ${folder}`}
                    aria-label={`Rename ${folder}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 17.5V20h2.5l7.4-7.4-2.5-2.5L4 17.5Zm13.7-8.3a.8.8 0 0 0 0-1.2l-1.3-1.3a.8.8 0 0 0-1.2 0l-1.6 1.6 2.5 2.5 1.6-1.6Z" />
                    </svg>
                  </button>
                  <button
                    className="folderInlineButton"
                    disabled={folder === "General"}
                    onClick={() => deleteFolder(folder)}
                    type="button"
                    title={`Delete ${folder}`}
                    aria-label={`Delete ${folder}`}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 6V4h8v2h4v2H4V6h4Zm2 4h2v8H10v-8Zm4 0h2v8h-2v-8Z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
      <Wordbox
        cards={filteredCards}
        query={query}
        onQueryChange={setQuery}
        onOpenNewCardForm={openNewCardForm}
        onOpenImport={openImportModal}
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

      {isImportOpen && (
        <div className="modalOverlay" onClick={closeImportModal}>
          <div className="modalWindow" onClick={(event) => event.stopPropagation()}>
            <ImportWords onClose={closeImportModal} onImport={handleImportWords} />
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
