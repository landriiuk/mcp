# AI context — InkLex

This folder holds a short context pack for AI assistants working on the project.

## Files

| File | Purpose |
|------|---------|
| [WORKING-RULES.md](./WORKING-RULES.md) | Core working rules, architecture, UX, and code conventions |
| [../algorithms/due-first-session.md](../algorithms/due-first-session.md) | Due-first session ordering + practice formats |
| [../product/PRODUCT-PLAN.md](../product/PRODUCT-PLAN.md) | Product roadmap, market differentiation, next bets |
| [../product/CAPTURE-MVP.md](../product/CAPTURE-MVP.md) | Capture MVP tickets (Quick Add / paste / sentence) |

## Cursor rules (agents)

| Rule | When |
|------|------|
| `.cursor/rules/inklex-project.mdc` | Always — product + UX + stack |
| `.cursor/rules/inklex-practice.mdc` | Practice/quest/review/capture files — session shell, SRS, Typed Continue, Reverse min 3 |

## How to use

- Add `@docs/ai/WORKING-RULES.md` to a Cursor chat when you need full context.
- Add `@docs/product/PRODUCT-PLAN.md` when planning features or product direction.
- Add `@.cursor/rules/inklex-practice.mdc` (or open a practice file) so the practice agent constraints load.
- The `.cursor/rules/inklex-project.mdc` rule loads key points automatically.

Update `WORKING-RULES.md` when product or stack conventions change.
Update `PRODUCT-PLAN.md` when roadmap priorities or positioning change.
Update `inklex-practice.mdc` when practice-session invariants change.
