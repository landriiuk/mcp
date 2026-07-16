import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { Wordbox } from "./components/wordbox/Wordbox";
import { CardEditor } from "./components/wordbox/add-card/CardEditor";
import { ImportWords } from "./components/wordbox/import/ImportWords";
import { FolderSidebar } from "./components/sidebar/FolderSidebar";
import { apiBaseUrl, FOLDER_NAME_MAX_LENGTH, FOLDER_NAME_TOO_LONG_ERROR } from "./constants";
import { sampleCards } from "./data/sampleCards";
import type { Card, Draft } from "./types/card";
import { getImportTargetFolder, type ImportWordRow } from "./utils/importWords";
import {
  countSessionPool,
  gradeCard,
  isDue,
  isNewCard,
  isScheduledDue,
  reviewFieldsForStatus,
  type ReviewGrade,
} from "./utils/reviewAlgorithm";
import {
  folderPath,
  isReservedFolderName,
  learningPath,
  parseLocation,
} from "./utils/routes";
import { installButtonClickGuard } from "./utils/buttonClickGuard";

const emptyDraft: Draft = {
  word: "",
  meaning: "",
  example: "",
  status: "new",
  tags: [],
  folder: "General",
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { folder: activeFolder, isLearningMode } = useMemo(
    () => parseLocation(location.pathname),
    [location.pathname],
  );

  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "learning" | "known">("all");
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      const stored =
        window.localStorage.getItem("inklex.sidebarCollapsed") ??
        window.localStorage.getItem("wordly.sidebarCollapsed");
      return stored === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "inklex.sidebarCollapsed",
        isSidebarCollapsed ? "1" : "0",
      );
    } catch {
      // Ignore storage failures.
    }
  }, [isSidebarCollapsed]);

  useEffect(() => installButtonClickGuard(), []);

  function toggleSidebar() {
    setIsSidebarCollapsed((collapsed) => {
      if (!collapsed) {
        cancelFolderEditing();
      }
      return !collapsed;
    });
  }

  useEffect(() => {
    async function loadWords() {
      try {
        const [wordsResponse, foldersResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/words`),
          fetch(`${apiBaseUrl}/folders`),
        ]);

        if (!wordsResponse.ok) {
          throw new Error("Failed to load words from backend");
        }

        const data = await wordsResponse.json();
        const apiFolders = foldersResponse.ok ? await foldersResponse.json() : [];
        const folderNames = Array.isArray(apiFolders)
          ? apiFolders.filter((name: unknown): name is string => typeof name === "string")
          : [];

        setCards(data);
        setFolders(
          Array.from(
            new Set([
              ...folderNames,
              ...data.map((card: Card) => card.folder).filter(Boolean),
            ]),
          ).sort(),
        );
      } catch (error) {
        setLoadError("Unable to load backend data. Using local sample words.");
        setCards(sampleCards);
        setFolders(["General", "Work", "Study", "Travel"]);
      } finally {
        setIsLoading(false);
      }
    }

    loadWords();
  }, []);

  useEffect(() => {
    if (isLoading || activeFolder === "all") {
      return;
    }

    const folderExists = folders.some(
      (folder) => folder.toLowerCase() === activeFolder.toLowerCase(),
    );

    if (!folderExists) {
      navigate("/", { replace: true });
    }
  }, [isLoading, activeFolder, folders, navigate]);

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cards.filter((card) => {
      const matchesFolder = activeFolder === "all" || card.folder === activeFolder;

      if (isLearningMode) {
        // Due-first pool: scheduled due (incl. decayed known) + unscheduled new.
        return matchesFolder && isDue(card);
      }

      const matchesFilter = filter === "all" || card.status === filter;
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
  }, [cards, filter, query, activeFolder, isLearningMode]);

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
      const folderName = card.folder?.trim();
      if (!folderName) {
        return accumulator;
      }

      if (!accumulator[folderName]) {
        accumulator[folderName] = { all: 0, new: 0, learning: 0, known: 0 };
      }

      accumulator[folderName].all += 1;
      accumulator[folderName][card.status] += 1;
      return accumulator;
    }, {});
  }, [cards]);

  const optionPool = useMemo(() => {
    if (activeFolder === "all") {
      return cards;
    }

    return cards.filter((card) => card.folder === activeFolder);
  }, [cards, activeFolder]);

  const folderPracticeCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesFolder = activeFolder === "all" || card.folder === activeFolder;
      return matchesFolder && isDue(card);
    });
  }, [cards, activeFolder]);

  const sessionPool = useMemo(
    () => countSessionPool(folderPracticeCards),
    [folderPracticeCards],
  );

  const hasAheadOfSchedule = useMemo(() => {
    return cards.some((card) => {
      const matchesFolder = activeFolder === "all" || card.folder === activeFolder;
      if (!matchesFolder || card.status === "known") {
        return false;
      }
      return Boolean(card.next_review_at) && !isScheduledDue(card) && !isNewCard(card);
    });
  }, [cards, activeFolder]);

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
    { value: "learning", label: "Learning" },
    { value: "known", label: "Known" },
  ] as const;

  function selectFolder(folder: string) {
    setFilter("all");
    navigate(folderPath(folder));
  }

  function startLearning() {
    navigate(learningPath(activeFolder));
  }

  function exitLearning() {
    navigate(folderPath(activeFolder));
  }

  useEffect(() => {
    setFolders((currentFolders) => {
      const nextFolders = Array.from(
        new Set([...currentFolders, ...cards.map((card) => card.folder).filter(Boolean)]),
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

    if (isReservedFolderName(normalizedName)) {
      return `"${normalizedName}" is reserved. Choose another name.`;
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
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
    setEditingFolder(null);
    setIsCreatingFolder(true);
    setFolderDraft("");
    setFolderError(null);
  }

  function startEditingFolder(folder: string) {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
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
        setFilter("all");
        navigate(folderPath(normalizedName));
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
        navigate(folderPath(normalizedName));
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
        navigate("/");
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
    setFilter("all");
    navigate(folderPath(targetFolder));
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
            .filter(Boolean)
            .slice(0, 3),
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
            ...currentFolders,
            ...importedWords.map((card: Card) => card.folder).filter(Boolean),
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

    const review = reviewFieldsForStatus("new");
    const existing = editingId ? cards.find((entry) => entry.id === editingId) : null;
    const payload = {
      word,
      meaning,
      example: card.example.trim(),
      status: "new" as const,
      tags: card.tags.slice(0, 3),
      folder: card.folder.trim(),
      interval_days: existing?.interval_days ?? review.interval_days,
      next_review_at: existing?.next_review_at ?? review.next_review_at,
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

  async function deleteCard(cardId: string) {
    const response = await fetch(`${apiBaseUrl}/words/${cardId}`, {
      method: "DELETE",
    });

    // 204 = deleted; 404 = already gone on server (stale UI after mock DB reset)
    if (!response.ok && response.status !== 404) {
      return;
    }

    setCards((current) => current.filter((card) => card.id !== cardId));
    if (editingId === cardId) {
      resetForm();
    }
  }

  async function handleReviewGrade(cardId: string, grade: ReviewGrade) {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    const review = gradeCard(card, grade);
    const optimisticCard = { ...card, ...review };

    setCards((current) =>
      current.map((item) => (item.id === cardId ? optimisticCard : item)),
    );

    const rollback = () => {
      setCards((current) =>
        current.map((item) => (item.id === cardId ? card : item)),
      );
    };

    try {
      const response = await fetch(`${apiBaseUrl}/words/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(optimisticCard),
      });

      if (!response.ok) {
        rollback();
        return;
      }

      const updatedCard = await response.json();
      const parsedInterval = Number(updatedCard.interval_days);
      setCards((current) =>
        current.map((item) =>
          item.id === cardId
            ? {
                ...optimisticCard,
                ...updatedCard,
                interval_days: Number.isFinite(parsedInterval)
                  ? parsedInterval
                  : review.interval_days,
                next_review_at:
                  updatedCard.next_review_at !== undefined
                    ? updatedCard.next_review_at
                    : review.next_review_at,
                status: updatedCard.status || review.status,
              }
            : item,
        ),
      );
    } catch {
      rollback();
    }
  }

  return (
    <main className={`app${isSidebarCollapsed ? " sidebarCollapsed" : ""}`}>
      <FolderSidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        activeFolder={activeFolder}
        folders={folders}
        getFolderSectionCounts={getFolderSectionCounts}
        onSelectFolder={selectFolder}
        isCreatingFolder={isCreatingFolder}
        editingFolder={editingFolder}
        folderDraft={folderDraft}
        folderError={folderError}
        folderInputRef={folderInputRef}
        onStartCreatingFolder={startCreatingFolder}
        onStartEditingFolder={startEditingFolder}
        onDeleteFolder={deleteFolder}
        onFolderDraftChange={handleFolderDraftChange}
        onFolderKeyDown={handleFolderInputKeyDown}
        onFolderBlur={handleFolderInputBlur}
        onFolderPaste={handleFolderPaste}
      />

      <Wordbox
        cards={filteredCards}
        optionPool={optionPool}
        sessionScope={activeFolder}
        query={query}
        onQueryChange={setQuery}
        onOpenNewCardForm={openNewCardForm}
        onOpenImport={openImportModal}
        filter={filter}
        sectionCounts={getFolderSectionCounts(activeFolder)}
        sections={folderSections}
        onFilterChange={setFilter}
        onDeleteCard={deleteCard}
        onReviewGrade={handleReviewGrade}
        isLearningMode={isLearningMode}
        dueCount={sessionPool.due}
        newCount={sessionPool.news}
        sessionSize={sessionPool.sessionSize}
        hasAheadOfSchedule={hasAheadOfSchedule}
        onStartLearning={startLearning}
        onExitLearning={exitLearning}
      />

      {isEditorOpen && (
        <div className="modalOverlay" onClick={resetForm}>
          <div className="modalWindow" onClick={(event) => event.stopPropagation()}>
            <CardEditor
              key={editingId ?? `new-${activeFolder}`}
              editingId={editingId ?? undefined}
              folders={folders}
              preferredFolder={activeFolder}
              onSubmit={handleSubmit}
              onReset={resetForm}
              onCreateFolder={async (name) => {
                const response = await fetch(`${apiBaseUrl}/folders`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name }),
                });

                if (!response.ok) {
                  const data = await response.json().catch(() => ({}));
                  throw new Error(data.error || "Failed to create folder");
                }

                setFolders((currentFolders) =>
                  Array.from(new Set([...currentFolders, name])).sort(),
                );
                return name;
              }}
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
