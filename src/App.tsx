import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { Wordbox } from "./components/wordbox/Wordbox";
import { CardEditor } from "./components/wordbox/add-card/CardEditor";
import { ImportWords } from "./components/wordbox/import/ImportWords";
import { FolderSidebar } from "./components/sidebar/FolderSidebar";
import { FOLDER_NAME_MAX_LENGTH, FOLDER_NAME_TOO_LONG_ERROR } from "./constants";
import {
  createFolder,
  createWord,
  deleteFolderDoc,
  deleteWord,
  importWords,
  listFolders,
  purgeLegacyGeneralFolder,
  reconcileCardFolderIds,
  renameFolder,
  saveWord,
} from "./data/api";
import { sampleCards, sampleFolders } from "./data/sampleCards";
import { isDataStoreConfigured, useMockDb } from "./lib/dataMode";
import type { Card, Draft, Folder } from "./types/card";
import { type ImportWordRow } from "./utils/importWords";
import {
  countSessionPool,
  gradeCard,
  isNewCard,
  isQuestEligible,
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
  folder: "",
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    folderId: activeFolder,
    isLearningMode,
    invalidFolderRef,
  } = useMemo(() => parseLocation(location.pathname), [location.pathname]);

  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const folderNameById = useMemo(() => {
    return new Map(folders.map((folder) => [folder.id, folder.name]));
  }, [folders]);

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

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
        cancelFolderEditing();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1024px)");
    const onChange = () => {
      if (!media.matches) {
        setIsMobileNavOpen(false);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function closeMobileNav() {
    setIsMobileNavOpen(false);
    cancelFolderEditing();
  }

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
        if (!isDataStoreConfigured()) {
          throw new Error("Data store is not configured");
        }

        if (import.meta.env.DEV && useMockDb()) {
          console.info("[InkLex] Local mock DB (localStorage). No Firebase network.");
        }

        const purged = await purgeLegacyGeneralFolder();
        let cardsData = purged.cards;
        let foldersData = purged.folders.filter(
          (folder) => folder.name.trim().toLowerCase() !== "general",
        );
        cardsData = cardsData.map((card) =>
          card.folder.trim().toLowerCase() === "general" || card.folder === "General"
            ? { ...card, folder: "" }
            : card,
        );
        cardsData = await reconcileCardFolderIds(cardsData, foldersData);

        setCards(cardsData);
        setFolders(foldersData);
        setLoadError(null);
      } catch {
        setLoadError(
          "Unable to load data store. Check .env (VITE_USE_MOCK_DB or VITE_FIREBASE_*). Using sample words.",
        );
        setCards(sampleCards);
        setFolders([...sampleFolders]);
      } finally {
        setIsLoading(false);
      }
    }

    void loadWords();
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (invalidFolderRef) {
      navigate("/", { replace: true });
      return;
    }

    if (activeFolder === "all") {
      return;
    }

    const folderExists = folders.some((folder) => folder.id === activeFolder);

    if (!folderExists) {
      navigate("/", { replace: true });
    }
  }, [isLoading, activeFolder, folders, navigate, invalidFolderRef]);

  const filteredCards = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return cards.filter((card) => {
      const matchesFolder = activeFolder === "all" || card.folder === activeFolder;
      const matchesFilter = filter === "all" || card.status === filter;
      const folderLabel = folderNameById.get(card.folder) ?? card.folder;
      const searchable = [
        card.word,
        card.meaning,
        card.example,
        card.status,
        folderLabel,
        ...card.tags,
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && matchesFolder && searchable.includes(normalizedQuery);
    });
  }, [cards, filter, query, activeFolder, folderNameById]);

  const displayCards = useMemo(
    () =>
      filteredCards.map((card) => ({
        ...card,
        folder: card.folder ? folderNameById.get(card.folder) ?? card.folder : "",
      })),
    [filteredCards, folderNameById],
  );

  function withFolderLabel(card: Card) {
    return {
      ...card,
      folder: card.folder ? folderNameById.get(card.folder) ?? card.folder : "",
    };
  }

  /** Quest pool: new + learning in the active folder (not All aggregate). */
  const questPoolCards = useMemo(() => {
    if (activeFolder === "all") {
      return [];
    }

    return cards
      .filter((card) => card.folder === activeFolder && isQuestEligible(card))
      .map(withFolderLabel);
  }, [cards, activeFolder, folderNameById]);

  /** Full folder scope for Review mode (no due filter / no max-10). */
  const reviewPoolCards = useMemo(() => {
    if (activeFolder === "all") {
      return [];
    }

    return cards.filter((card) => card.folder === activeFolder).map(withFolderLabel);
  }, [cards, activeFolder, folderNameById]);

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
      const folderId = card.folder?.trim();
      if (!folderId) {
        return accumulator;
      }

      if (!accumulator[folderId]) {
        accumulator[folderId] = { all: 0, new: 0, learning: 0, known: 0 };
      }

      accumulator[folderId].all += 1;
      accumulator[folderId][card.status] += 1;
      return accumulator;
    }, {});
  }, [cards]);

  const optionPool = useMemo(() => {
    if (activeFolder === "all") {
      return cards;
    }

    return cards.filter((card) => card.folder === activeFolder);
  }, [cards, activeFolder]);

  const sessionPool = useMemo(() => countSessionPool(questPoolCards), [questPoolCards]);

  const hasAheadOfSchedule = useMemo(() => {
    if (activeFolder === "all") {
      return false;
    }

    return cards.some((card) => {
      if (card.folder !== activeFolder || !isQuestEligible(card)) {
        return false;
      }
      return Boolean(card.next_review_at) && !isScheduledDue(card) && !isNewCard(card);
    });
  }, [cards, activeFolder]);

  const learningScopeStats = useMemo(() => {
    if (activeFolder === "all") {
      return { saved: counts.all, known: counts.known };
    }
    const folderCounts = folderStatusCounts[activeFolder] ?? {
      all: 0,
      new: 0,
      learning: 0,
      known: 0,
    };
    return { saved: folderCounts.all, known: folderCounts.known };
  }, [activeFolder, counts.all, counts.known, folderStatusCounts]);

  function getFolderSectionCounts(folderId: string) {
    if (folderId === "all") {
      return {
        all: counts.all,
        learning: counts.learning,
        known: counts.known,
      };
    }

    const folderCounts = folderStatusCounts[folderId] ?? {
      all: 0,
      new: 0,
      learning: 0,
      known: 0,
    };

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

  function selectFolder(folderId: string) {
    setFilter("all");
    navigate(folderPath(folderId));
    setIsMobileNavOpen(false);
  }

  function startLearning() {
    if (activeFolder === "all") {
      return;
    }
    navigate(learningPath(activeFolder));
  }

  function selectFolderForLearning(folderId: string) {
    navigate(learningPath(folderId));
  }

  function exitLearning() {
    navigate(folderPath(activeFolder));
  }

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

  function startEditingFolder(folder: Folder) {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
    }
    setIsCreatingFolder(false);
    setEditingFolder(folder.id);
    setFolderDraft(folder.name);
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
        (folder) => folder.name.toLowerCase() === normalizedName.toLowerCase(),
      );

      if (existingFolder) {
        setFolderError("Folder already exists.");
        return;
      }

      try {
        const created = await createFolder(normalizedName);
        setFolders((currentFolders) =>
          [...currentFolders, created].sort((a, b) => a.name.localeCompare(b.name)),
        );
        setFilter("all");
        navigate(folderPath(created.id));
        cancelFolderEditing();
      } catch (error) {
        setFolderError(error instanceof Error ? error.message : "Could not create folder.");
      }
      return;
    }

    if (!editingFolder) {
      return;
    }

    const current = folders.find((folder) => folder.id === editingFolder);
    if (current && normalizedName === current.name) {
      cancelFolderEditing();
      return;
    }

    const existingFolder = folders.find(
      (folder) =>
        folder.name.toLowerCase() === normalizedName.toLowerCase() &&
        folder.id !== editingFolder,
    );

    if (existingFolder) {
      setFolderError("Folder already exists.");
      return;
    }

    try {
      await renameFolder(editingFolder, normalizedName);

      setFolders((currentFolders) =>
        currentFolders
          .map((folder) =>
            folder.id === editingFolder ? { ...folder, name: normalizedName } : folder,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      );

      cancelFolderEditing();
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Could not rename folder.");
    }
  }

  function handleFolderInputBlur() {
    cancelFolderEditing();
  }

  async function deleteFolder(folderId: string) {
    try {
      await deleteFolderDoc(folderId);

      setCards((currentCards) =>
        currentCards.map((card) =>
          card.folder === folderId ? { ...card, folder: "" } : card,
        ),
      );
      setFolders((currentFolders) =>
        currentFolders.filter((currentFolder) => currentFolder.id !== folderId),
      );

      if (activeFolder === folderId) {
        navigate("/");
      }
    } catch {
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

  function handleImportSuccess(targetFolderId: string) {
    setFilter("all");
    navigate(folderPath(targetFolderId));
    closeImportModal();
  }

  async function handleImportWords(rows: ImportWordRow[]) {
    if (!isDataStoreConfigured()) {
      throw new Error(
        "Firebase is not configured on this deploy. Set VITE_FIREBASE_* on Vercel and redeploy.",
      );
    }

    const data = await importWords(
      rows.map((row) => ({
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
    );

    const importedWords = data.words;

    if (importedWords.length > 0) {
      setCards((current) => [...importedWords, ...current]);
      try {
        const refreshedFolders = await listFolders();
        setFolders(refreshedFolders);
      } catch (error) {
        console.error("[InkLex] listFolders after import failed", error);
        // Cards already saved — keep import success even if folder refresh fails.
      }
    }

    return {
      imported: data.imported,
      skipped: data.skipped,
      errors: data.errors.map((entry) =>
        entry.row ? `Row ${entry.row}: ${entry.error}` : entry.error || "Import error",
      ),
      targetFolder: data.targetFolderId,
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
      correct_streak: existing?.correct_streak ?? review.correct_streak,
    };

    try {
      if (editingId) {
        const updatedCard = await saveWord({
          id: editingId,
          ...payload,
        });
        setCards((current) =>
          current.map((entry) => (entry.id === editingId ? updatedCard : entry)),
        );
      } else {
        const createdCard = await createWord(payload);
        setCards((current) => [createdCard, ...current]);
      }
      resetForm();
    } catch {
      // Keep editor open on failure.
    }
  }

  async function deleteCard(cardId: string) {
    try {
      await deleteWord(cardId);
    } catch {
      // Still remove from UI if already gone remotely.
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
      const updatedCard = await saveWord(optimisticCard);
      setCards((current) =>
        current.map((item) => (item.id === cardId ? updatedCard : item)),
      );
    } catch {
      rollback();
    }
  }

  async function moveCardToFolder(cardId: string, folderId: string) {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    const nextFolder = folderId === "all" ? "" : folderId;
    if (card.folder === nextFolder) {
      return;
    }

    const optimisticCard = { ...card, folder: nextFolder };
    setCards((current) =>
      current.map((item) => (item.id === cardId ? optimisticCard : item)),
    );

    try {
      const updatedCard = await saveWord(optimisticCard);
      setCards((current) =>
        current.map((item) => (item.id === cardId ? updatedCard : item)),
      );
    } catch {
      setCards((current) =>
        current.map((item) => (item.id === cardId ? card : item)),
      );
    }
  }

  async function moveCardToStatus(
    cardId: string,
    status: "new" | "learning" | "known",
  ) {
    const card = cards.find((entry) => entry.id === cardId);
    if (!card || card.status === status) {
      return;
    }

    const review = reviewFieldsForStatus(status);
    const optimisticCard = { ...card, status, ...review };
    setCards((current) =>
      current.map((item) => (item.id === cardId ? optimisticCard : item)),
    );

    try {
      const updatedCard = await saveWord(optimisticCard);
      setCards((current) =>
        current.map((item) => (item.id === cardId ? updatedCard : item)),
      );
    } catch {
      setCards((current) =>
        current.map((item) => (item.id === cardId ? card : item)),
      );
    }
  }

  return (
    <main
      className={`app${isSidebarCollapsed ? " sidebarCollapsed" : ""}${
        isMobileNavOpen ? " mobileNavOpen" : ""
      }`}
    >
      <button
        className="mobileNavBackdrop"
        type="button"
        aria-label="Close folders"
        onClick={closeMobileNav}
      />

      <FolderSidebar
        isCollapsed={isSidebarCollapsed}
        isMobileOpen={isMobileNavOpen}
        onToggleCollapse={toggleSidebar}
        onCloseMobile={closeMobileNav}
        activeFolder={activeFolder}
        folders={folders}
        getFolderSectionCounts={getFolderSectionCounts}
        onSelectFolder={selectFolder}
        onDropCard={moveCardToFolder}
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
        cards={displayCards}
        questCards={questPoolCards}
        reviewCards={reviewPoolCards}
        optionPool={optionPool}
        sessionScope={activeFolder}
        folders={folders}
        query={query}
        onQueryChange={setQuery}
        onOpenNewCardForm={openNewCardForm}
        onOpenImport={openImportModal}
        onOpenFolders={() => setIsMobileNavOpen(true)}
        filter={filter}
        sectionCounts={getFolderSectionCounts(activeFolder)}
        sections={folderSections}
        onFilterChange={setFilter}
        onDeleteCard={deleteCard}
        onMoveCardToStatus={moveCardToStatus}
        onReviewGrade={handleReviewGrade}
        isLearningMode={isLearningMode}
        dueCount={sessionPool.due}
        sessionSize={sessionPool.sessionSize}
        poolSize={sessionPool.poolSize}
        savedCount={learningScopeStats.saved}
        knownCount={learningScopeStats.known}
        hasAheadOfSchedule={hasAheadOfSchedule}
        onStartLearning={startLearning}
        onExitLearning={exitLearning}
        onSelectFolderForLearning={selectFolderForLearning}
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
                const created = await createFolder(name);
                setFolders((currentFolders) =>
                  [...currentFolders, created].sort((a, b) => a.name.localeCompare(b.name)),
                );
                return created;
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
