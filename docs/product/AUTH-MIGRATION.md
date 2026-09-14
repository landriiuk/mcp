# Firebase Auth rollout and data migration

InkLex stores production data under:

```text
users/{uid}/folders/{folderId}
users/{uid}/words/{wordId}
```

Global `folders` and `words` are legacy-only and denied by current rules.

## Safe rollout order

1. Export/backup Firestore before migration.
2. Enable **Google** and **Email/Password** providers in Firebase Console → Authentication.
3. Create/sign in to the target InkLex account and copy its Firebase UID.
4. Authenticate the Admin SDK locally:

   ```bash
   gcloud auth application-default login
   ```

5. Dry-run and verify counts:

   ```bash
   npm run migrate:auth -- --uid TARGET_UID --project FIREBASE_PROJECT_ID
   ```

6. Copy data while retaining the source:

   ```bash
   npm run migrate:auth -- --uid TARGET_UID --project FIREBASE_PROJECT_ID --apply
   ```

7. Sign in to InkLex and verify folders, cards, status counts, and practice.
8. Deploy strict rules:

   ```bash
   firebase deploy --only firestore:rules --project FIREBASE_PROJECT_ID
   ```

9. After backup and UI verification, optionally remove legacy source:

   ```bash
   npm run migrate:auth -- --uid TARGET_UID --project FIREBASE_PROJECT_ID --apply --delete-source
   ```

The script normalizes legacy folder names to IDs, removes the old `General`
folder reference, prints source/target counts, and refuses destructive deletion
without `--apply`.

## Local modes

- `VITE_USE_MOCK_DB=true`: no Firebase network or login; data is stored under
  `inklex.mock.v1.local-dev`.
- Firebase emulators: set `VITE_USE_MOCK_DB=false` and
  `VITE_USE_FIREBASE_EMULATOR=true`, then run `npm run emulators`.
- Rules isolation tests: `npm run test:rules`.
