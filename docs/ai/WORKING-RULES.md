# InkLex — AI briefing

## Product

**InkLex** is an English vocabulary MVP (Reverso-inspired). Users save words as cards, group them into folders, filter by status, and import from CSV.

Design reference: `reverso-mvp-design-options.html`, **Vocabulary Desk** option (calm notebook style).

---

## Stack

| Layer | Technologies |
|-------|----------------|
| Frontend | React 19, Vite, TypeScript, per-component CSS |
| Data | Firebase Firestore (client SDK) in prod. **Local:** mocked DB in `localStorage` (`VITE_USE_MOCK_DB=true`) — no network to Firebase/emulator. |
| Legacy | Next.js API in `backend/` — optional / deprecated |

### Running locally

```bash
npm run dev              # frontend → :5173 (mock DB by default)
```

Clear mock data: open `http://localhost:5173/?clearDb=1`, or DevTools → Application → Local Storage → remove `inklex.mock.v1`.

Never put `VITE_USE_MOCK_DB=true` or the emulator flag on Vercel.

---

## Code layout

```
src/
  App.tsx                 — global state, sidebar (folders), filters
  components/wordbox/
    Wordbox.tsx           — main area: tabs, search, card grid
    card/Card.tsx         — word card
    import/ImportWords.tsx — CSV import modal
    add-card/CardEditor.tsx
  utils/importWords.ts    — CSV parsing, template, target folder
backend/
  pages/api/
    words.js              — GET/POST list
    words/[id].js         — PUT/DELETE single card
    words/import.js       — bulk import
    folders.js            — folder CRUD
    create.js             — create card (legacy endpoint)
  lib/db.js               — Postgres + in-memory fallback
```

---

## Domain model

### Card (word)

- `word`, `meaning`, `example` — `word` + `meaning` required
- `status`: `new` | `learning` | `known`
- `tags`: string array
- `folder`: string (optional; empty = no folder / visible under All)
- `interval_days`: spacing step `0 | 1 | 3 | 7`, or known-maintenance days (`30`…`180`)
- `next_review_at`: ISO timestamp or `null` (null on non-known = due priority; known with null = legacy)
- `correct_streak`: consecutive correct grades toward Known (resets on Again)

### Review algorithm (Quest + streak Known)

Full session rules: [`docs/algorithms/due-first-session.md`](../algorithms/due-first-session.md).

- **All** → folder picker before learning; practice always in a concrete folder
- **Start Learning** (folder) → Learning Hub as **page content** on `/:encodedFolderId/learning` (Quest | Review; preference in `inklex.learningMode`)
- **Quest** pool: `new` + `learning` only; up to **10**; due first, then fill from the rest (ahead-of-schedule included) so another Quest can start immediately
- **Review** — all words in the folder; Again / Good / Easy
- **Again**: `correct_streak = 0`, soft demotion, `next_review_at = now + 10m`, status `learning`
- **Good / Easy**: `correct_streak += 1`; at **3** → Known @ 30d; else stay learning with soft spacing
- Drag to Known / manual Known in editor: `interval_days=30`, `next_review_at=now+30d`, streak reset


### Folder

- Name: 1–50 characters after trim; whitespace normalized
- No system/default folder (no `General`)
- Deleting a folder clears `folder` on its cards (they stay under All until reassigned)

### UI filtering

1. **Folder** (sidebar): `All` or a specific folder — URL `/` or `/:encodedFolderId` (base64url of folder id; UI shows name)
2. **Section** (tabs above search, browse mode only):
   - **Cards** — all cards in the folder
   - **Learning** — `status === learning`
   - **Known** — `status === known`
3. **Learning mode** — from All: folder picker → `/:encodedFolderId/learning`; hub page then Quest or Review (see `docs/algorithms/due-first-session.md`)
4. **Search** — matches word, meaning, example, status, folder, tags (hidden in learning mode)

Reserved folder name: `learning`. Tab and sidebar counts are scoped to the **active folder**.

---

## UX rules (do not break without explicit request)

### Sidebar — folders

- Top row: **All** + count + **+** button (new folder)
- No bullet dots next to folder names
- Create / rename — **inline** in the folder row (no separate top input)
- **Enter** — save; **Escape** or click outside — cancel
- Validation errors — **below the input** (not above the list)
- 50-character limit: extra input blocked; show error on attempt
- **Mobile (≤1024px):** burger (right) opens folders panel from the **top**; backdrop / Esc / × / folder select closes it

### Main content

- Cards / Review / Known tabs — **above** search; tab style (green bottom line, no heavy black accents)
- Card **delete** — red chip on the right in the footer (per design)

### CSV import

Columns: `word`, `meaning`, `example`, `status`, `tags`, `folder`.

- Preview: first 5 rows; “+ N more rows” expands all
- On success: **close modal** and navigate to **folder from CSV** (most common folder in file)
- Button label: `Import N words`

---

## Code style

1. **Minimal diff** — do not touch unrelated code
2. **Existing patterns** — naming, CSS variables from `src/index.css`, component structure
3. **API** — always `${apiBaseUrl}/...`; avoid hardcoding `/api/...` in new code
4. **Commits / PRs** — only when the user explicitly asks
5. **User-facing chat** — respond in Ukrainian
6. **Tests** — add only on request or when they add real value

### CSS

- Design tokens: `--ink`, `--muted`, `--line`, `--green`, `--green-soft`, `--red`, `--chip-bg`, etc.
- Avoid heavy black bottom borders on interactive elements

---

## Known technical notes

- `backend/lib/db.js`: when Postgres is down, all requests use **one** shared in-memory DB (never create a new one per request).
- `DELETE /api/words/:id` — existence check via `SELECT * FROM words WHERE id = ?` (in-memory layer compatibility).
- If `DATABASE_URL` in `backend/.env` points to an unreachable host, data survives only until the backend restarts.

---

## UI change checklist

- [ ] Counts update for the active folder?
- [ ] Folder errors appear below the inline input?
- [ ] After import, redirect to the correct folder?
- [ ] Card delete uses `apiBaseUrl`?

---

## Maintaining this file

Add new conventions here after significant product changes. Keep it short — this is a briefing, not a full spec.
