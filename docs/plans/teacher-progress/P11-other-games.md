# P11: Other games on the Progress tab

**Size:** M · **Needs a migration:** yes · **Waits for:** P2; Toon Flap waits for its own F.5 teacher step

**What's wrong:** Gem Keep levels, Diamond Drop levels, Dragon Maths hero level and Bond Match stars live only in each pupil's folded game panel.

**What done looks like:** An 'Other games' part of the Progress table with a column for each that is on: Gem Keep (level passed), Diamond Drop (level passed of N), Dragon Maths (hero level), Bond Match (stars), and Toon Flap once F.5 adds a class read. Same cell look; no stuck rule for these (they're not stepped lessons), just the number and 'zz' when quiet.

## The change

1. For each game, check whether a class-wide read exists (`teacher_gem_keep_class`, `teacher_diamond_class`, `teacher_lord_class`, `teacher_bond_match_*`). Where it only returns class totals, add a per-pupil list in a new migration (create or replace, same guard).
2. Add the columns via a small `progressColumns` entry on each game's `teacher:` block in `src/games/<id>/index.tsx` (add the optional field to `GameDefinition` in `src/games/types.ts`), so new games can join without touching the Progress page.

## Files

src/games/types.ts; src/games/{gem-keep,diamond,lord,bond-match}/index.tsx; maybe new migration; src/teacher/progress/ProgressTable.tsx.

## Tests and checks

One test that a game with `progressColumns` gets a column and one without doesn't.

## Session prompt (ready to paste)

```text
You are building card P11 of the teacher progress plan for the Games Hub: Other games on the Progress tab.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P11-other-games.md) first. Create your own branch from origin/main named teacher-progress-p11. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Use create or replace with the same guard as the function you change (require_teacher() then teaches_class(...)); copy every existing block exactly and only add. Repeat the revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What done looks like: An 'Other games' part of the Progress table with a column for each that is on: Gem Keep (level passed), Diamond Drop (level passed of N), Dragon Maths (hero level), Bond Match (stars), and Toon Flap once F.5 adds a class read. Same cell look; no stuck rule for these (they're not stepped lessons), just the number and 'zz' when quiet.

Steps:
1. For each game, check whether a class-wide read exists (`teacher_gem_keep_class`, `teacher_diamond_class`, `teacher_lord_class`, `teacher_bond_match_*`). Where it only returns class totals, add a per-pupil list in a new migration (create or replace, same guard).
2. Add the columns via a small `progressColumns` entry on each game's `teacher:` block in `src/games/<id>/index.tsx` (add the optional field to `GameDefinition` in `src/games/types.ts`), so new games can join without touching the Progress page.

Files: src/games/types.ts; src/games/{gem-keep,diamond,lord,bond-match}/index.tsx; maybe new migration; src/teacher/progress/ProgressTable.tsx.

Tests and checks: One test that a game with `progressColumns` gets a column and one without doesn't.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
