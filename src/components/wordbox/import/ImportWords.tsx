import { useRef, useState } from "react";
import {
  downloadImportTemplate,
  IMPORT_COLUMNS,
  parseWordsTable,
  type ImportWordRow,
} from "../../../utils/importWords";
import "./ImportWords.css";

type ImportWordsProps = {
  onClose: () => void;
  onImport: (rows: ImportWordRow[]) => Promise<{
    imported: number;
    skipped: number;
    errors: string[];
    targetFolder: string;
  }>;
  onImportSuccess: (targetFolder: string) => void;
};

export function ImportWords({ onClose, onImport, onImportSuccess }: ImportWordsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportWordRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [showAllPreview, setShowAllPreview] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);
    setImportError(null);
    setShowAllPreview(false);

    if (!file) {
      setFileName(null);
      setPreviewRows([]);
      setParseErrors([]);
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseWordsTable(content);
      setPreviewRows(parsed.rows);
      setParseErrors(parsed.errors);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (previewRows.length === 0) {
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const response = await onImport(previewRows);

      if (response.imported > 0) {
        onImportSuccess(response.targetFolder);
        return;
      }

      setResult({ imported: response.imported, skipped: response.skipped });

      if (response.errors.length > 0) {
        setParseErrors(response.errors);
      }
    } catch (error) {
      const detail =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Could not import words. Try again.";
      console.error("[InkLex] import failed", error);
      setImportError(detail);
    } finally {
      setIsImporting(false);
    }
  }

  const previewLimit = 5;
  const hiddenRowCount = previewRows.length - previewLimit;
  const visiblePreviewRows = showAllPreview
    ? previewRows
    : previewRows.slice(0, previewLimit);

  return (
    <div className="importWords">
      <div className="importWordsHeader">
        <div>
          <p className="eyebrow">Bulk import</p>
          <h2>Upload a table</h2>
          <p className="importIntro">
            Import words from CSV with columns: {IMPORT_COLUMNS.join(", ")}.
          </p>
        </div>
        <button className="importCloseButton" onClick={onClose} type="button" aria-label="Close">
          ×
        </button>
      </div>

      <div className="importActions">
        <button className="ghostButton" onClick={downloadImportTemplate} type="button">
          Download template
        </button>
        <button className="primary" onClick={() => fileInputRef.current?.click()} type="button">
          Choose file
        </button>
        <input
          ref={fileInputRef}
          accept=".csv,text/csv"
          className="importFileInput"
          onChange={handleFileChange}
          type="file"
        />
      </div>

      {fileName ? <p className="importFileName">Selected: {fileName}</p> : null}

      {parseErrors.length > 0 ? (
        <div className="importErrors" role="alert">
          {parseErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {importError ? <p className="importErrors">{importError}</p> : null}

      {result ? (
        <p className="importSuccess">
          Imported {result.imported} word{result.imported === 1 ? "" : "s"}
          {result.skipped > 0 ? `, skipped ${result.skipped}` : ""}.
        </p>
      ) : null}

      {previewRows.length > 0 ? (
        <div className="importPreview">
          <p className="importPreviewLabel">
            Preview ({previewRows.length} row{previewRows.length === 1 ? "" : "s"})
          </p>
          <div className="importPreviewTableWrap">
            <table className="importPreviewTable">
              <thead>
                <tr>
                  {IMPORT_COLUMNS.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiblePreviewRows.map((row, index) => (
                  <tr key={`${row.word}-${index}`}>
                    <td>{row.word}</td>
                    <td>{row.meaning}</td>
                    <td>{row.example}</td>
                    <td>{row.status}</td>
                    <td>{row.tags}</td>
                    <td>{row.folder}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hiddenRowCount > 0 ? (
            <button
              className="importPreviewMore"
              onClick={() => setShowAllPreview((expanded) => !expanded)}
              type="button"
            >
              {showAllPreview
                ? "Show fewer rows"
                : `+ ${hiddenRowCount} more row${hiddenRowCount === 1 ? "" : "s"}`}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="importFooter">
        <button onClick={onClose} type="button">
          Cancel
        </button>
        <button
          className="primary"
          disabled={previewRows.length === 0 || isImporting}
          onClick={handleImport}
          type="button"
        >
          {isImporting ? "Importing..." : `Import ${previewRows.length || ""} words`.trim()}
        </button>
      </div>
    </div>
  );
}
