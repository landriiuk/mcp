import { useEffect, useRef, useState } from "react";
import { Input } from "../../ui/Input";
import type { Folder } from "../../../types/card";
import { isReservedFolderName } from "../../../utils/routes";

const MAX_TAGS = 3;
const TAG_MAX_LENGTH = 24;
const NO_FOLDER_VALUE = "";
const FOLDER_NAME_MAX_LENGTH = 50;
const FOLDER_NAME_TOO_LONG_ERROR = `Folder name must be ${FOLDER_NAME_MAX_LENGTH} characters or fewer.`;

interface CardDraft {
  word: string;
  meaning: string;
  example: string;
  status: "new" | "learning" | "known";
  tags: string[];
  /** Folder id */
  folder: string;
}

interface CardEditorProps {
  editingId?: string;
  folders: Folder[];
  preferredFolder?: string;
  onSubmit: (card: CardDraft) => void;
  onReset?: () => void;
  onCreateFolder: (name: string) => Promise<Folder>;
}

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, " ");
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

function getInitialFolder(folders: Folder[], preferredFolder?: string) {
  if (preferredFolder && preferredFolder !== "all") {
    const match = folders.find((folder) => folder.id === preferredFolder);
    // Always prefer the folder the user is currently viewing.
    return match?.id ?? preferredFolder;
  }
  return folders[0]?.id ?? NO_FOLDER_VALUE;
}

export function CardEditor({
  editingId,
  folders,
  preferredFolder,
  onSubmit,
  onReset,
  onCreateFolder,
}: CardEditorProps) {
  const [draft, setDraft] = useState<CardDraft>(() => ({
    word: "",
    meaning: "",
    example: "",
    status: "new",
    tags: [],
    folder: getInitialFolder(folders, preferredFolder),
  }));
  const [tagInput, setTagInput] = useState("");
  const [folderDraft, setFolderDraft] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [isSavingFolder, setIsSavingFolder] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const hasFolders = folders.length > 0;

  useEffect(() => {
    if (!hasFolders) {
      folderInputRef.current?.focus();
    }
  }, [hasFolders]);

  const handleDraftChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw).slice(0, TAG_MAX_LENGTH);
    if (!tag) {
      return;
    }

    setDraft((prev) => {
      if (prev.tags.length >= MAX_TAGS) {
        return prev;
      }
      if (prev.tags.some((item) => item.toLowerCase() === tag.toLowerCase())) {
        return prev;
      }
      return { ...prev, tags: [...prev.tags, tag] };
    });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setDraft((prev) => ({
      ...prev,
      tags: prev.tags.filter((item) => item !== tag),
    }));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      return;
    }

    if (e.key === "Backspace" && !tagInput && draft.tags.length > 0) {
      e.preventDefault();
      removeTag(draft.tags[draft.tags.length - 1]);
    }
  };

  const handleTagPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes(",")) {
      return;
    }

    e.preventDefault();
    const parts = text
      .split(",")
      .map((part) => normalizeTag(part).slice(0, TAG_MAX_LENGTH))
      .filter(Boolean);

    setDraft((prev) => {
      const next = [...prev.tags];
      for (const tag of parts) {
        if (next.length >= MAX_TAGS) {
          break;
        }
        if (next.some((item) => item.toLowerCase() === tag.toLowerCase())) {
          continue;
        }
        next.push(tag);
      }
      return { ...prev, tags: next };
    });
    setTagInput("");
  };

  const handleFolderDraftChange = (rawValue: string) => {
    if (rawValue.length > FOLDER_NAME_MAX_LENGTH) {
      setFolderDraft(rawValue.slice(0, FOLDER_NAME_MAX_LENGTH));
      setFolderError(FOLDER_NAME_TOO_LONG_ERROR);
      return;
    }

    setFolderDraft(rawValue);
    if (folderError) {
      setFolderError(null);
    }
  };

  const submitInlineFolder = async () => {
    const validationError = validateFolderName(folderDraft);
    if (validationError) {
      setFolderError(validationError);
      return;
    }

    const normalizedName = normalizeFolderName(folderDraft);
    const existingFolder = folders.find(
      (folder) => folder.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (existingFolder) {
      setFolderError("Folder already exists.");
      return;
    }

    setIsSavingFolder(true);
    setFolderError(null);

    try {
      const created = await onCreateFolder(normalizedName);
      setDraft((prev) => ({ ...prev, folder: created.id }));
      setFolderDraft("");
      setFolderError(null);
    } catch (error) {
      setFolderError(error instanceof Error ? error.message : "Could not create folder.");
    } finally {
      setIsSavingFolder(false);
    }
  };

  const handleFolderInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitInlineFolder();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let folderId = draft.folder.trim();

    // Empty-folder mode: typed name + Save word should create the folder (Create folder is easy to miss).
    if (!hasFolders) {
      const normalizedName = normalizeFolderName(folderDraft);
      if (normalizedName) {
        const validationError = validateFolderName(folderDraft);
        if (validationError) {
          setFolderError(validationError);
          folderInputRef.current?.focus();
          return;
        }

        const existingFolder = folders.find(
          (folder) => folder.name.toLowerCase() === normalizedName.toLowerCase(),
        );
        if (existingFolder) {
          folderId = existingFolder.id;
        } else {
          setIsSavingFolder(true);
          setFolderError(null);
          try {
            const created = await onCreateFolder(normalizedName);
            folderId = created.id;
            setDraft((prev) => ({ ...prev, folder: created.id }));
            setFolderDraft("");
          } catch (error) {
            setFolderError(
              error instanceof Error ? error.message : "Could not create folder.",
            );
            folderInputRef.current?.focus();
            setIsSavingFolder(false);
            return;
          }
          setIsSavingFolder(false);
        }
      }
    }

    const pending = normalizeTag(tagInput);
    const tags = [...draft.tags];
    if (
      pending &&
      tags.length < MAX_TAGS &&
      !tags.some((item) => item.toLowerCase() === pending.toLowerCase())
    ) {
      tags.push(pending.slice(0, TAG_MAX_LENGTH));
    }
    onSubmit({
      ...draft,
      status: "new",
      folder: folderId,
      tags: tags.slice(0, MAX_TAGS),
    });
  };

  const resetForm = () => {
    setDraft({
      word: "",
      meaning: "",
      example: "",
      status: "new",
      tags: [],
      folder: getInitialFolder(folders, preferredFolder),
    });
    setTagInput("");
    setFolderDraft("");
    setFolderError(null);
    onReset?.();
  };

  const tagsFull = draft.tags.length >= MAX_TAGS;

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">{editingId ? "Edit card" : "Vocabulary"}</p>
        <h2>{editingId ? "Update this word" : "Add a new word"}</h2>
      </div>

      <label>
        Word
        <Input
          name="word"
          onChange={handleDraftChange}
          placeholder="e.g. brief"
          required
          value={draft.word}
        />
      </label>

      <label>
        Meaning
        <textarea
          name="meaning"
          onChange={handleDraftChange}
          placeholder="Short definition in plain language"
          required
          rows={3}
          value={draft.meaning}
        />
      </label>

      <label>
        Example
        <textarea
          name="example"
          onChange={handleDraftChange}
          placeholder="Optional sentence with this word"
          rows={3}
          value={draft.example}
        />
      </label>

      <div className="formRow">
        <div className="folderField">
          <span className="folderFieldLabel">Folder</span>

          {!hasFolders ? (
            <div className="folderInlineCreate">
              <p className="folderInlineHint">
                Type a folder name, then Create folder — or Save word to create it automatically.
                Leave empty to save without a folder.
              </p>
              <Input
                ref={folderInputRef}
                aria-label="New folder name"
                invalid={Boolean(folderError)}
                maxLength={FOLDER_NAME_MAX_LENGTH}
                onChange={(event) => handleFolderDraftChange(event.target.value)}
                onKeyDown={handleFolderInputKeyDown}
                placeholder="Folder name"
                size="sm"
                value={folderDraft}
              />
              {folderError ? (
                <p className="folderInlineError" role="alert">
                  {folderError}
                </p>
              ) : null}
              <div className="folderInlineCreateActions">
                <button
                  className="primary"
                  disabled={isSavingFolder}
                  onClick={() => void submitInlineFolder()}
                  type="button"
                >
                  {isSavingFolder ? "Creating…" : "Create folder"}
                </button>
              </div>
            </div>
          ) : (
            <select name="folder" onChange={handleDraftChange} value={draft.folder}>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="tagField">
        <div className="tagFieldHeader">
          <span className="tagFieldLabel">Tags</span>
          <span className="tagFieldCount">
            {draft.tags.length}/{MAX_TAGS}
          </span>
        </div>
        <p className="tagFieldHint">
          Type a tag and press Enter or comma. Backspace removes the last tag.
        </p>
        <div className={`tagInput${tagsFull ? " isFull" : ""}`}>
          {draft.tags.map((tag) => (
            <button
              className="tagChip"
              key={tag}
              onClick={() => removeTag(tag)}
              type="button"
              aria-label={`Remove tag ${tag}`}
            >
              <span>{tag}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <input
            aria-label="Add tag"
            disabled={tagsFull}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={handleTagKeyDown}
            onPaste={handleTagPaste}
            placeholder={tagsFull ? "Max 3 tags" : draft.tags.length ? "" : "work, writing"}
            type="text"
            value={tagInput}
          />
        </div>
      </div>

      <div className="formActions">
        <button className="primary" type="submit">
          {editingId ? "Save changes" : "Save word"}
        </button>
        <button onClick={resetForm} type="button">
          Clear
        </button>
      </div>
    </form>
  );
}
