#!/usr/bin/env node
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const uid = argValue("--uid")?.trim();
const role = argValue("--role")?.trim();
const apply = process.argv.includes("--apply");
const projectId =
  argValue("--project") ||
  process.env.GCLOUD_PROJECT ||
  process.env.GOOGLE_CLOUD_PROJECT;

if (!uid || uid.includes("/") || !["student", "teacher", "admin"].includes(role)) {
  console.error(
    "Usage: npm run set:role -- --uid <firebase-uid> --role <student|teacher|admin> [--project <id>] [--apply]",
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      uid,
      role,
      projectId: projectId ?? "(application default)",
    },
    null,
    2,
  ),
);

if (!apply) {
  console.log("Dry run only. Re-run with --apply to assign this role.");
  process.exit(0);
}

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
});

await getFirestore().doc(`roles/${uid}`).set({
  role,
  assigned_at: new Date().toISOString(),
  assigned_by_uid: null,
  schema_version: 1,
});

console.log(`Assigned ${role} role to ${uid}.`);
