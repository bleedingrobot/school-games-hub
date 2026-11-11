# P3: Progress tab: the ladder board for one game

**Size:** M · **Needs a migration:** no · **Waits for:** P2

**What's wrong:** Even with the table, a teacher planning a group lesson wants to see who is on each step of one game, with the step's name.

**What done looks like:** Under the table (or as a second view on the Progress tab, 'One game'), pills for each game that is on. Picking one shows a board: a column per step headed 'Step 3' and its name ('Give 6 to 10'), plus 'Not started' first. Each pupil is a chip in their step's column with days on the step; red border when stuck, blue with a star when the top step is done, faded when quiet. On screens narrower than 900px it turns into a ladder: rows (rungs), top step at the top, chips wrapping. Tapping a chip opens the pupil page at that game. Looks like mock-2 (laptop) and mock-3 (iPad portrait).

## The change

1. New `src/teacher/progress/LadderBoard.tsx`, using `stepOf` (P1) and `cellState` (P2), and the same data call.
2. The board's game pill is in the address (`?game=robin`) so a teacher can bookmark it and Today can link to it.
3. CSS grid for columns; a media query switches to rungs. No new libraries.

## Files

new src/teacher/progress/LadderBoard.tsx (+css, +test); src/teacher/progress/Progress.tsx.

## Tests and checks

One test: pupils land in the right column for Hop (saved 10, 5, 2...) and Robin (1..6), and 'Not started' holds pupils with no progress row. Screenshots at 1366x900 and 820x1180 in the PR.

## Session prompt (ready to paste)

```text
You are building card P3 of the teacher progress plan for the Games Hub: Progress tab: the ladder board for one game.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P3-ladder-board.md) first. Create your own branch from origin/main named teacher-progress-p3. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board.

What done looks like: Under the table (or as a second view on the Progress tab, 'One game'), pills for each game that is on. Picking one shows a board: a column per step headed 'Step 3' and its name ('Give 6 to 10'), plus 'Not started' first. Each pupil is a chip in their step's column with days on the step; red border when stuck, blue with a star when the top step is done, faded when quiet. On screens narrower than 900px it turns into a ladder: rows (rungs), top step at the top, chips wrapping. Tapping a chip opens the pupil page at that game. Looks like mock-2 (laptop) and mock-3 (iPad portrait).

Steps:
1. New `src/teacher/progress/LadderBoard.tsx`, using `stepOf` (P1) and `cellState` (P2), and the same data call.
2. The board's game pill is in the address (`?game=robin`) so a teacher can bookmark it and Today can link to it.
3. CSS grid for columns; a media query switches to rungs. No new libraries.

Files: new src/teacher/progress/LadderBoard.tsx (+css, +test); src/teacher/progress/Progress.tsx.

Tests and checks: One test: pupils land in the right column for Hop (saved 10, 5, 2...) and Robin (1..6), and 'Not started' holds pupils with no progress row. Screenshots at 1366x900 and 820x1180 in the PR.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
