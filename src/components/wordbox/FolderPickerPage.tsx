import type { Folder } from "../../types/card";

type FolderPickerPageProps = {
  folders: Folder[];
  onSelect: (folderId: string) => void;
};

export function FolderPickerPage({ folders, onSelect }: FolderPickerPageProps) {
  return (
    <div className="learningHubPage" aria-labelledby="folder-picker-page-title">
      <div className="learningHubHeader">
        <p className="eyebrow">Practice</p>
        <h2 id="folder-picker-page-title">Choose a folder</h2>
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
    </div>
  );
}
