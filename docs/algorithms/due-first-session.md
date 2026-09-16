# Quest & Review sessions

How InkLex builds practice sessions so spaced repetition still prioritizes due words, without blocking the next Quest.

Implementation:
- [`src/utils/reviewAlgorithm.ts`](../../src/utils/reviewAlgorithm.ts) — `isDue`, `buildQuestDeck`, `gradeCard`, MCQ/typed helpers
- [`src/hooks/usePracticeSession.ts`](../../src/hooks/usePracticeSession.ts) — shared queue / persist / skip / end / deferred again
- [`src/components/wordbox/PracticeSession.tsx`](../../src/components/wordbox/PracticeSession.tsx) — format shell
- [`src/lib/practiceFormats.ts`](../../src/lib/practiceFormats.ts) — format registry

## Goals

1. Prefer cards that are **due now** when building a Quest deck.
2. Still allow practice of **ahead-of-schedule** Cards/Learning so the user can start another Quest immediately.
3. Exclude **Known** from Quest formats (they stay in Review / Known tab).
4. Promote to Known after **3 correct in a row** (or manual drag / editor).
5. Write **Again** to the DB only on final settle (not on the first in-session retry).

## Learning entry

- **All** folder: Start Learning opens a **folder picker** (modal). Direct `/learning` shows the same picker as page content. Learning always runs inside a concrete folder.
- **Specific folder**: Start Learning → `/:encodedFolderId/learning` with **Learning Hub** as page content (practice formats), not a modal.
- Preference for last mode: `localStorage` `inklex.learningMode` = `quest` | `quest-reverse` | `quest-typed` | `review`.
- Quest completions (Quest / Reverse / Typed reaching **N/N**) increment `users/{uid}/stats/practice.quest_completed_count`. Ending early before N/N does not count. Review is not counted.

## Card buckets (Quest formats)

| Bucket | Condition | Role |
|--------|-----------|------|
| Quest pool | `status` is `new` or `learning` | Eligible for Quest / Reverse / Typed |
| Due (priority) | In pool and (`next_review_at` null or `<= now`) | Taken first |
| Ahead of schedule | In pool and `next_review_at > now` | Fill remaining slots |
| Known | `status == known` | **Excluded** from Quest formats |

## Session build (`buildQuestDeck`)

Constants:

- `MAX_SESSION_SIZE = 10`
- `CORRECT_STREAK_TO_KNOWN = 3`
- `MAX_SESSION_RETRIES = 1`

Algorithm:

1. Filter folder cards to Quest pool (new/learning).
2. Split into due vs rest → shuffle each.
3. Take due first (up to 10), then fill from rest until 10.
4. Pass the deck into the practice session queue.

## Progress & grading (session shell)

- Progress `N / N` advances when you leave a card (answer, wrong→requeue, or Skip/Next). At **N/N**, the next answer or Skip/Next **ends** the session (leftover queue → Skipped).
- Wrong / Bad: write **Again** immediately (resets streak); card may still requeue once in-session unless already at N/N.
- Final Good / Easy: call `gradeCard`; at 3 correct in a row → Known.
- Last-card skip also ends early.

## CTA counts (`countSessionPool`)

- `poolSize` = all new/learning in the folder
- `sessionSize` = `min(10, poolSize)`
- Quest formats available whenever `sessionSize > 0`

## Grading → Known

| Grade | Effect |
|-------|--------|
| Again | `correct_streak = 0`; soft demotion one Leitner step; `next_review_at = now + 10m`; status `learning` |
| Good / Easy (not known) | `correct_streak += 1`; if `>= 3` → Known @ 30d; else stay `learning` with soft spacing intervals |
| Good (known) | Extend maintenance interval `×1.5` (max 180d) |
| Easy (known) | Extend maintenance interval `×2` (max 180d) |

## Learning UI modes

| Mode | Format id | Pool | Input |
|------|-----------|------|--------|
| Quest | `quest` | new/learning, max 10, due-first | MCQ meanings (keys 1–4) |
| Reverse Quest | `quest-reverse` | same, **min 3** words | MCQ words from meaning |
| Typed Quest | `quest-typed` | same | Type the word |
| Review | `review` | **All words in the folder** | Flip + Bad / Good / Easy |

## Out of scope

- Full SM-2 / ease factor
- Listening as a separate mode (pronounce button covers audio)
