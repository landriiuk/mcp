#!/usr/bin/env node
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const uid = argValue("--uid");
const apply = process.argv.includes("--apply");
const deleteSource = process.argv.includes("--delete-source");
const projectId =
  argValue("--project") ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.VITE_FIREBASE_PROJECT_ID;

if (!uid) {
  console.error(
    "Usage: npm run migrate:auth -- --uid <firebase-uid> [--project <id>] [--apply] [--delete-source]",
  );
  process.exit(1);
}

if (deleteSource && !apply) {
  console.error("--delete-source requires --apply.");
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
});

const db = getFirestore();
const [foldersSnapshot, wordsSnapshot] = await Promise.all([
  db.collection("folders").get(),
  db.collection("words").get(),
]);

const folders = foldersSnapshot.docs.map((entry) => ({
  id: entry.id,
  data: entry.data(),
}));
const folderByName = new Map(
  folders.map((folder) => [
    String(folder.data.name ?? folder.id).trim().toLowerCase(),
    folder.id,
  ]),
);
const generalIds = new Set(
  folders
    .filter(
      (folder) =>
        folder.id === "General" ||
        String(folder.data.name ?? "").trim().toLowerCase() === "general",
    )
    .map((folder) => folder.id),
);

const migratedFolders = folders.filter((folder) => !generalIds.has(folder.id));
const migratedWords = wordsSnapshot.docs.map((entry) => {
  const data = entry.data();
  const rawFolder = String(data.folder ?? "").trim();
  const normalizedFolder =
    !rawFolder ||
    rawFolder.toLowerCase() === "general" ||
    generalIds.has(rawFolder)
      ? ""
      : folderByName.get(rawFolder.toLowerCase()) ?? rawFolder;
  return {
    id: entry.id,
    data: {
      ...data,
      folder: normalizedFolder,
      correct_streak: Number(data.correct_streak) || 0,
      updated_at: String(data.updated_at ?? new Date().toISOString()),
    },
  };
});

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      targetUid: uid,
      projectId: projectId ?? "(application default)",
      sourceFolders: folders.length,
      targetFolders: migratedFolders.length,
      sourceWords: wordsSnapshot.size,
      targetWords: migratedWords.length,
      removedGeneralFolders: generalIds.size,
      deleteSource,
    },
    null,
    2,
  ),
);

if (!apply) {
  console.log("Dry run only. Re-run with --apply after verifying the counts.");
  process.exit(0);
}

async function commitOperations(operations) {
  for (let start = 0; start < operations.length; start += 400) {
    const batch = db.batch();
    for (const operation of operations.slice(start, start + 400)) operation(batch);
    await batch.commit();
  }
}

const copyOperations = [
  ...migratedFolders.map(
    (folder) => (batch) =>
      batch.set(db.doc(`users/${uid}/folders/${folder.id}`), folder.data),
  ),
  ...migratedWords.map(
    (word) => (batch) =>
      batch.set(db.doc(`users/${uid}/words/${word.id}`), word.data),
  ),
];
await commitOperations(copyOperations);

const [targetFolders, targetWords] = await Promise.all([
  db.collection(`users/${uid}/folders`).get(),
  db.collection(`users/${uid}/words`).get(),
]);

if (
  targetFolders.size < migratedFolders.length ||
  targetWords.size < migratedWords.length
) {
  throw new Error(
    `Verification failed: expected at least ${migratedFolders.length}/${migratedWords.length}, got ${targetFolders.size}/${targetWords.size}.`,
  );
}

console.log(
  `Verified target: ${targetFolders.size} folders, ${targetWords.size} words.`,
);

if (deleteSource) {
  await commitOperations([
    ...foldersSnapshot.docs.map(
      (entry) => (batch) => batch.delete(entry.ref),
    ),
    ...wordsSnapshot.docs.map(
      (entry) => (batch) => batch.delete(entry.ref),
    ),
  ]);
  console.log("Deleted legacy global source documents.");
} else {
  console.log("Legacy source retained. Add --delete-source only after backup and verification.");
}
