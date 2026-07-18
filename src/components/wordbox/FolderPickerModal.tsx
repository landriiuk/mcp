import type { Folder } from "../../types/card";

type FolderPickerModalProps = {
  folders: Folder[];
  onClose: () => void;
  onSelect: (folderId: string) => void;
};

export function FolderPickerModal({ folders, onClose, onSelect }: FolderPickerModalProps) {
  return (
    <div className="modalOverlay" onClick={onClose} role="presentation">
      <div
        className="modalWindow folderPickerModal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-picker-title"
      >
        <div className="learningHubHeader">
          <p className="eyebrow">Practice</p>
          <h2 id="folder-picker-title">Choose a folder</h2>
          <p className="learningHubLead">
            Learning runs inside one folder. Pick where you want to practice.
          </p>
        </div>

        {folders.length === 0 ? (
          <div className="emptyState folderPickerEmpty">
            <h2>No folders yet</h2>
            <p>Create a folder in the sidebar, add words, then start learning.</p>
          </div>
        ) : (
          <ul className="folderPickerList">
            {folders.map((folder) => (
              <li key={folder.id}>
                <button
                  className="folderPickerItem"
                  type="button"
                  onClick={() => onSelect(folder.id)}
                >
                  {folder.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="learningHubFooter">
          <button className="ghost" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
