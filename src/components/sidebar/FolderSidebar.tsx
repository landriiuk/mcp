import type { RefObject } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "../ui/Input";
import type { Folder } from "../../types/card";
import { isCardDrag, readDraggedCardId } from "../../utils/cardDrag";

type FolderCounts = {
  all: number;
  learning: number;
  known: number;
};

type FolderSidebarProps = {
  isCollapsed: boolean;
  isMobileOpen?: boolean;
  onToggleCollapse: () => void;
  onCloseMobile?: () => void;
  activeFolder: string;
  folders: Folder[];
  getFolderSectionCounts: (folderId: string) => FolderCounts;
  onSelectFolder: (folderId: string) => void;
  onDropCard?: (cardId: string, folderId: string) => void;
  isCreatingFolder: boolean;
  editingFolder: string | null;
  folderDraft: string;
  folderError: string | null;
  folderInputRef: RefObject<HTMLInputElement | null>;
  onStartCreatingFolder: () => void;
  onStartEditingFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
  onFolderDraftChange: (value: string) => void;
  onFolderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onFolderBlur: () => void;
  onFolderPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
};

function folderDropHandlers(
  folderId: string,
  onDropCard: ((cardId: string, folderId: string) => void) | undefined,
  setDropTarget: (id: string | null) => void,
  dropTarget: string | null,
) {
  return {
    onDragEnter: (event: React.DragEvent) => {
      if (!onDropCard || !isCardDrag(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      setDropTarget(folderId);
    },
    onDragOver: (event: React.DragEvent) => {
      if (!onDropCard || !isCardDrag(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget(folderId);
    },
    onDragLeave: (event: React.DragEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) {
        return;
      }
      if (dropTarget === folderId) {
        setDropTarget(null);
      }
    },
    onDrop: (event: React.DragEvent) => {
      if (!onDropCard) {
        return;
      }
      event.preventDefault();
      setDropTarget(null);
      const cardId = readDraggedCardId(event.dataTransfer);
      if (cardId) {
        onDropCard(cardId, folderId);
      }
    },
  };
}

export function FolderSidebar({
  isCollapsed,
  isMobileOpen = false,
  onToggleCollapse,
  onCloseMobile,
  activeFolder,
  folders,
  getFolderSectionCounts,
  onSelectFolder,
  onDropCard,
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
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  return (
    <aside
      id="folder-sidebar"
      className={`sidebar${isCollapsed ? " isCollapsed" : ""}${
        isMobileOpen ? " isMobileOpen" : ""
      }`}
    >
      <div className="sidebarHeader">
        <Link className="brand" to="/" aria-label="InkLex home" onClick={onCloseMobile}>
          <img className="brandIcon" src="/favi.png" alt="" width={64} height={64} />
          <span className="brandText">InkLex</span>
        </Link>
        <div className="sidebarHeaderActions">
          <button
            className="sidebarCloseMobile"
            onClick={onCloseMobile}
            type="button"
            title="Close folders"
            aria-label="Close folders"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
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
      </div>

      <div className="folderPanel">
        <div className="folderAllRow">
          <button
            className={
              activeFolder === "all"
                ? `folderButton folderAllButton active${dropTarget === "all" ? " isDropTarget" : ""}`
                : `folderButton folderAllButton${dropTarget === "all" ? " isDropTarget" : ""}`
            }
            onClick={() => onSelectFolder("all")}
            type="button"
            title="All"
            {...folderDropHandlers("all", onDropCard, setDropTarget, dropTarget)}
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
            const folderCount = getFolderSectionCounts(folder.id).all;
            const isActiveFolder = activeFolder === folder.id;
            const isEditing = editingFolder === folder.id;
            const isDropTarget = dropTarget === folder.id;

            return (
              <div className="folderRowGroup" key={folder.id}>
                <div
                  className={`folderRow${isActiveFolder ? " active" : ""}${
                    isEditing ? " editing" : ""
                  }${isDropTarget ? " isDropTarget" : ""}`}
                  {...(isEditing
                    ? {}
                    : folderDropHandlers(folder.id, onDropCard, setDropTarget, dropTarget))}
                >
                  {isEditing ? (
                    <Input
                      ref={folderInputRef}
                      aria-label={`Rename ${folder.name}`}
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
                      onClick={() => onSelectFolder(folder.id)}
                      type="button"
                      title={folder.name}
                    >
                      <span className="folderLabel">{folder.name}</span>
                      <span className="folderInitial" aria-hidden="true">
                        {folder.name.trim().charAt(0).toUpperCase() || "F"}
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
                        title={`Rename ${folder.name}`}
                        aria-label={`Rename ${folder.name}`}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M4 17.5V20h2.5l7.4-7.4-2.5-2.5L4 17.5Zm13.7-8.3a.8.8 0 0 0 0-1.2l-1.3-1.3a.8.8 0 0 0-1.2 0l-1.6 1.6 2.5 2.5 1.6-1.6Z" />
                        </svg>
                      </button>
                      <button
                        className="folderInlineButton"
                        onClick={() => onDeleteFolder(folder.id)}
                        type="button"
                        title={`Delete ${folder.name}`}
                        aria-label={`Delete ${folder.name}`}
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
