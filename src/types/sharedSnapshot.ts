export type SharedSnapshotStatus = "publishing" | "active" | "revoked";
export type SharedSnapshotVisibility = "public" | "students";

export type SharedSnapshotMeta = {
  id: string;
  folderName: string;
  wordCount: number;
  publishedAt: string;
  status: SharedSnapshotStatus;
  visibility: SharedSnapshotVisibility;
};

export type SharedSnapshotWord = {
  id: string;
  word: string;
  meaning: string;
  example: string;
  tags: string[];
};

export type SharedSnapshot = {
  meta: SharedSnapshotMeta;
  words: SharedSnapshotWord[];
};

export type PublishedSnapshot = SharedSnapshotMeta & {
  sourceFolderId: string;
};

export type PublishSnapshotResult = {
  shareId: string;
  folderName: string;
  wordCount: number;
  visibility: SharedSnapshotVisibility;
};

export type CopySnapshotResult = {
  folderId: string;
  folderName: string;
  imported: number;
  alreadyImported: boolean;
};
