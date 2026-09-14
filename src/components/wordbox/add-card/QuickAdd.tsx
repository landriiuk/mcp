import { useEffect, useRef, useState } from "react";
import { Input } from "../../ui/Input";
import { parseClipboardLexeme } from "../../../utils/parseClipboardLexeme";

export type QuickAddDraft = {
  word: string;
  meaning: string;
  example: string;
  folder: string;
};

type QuickAddProps = {
  folderId: string;
  folderName: string;
  onSubmit: (draft: QuickAddDraft) => void | Promise<void>;
  onClose: () => void;
};

export function QuickAdd({ folderId, folderName, onSubmit, onClose }: QuickAddProps) {
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [example, setExample] = useState("");
  const [exampleOpen, setExampleOpen] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const meaningInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    wordInputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handlePaste() {
    setPasteError(null);
    try {
      if (!navigator.clipboard?.readText) {
        setPasteError("Clipboard paste is not available in this browser.");
        return;
      }
      const text = await navigator.clipboard.readText();
      const parsed = parseClipboardLexeme(text);
      if (!parsed) {
        setPasteError("Clipboard is empty.");
        return;
      }
      setWord(parsed.word);
      if (parsed.meaning) {
        setMeaning(parsed.meaning);
        meaningInputRef.current?.focus();
      } else {
        wordInputRef.current?.focus();
      }
    } catch {
      setPasteError("Could not read clipboard. Paste with ⌘V / Ctrl+V instead.");
    }
  }

  async function saveAndContinue() {
    const nextWord = word.trim();
    const nextMeaning = meaning.trim();
    if (!nextWord || !nextMeaning || isSaving) {
      return;
    }

    setIsSaving(true);
    setPasteError(null);
    try {
      await onSubmit({
        word: nextWord,
        meaning: nextMeaning,
        example: example.trim(),
        folder: folderId,
      });
      setWord("");
      setMeaning("");
      setExample("");
      setExampleOpen(false);
      setStatusMessage("Saved · ready for Quest");
      wordInputRef.current?.focus();
    } catch (error) {
      setPasteError(error instanceof Error ? error.message : "Could not save word.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleMeaningKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void saveAndContinue();
    }
  }

  return (
    <form
      className="editor quickAdd"
      onSubmit={(event) => {
        event.preventDefault();
        void saveAndContinue();
      }}
    >
      <div className="quickAddHeader">
        <div>
          <p className="eyebrow">Quick add</p>
          <h2>Add to {folderName}</h2>
        </div>
        <button className="ghost quickAddClose" onClick={onClose} type="button">
          Close
        </button>
      </div>

      <div className="quickAddWordRow">
        <label className="quickAddField">
          Word
          <Input
            ref={wordInputRef}
            name="word"
            onChange={(event) => {
              setWord(event.target.value);
              if (statusMessage) {
                setStatusMessage(null);
              }
            }}
            placeholder="e.g. brief"
            required
            value={word}
          />
        </label>
        <button className="ghost quickAddPaste" onClick={() => void handlePaste()} type="button">
          Paste
        </button>
      </div>

      <label className="quickAddField">
        Meaning
        <textarea
          name="meaning"
          onChange={(event) => {
            setMeaning(event.target.value);
            if (statusMessage) {
              setStatusMessage(null);
            }
          }}
          onKeyDown={handleMeaningKeyDown}
          placeholder="Short definition — Enter to save"
          ref={meaningInputRef}
          required
          rows={2}
          value={meaning}
        />
      </label>

      {exampleOpen ? (
        <label className="quickAddField">
          Example
          <textarea
            name="example"
            onChange={(event) => setExample(event.target.value)}
            placeholder="Optional sentence with this word"
            rows={2}
            value={example}
          />
        </label>
      ) : (
        <button
          className="ghost quickAddExampleToggle"
          onClick={() => setExampleOpen(true)}
          type="button"
        >
          + Add example
        </button>
      )}

      {pasteError ? (
        <p className="quickAddError" role="alert">
          {pasteError}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="quickAddStatus" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="formActions">
        <button className="primary" disabled={isSaving} type="submit">
          {isSaving ? "Saving…" : "Save & add another"}
        </button>
        <button onClick={onClose} type="button">
          Done
        </button>
      </div>
    </form>
  );
}
