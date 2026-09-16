# Shared folder links MVP

InkLex users can publish a read-only snapshot of one folder and send its URL:

```text
https://inklex.vercel.app/share/{shareId}
```

Public links can be previewed without signing in. Teachers can instead select
**My students only**; those links require an authenticated student relationship.
Adding either set creates an independent folder owned by the recipient.

## Snapshot behavior

- Only a concrete, non-empty folder can be shared; **All** is not shareable.
- A snapshot contains at most 400 words.
- It includes `word`, `meaning`, `example`, and up to three tags.
- Card IDs, source folder IDs, status, intervals, streaks, and review dates are
  never published.
- Later edits to the source folder do not alter an existing snapshot.
- Imported cards start as `new` with empty review history.
- Name collisions create `Folder (2)`, `Folder (3)`, and so on.
- Import is idempotent per account: opening the same link again returns to the
  folder already created instead of duplicating all cards.
- Deleting a source folder first revokes every active link. If revocation fails,
  deletion is stopped so a public snapshot cannot become unmanageable.
- Empty, incomplete, or count-mismatched snapshots are rejected instead of
  creating an empty destination folder.

## Storage

```text
sharedSnapshots/{shareId}
sharedSnapshots/{shareId}/words/{snapshotWordId}
users/{ownerUid}/publishedSnapshots/{shareId}
```

Publishing uses `publishing → active`. Active `public` snapshots allow anonymous
reads; active `students` snapshots require membership under
`teachers/{ownerUid}/students/{studentUid}`. Revocation immediately blocks the
document and its words. Private user collections remain owner-only.

The share ID is an unguessable UUID. Public links are bearer links: anyone who
receives one can read and copy its vocabulary until it is revoked. Do not
include private information in publicly shared cards.

## Development and deployment

Mock mode stores snapshots in the current browser's `localStorage`, so links
work only in that browser. Production uses Firestore.

Run verification:

```bash
npm test
npm run build
npm run test:rules
```

Deploy the new rules before exposing the UI:

```bash
firebase deploy --only firestore:rules --project inklex-be
```
