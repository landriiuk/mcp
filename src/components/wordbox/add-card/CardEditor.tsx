import { useState } from "react";

interface CardDraft {
  word: string;
  meaning: string;
  example: string;
  status: "new" | "learning" | "known";
  tags: string;
}

interface CardEditorProps {
  editingId?: string;
  onSubmit: (card: CardDraft) => void;
  onReset?: () => void;
}

export function CardEditor({ editingId, onSubmit, onReset }: CardEditorProps) {
  const [draft, setDraft] = useState<CardDraft>({
    word: "",
    meaning: "",
    example: "",
    status: "new",
    tags: "",
  });

  const handleDraftChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(draft);
  };

  const resetForm = () => {
    setDraft({
      word: "",
      meaning: "",
      example: "",
      status: "new",
      tags: "",
    });
    onReset?.();
  };

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">{editingId ? "Edit card" : "New card"}</p>
        <h2>{editingId ? "Update this word" : "Add a word"}</h2>
      </div>

      <label>
        Word
        <input
          name="word"
          onChange={handleDraftChange}
          placeholder="manage"
          value={draft.word}
        />
      </label>

      <label>
        Meaning
        <textarea
          name="meaning"
          onChange={handleDraftChange}
          placeholder="to control or deal with something"
          rows={3}
          value={draft.meaning}
        />
      </label>

      <label>
        Example
        <textarea
          name="example"
          onChange={handleDraftChange}
          placeholder="She managed to finish the task."
          rows={3}
          value={draft.example}
        />
      </label>

      <div className="formRow">
        <label>
          Status
          <select
            name="status"
            onChange={handleDraftChange}
            value={draft.status}
          >
            <option value="new">New</option>
            <option value="learning">Learning</option>
            <option value="known">Known</option>
          </select>
        </label>

        <label>
          Tags
          <input
            name="tags"
            onChange={handleDraftChange}
            placeholder="work, writing"
            value={draft.tags}
          />
        </label>
      </div>

      <div className="formActions">
        <button className="primary" type="submit">
          {editingId ? "Save changes" : "Create card"}
        </button>
        <button onClick={resetForm} type="button">
          Clear
        </button>
      </div>
    </form>
  );
}
