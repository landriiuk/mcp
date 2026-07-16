import type { RefObject } from "react";
import { Link } from "react-router-dom";
import { Input } from "../ui/Input";

type FolderCounts = {
  all: number;
  learning: number;
  known: number;
};

type FolderSidebarProps = {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeFolder: string;
  folders: string[];
  getFolderSectionCounts: (folder: string) => FolderCounts;
  onSelectFolder: (folder: string) => void;
  isCreatingFolder: boolean;
  editingFolder: string | null;
  folderDraft: string;
  folderError: string | null;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onStartCreatingFolder: () => void;
  onStartEditingFolder: (folder: string) => void;
  onDeleteFolder: (folder: string) => void;
  onFolderDraftChange: (value: string) => void;
  onFolderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onFolderBlur: () => void;
  onFolderPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
};

export function FolderSidebar({
  isCollapsed,
  onToggleCollapse,
  activeFolder,
  folders,
  getFolderSectionCounts,
  onSelectFolder,
  isCreatingFolder,
  editingFolder,
  folderDraft,
  folderError,
  folderInputRef,
  onStartCreatingFolder,
  onStartEditingFolder,
  onDeleteFolder,
  onFolderDraftChange,
  onFolderKeyDown,
  onFolderBlur,
  onFolderPaste,
}: FolderSidebarProps) {
  return (
    <aside className={`sidebar${isCollapsed ? " isCollapsed" : ""}`}>
      <div className="sidebarHeader">
        <Link className="brand" to="/" aria-label="InkLex home">
          <span className="brandIcon">Aa</span>
          <span className="brandText">InkLex</span>
        </Link>
        <button
          className="sidebarToggle"
          onClick={onToggleCollapse}
          type="button"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!isCollapsed}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {isCollapsed ? (
              <path d="M9.5 6.5 15 12l-5.5 5.5" />
            ) : (
              <path d="M14.5 6.5 9 12l5.5 5.5" />
            )}
          </svg>
        </button>
      </div>

      <div className="folderPanel">
        <div className="folderAllRow">
          <button
            className={
              activeFolder === "all"
                ? "folderButton folderAllButton active"
                : "folderButton folderAllButton"
            }
            onClick={() => onSelectFolder("all")}
            type="button"
            title="All"
          >
            <span className="folderLabel">All</span>
            <span className="folderInitial" aria-hidden="true">
              A
            </span>
            <strong className="folderCount">{getFolderSectionCounts("all").all}</strong>
          </button>
          <button
            className="folderAddButton"
            disabled={isCreatingFolder}
            onClick={onStartCreatingFolder}
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
                    <Input
                      ref={folderInputRef}
                      aria-label={`Rename ${folder}`}
                      invalid={Boolean(folderError)}
                      size="sm"
                      onChange={(event) => onFolderDraftChange(event.target.value)}
                      onKeyDown={onFolderKeyDown}
                      onBlur={onFolderBlur}
                      onPaste={onFolderPaste}
                      value={folderDraft}
                    />
                  ) : (
                    <button
                      className="folderButton"
                      onClick={() => onSelectFolder(folder)}
                      type="button"
                      title={folder}
                    >
                      <span className="folderLabel">{folder}</span>
                      <span className="folderInitial" aria-hidden="true">
                        {folder.trim().charAt(0).toUpperCase() || "F"}
                      </span>
                      <strong className="folderCount">{folderCount}</strong>
                    </button>
                  )}
                  {isEditing ? (
                    <strong className="folderCountBadge">{folderCount}</strong>
                  ) : (
                    <div className="folderInlineActions">
                      <button
                        className="folderInlineButton"
                        onClick={() => onStartEditingFolder(folder)}
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
                        onClick={() => onDeleteFolder(folder)}
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
                <Input
                  ref={folderInputRef}
                  aria-label="New folder name"
                  invalid={Boolean(folderError)}
                  size="sm"
                  onChange={(event) => onFolderDraftChange(event.target.value)}
                  onKeyDown={onFolderKeyDown}
                  onBlur={onFolderBlur}
                  onPaste={onFolderPaste}
                  placeholder="Folder name"
                  value={folderDraft}
                />
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
  );
}
