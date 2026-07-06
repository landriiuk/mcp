import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { Wordbox } from "./components/wordbox/Wordbox";
import { CardEditor } from './components/wordbox/add-card/CardEditor';
import { ImportWords } from "./components/wordbox/import/ImportWords";
import { getImportTargetFolder, type ImportWordRow } from "./utils/importWords";

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
const FOLDER_NAME_MAX_LENGTH = 50;
const FOLDER_NAME_TOO_LONG_ERROR = `Folder name must be ${FOLDER_NAME_MAX_LENGTH} characters or fewer.`;

function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState<string[]>(["General"]);
  const [filter, setFilter] = useState<CardStatus | "all">("all");
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [folderDraft, setFolderDraft] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
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

  const folderStatusCounts = useMemo(() => {
    return cards.reduce<
      Record<string, { all: number; new: number; learning: number; known: number }>
    >((accumulator, card) => {
      const folderName = card.folder || "General";

      if (!accumulator[folderName]) {
        accumulator[folderName] = { all: 0, new: 0, learning: 0, known: 0 };
      }

      accumulator[folderName].all += 1;
      accumulator[folderName][card.status] += 1;
      return accumulator;
    }, {});
  }, [cards]);

  function getFolderSectionCounts(folder: string) {
    if (folder === "all") {
      return {
        all: counts.all,
        learning: counts.learning,
        known: counts.known,
      };
    }

    const folderCounts = folderStatusCounts[folder] ?? { all: 0, new: 0, learning: 0, known: 0 };

    return {
      all: folderCounts.all,
      learning: folderCounts.learning,
      known: folderCounts.known,
    };
  }

  const folderSections = [
    { value: "all", label: "Cards" },
    { value: "learning", label: "Review" },
    { value: "known", label: "Known" },
  ] as const;

  function selectFolder(folder: string) {
    setActiveFolder(folder);
    setFilter("all");
  }

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

  function validateFolderName(value: string) {
    const normalizedName = normalizeFolderName(value);

    if (!normalizedName) {
      return "Folder name is required.";
    }

    if (normalizedName.length > FOLDER_NAME_MAX_LENGTH) {
      return FOLDER_NAME_TOO_LONG_ERROR;
    }

    return null;
  }

  function cancelFolderEditing() {
    setEditingFolder(null);
    setIsCreatingFolder(false);
    setFolderDraft("");
    setFolderError(null);
  }

  function startCreatingFolder() {
    setEditingFolder(null);
    setIsCreatingFolder(true);
    setFolderDraft("");
    setFolderError(null);
  }

  function startEditingFolder(folder: string) {
    setIsCreatingFolder(false);
    setEditingFolder(folder);
    setFolderDraft(folder);
    setFolderError(null);
  }

  useEffect(() => {
    if ((isCreatingFolder || editingFolder) && folderInputRef.current) {
      folderInputRef.current.focus();
      folderInputRef.current.select();
    }
  }, [isCreatingFolder, editingFolder]);

  function handleFolderDraftChange(rawValue: string) {
    if (rawValue.length > FOLDER_NAME_MAX_LENGTH) {
      setFolderDraft(rawValue.slice(0, FOLDER_NAME_MAX_LENGTH));
      setFolderError(FOLDER_NAME_TOO_LONG_ERROR);
      return;
    }

    setFolderDraft(rawValue);
    setFolderError(null);
  }

  function handleFolderPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pastedText = event.clipboardData.getData("text");
    if (!pastedText) {
      return;
    }

    const input = event.currentTarget;
    const start = input.selectionStart ?? folderDraft.length;
    const end = input.selectionEnd ?? folderDraft.length;
    const nextValue = `${folderDraft.slice(0, start)}${pastedText}${folderDraft.slice(end)}`;

    if (nextValue.length > FOLDER_NAME_MAX_LENGTH) {
      setFolderError(FOLDER_NAME_TOO_LONG_ERROR);
    }
  }

  function showFolderLimitErrorIfNeeded(event: React.KeyboardEvent<HTMLInputElement>) {
    const allowedKeys = new Set([
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Tab",
      "Enter",
      "Escape",
    ]);

    if (allowedKeys.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    const input = event.currentTarget;
    const start = input.selectionStart ?? folderDraft.length;
    const end = input.selectionEnd ?? folderDraft.length;
    const hasSelection = start !== end;
    const nextLength = hasSelection
      ? folderDraft.length - (end - start) + 1
      : folderDraft.length + 1;

    if (nextLength > FOLDER_NAME_MAX_LENGTH) {
      setFolderError(FOLDER_NAME_TOO_LONG_ERROR);
    }
  }

  function handleFolderInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitFolderDraft();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelFolderEditing();
      return;
    }

    showFolderLimitErrorIfNeeded(event);
  }

  async function submitFolderDraft() {
    const validationError = validateFolderName(folderDraft);
    if (validationError) {
      setFolderError(validationError);
      return;
    }

    const normalizedName = normalizeFolderName(folderDraft);

    if (isCreatingFolder) {
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
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create folder");
        }

        setFolders((currentFolders) => [...currentFolders, normalizedName].sort());
        setActiveFolder(normalizedName);
        setFilter("all");
        cancelFolderEditing();
      } catch (error) {
        setFolderError(error instanceof Error ? error.message : "Could not create folder.");
      }
      return;
    }

    if (!editingFolder) {
      return;
    }

    if (normalizedName === editingFolder) {
      cancelFolderEditing();
      return;
    }

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
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to rename folder");
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

      cancelFolderEditing();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Could not rename folder.");
    }
  }

  function handleFolderInputBlur() {
    cancelFolderEditing();
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

    cancelFolderEditing();
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

  function handleImportSuccess(targetFolder: string) {
    setActiveFolder(targetFolder);
    setFilter("all");
    closeImportModal();
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
      targetFolder: getImportTargetFolder(rows),
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
      const response = await fetch(`${apiBaseUrl}/words/${editingId}`, {
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
    const response = await fetch(`${apiBaseUrl}/words/${cardId}`, {
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

    const response = await fetch(`${apiBaseUrl}/words/${cardId}`, {
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

        <div className="folderPanel">
          <div className="folderAllRow">
            <button
              className={activeFolder === "all" ? "folderButton folderAllButton active" : "folderButton folderAllButton"}
              onClick={() => selectFolder("all")}
              type="button"
            >
              <span>All</span>
              <strong>{getFolderSectionCounts("all").all}</strong>
            </button>
            <button
              className="folderAddButton"
              disabled={isCreatingFolder}
              onClick={startCreatingFolder}
              type="button"
              title="Create folder"
              aria-label="Create folder"
            >
              +
            </button>
          </div>

          <div className="folderList">
            {folders.map((folder) => {
              const folderCount = getFolderSectionCounts(folder).all;
              const isActiveFolder = activeFolder === folder;
              const isEditing = editingFolder === folder;

              return (
                <div className="folderRowGroup" key={folder}>
                  <div
                    className={`folderRow${isActiveFolder ? " active" : ""}${isEditing ? " editing" : ""}`}
                  >
                    {isEditing ? (
                      <input
                        ref={folderInputRef}
                        aria-label={`Rename ${folder}`}
                        aria-invalid={folderError ? true : undefined}
                        className="folderInlineInput"
                        onChange={(event) => handleFolderDraftChange(event.target.value)}
                        onKeyDown={handleFolderInputKeyDown}
                        onBlur={handleFolderInputBlur}
                        onPaste={handleFolderPaste}
                        type="text"
                        value={folderDraft}
                      />
                    ) : (
                      <button
                        className="folderButton"
                        onClick={() => selectFolder(folder)}
                        type="button"
                      >
                        <span>{folder}</span>
                        <strong>{folderCount}</strong>
                      </button>
                    )}
                    {isEditing ? (
                      <strong className="folderCountBadge">{folderCount}</strong>
                    ) : (
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
                    )}
                  </div>
                  {isEditing && folderError ? (
                    <p className="folderInlineError" role="alert">
                      {folderError}
                    </p>
                  ) : null}
                </div>
              );
            })}

            {isCreatingFolder ? (
              <div className="folderRowGroup">
                <div className="folderRow creating">
                  <input
                    ref={folderInputRef}
                    aria-label="New folder name"
                    aria-invalid={folderError ? true : undefined}
                    className="folderInlineInput"
                    onChange={(event) => handleFolderDraftChange(event.target.value)}
                    onKeyDown={handleFolderInputKeyDown}
                    onBlur={handleFolderInputBlur}
                    onPaste={handleFolderPaste}
                    placeholder="Folder name"
                    type="text"
                    value={folderDraft}
                  />
                  <strong className="folderCountBadge">0</strong>
                </div>
                {folderError ? (
                  <p className="folderInlineError" role="alert">
                    {folderError}
                  </p>
                ) : null}
              </div>
            ) : null}

            {folderError && !isCreatingFolder && !editingFolder ? (
              <p className="folderInlineError" role="alert">
                {folderError}
              </p>
            ) : null}
          </div>
        </div>
      </aside>
      <Wordbox
        cards={filteredCards}
        query={query}
        onQueryChange={setQuery}
        onOpenNewCardForm={openNewCardForm}
        onOpenImport={openImportModal}
        filter={filter}
        sectionCounts={getFolderSectionCounts(activeFolder)}
        sections={folderSections}
        onFilterChange={setFilter}
        onDeleteCard={deleteCard}
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
            <ImportWords
              onClose={closeImportModal}
              onImport={handleImportWords}
              onImportSuccess={handleImportSuccess}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
