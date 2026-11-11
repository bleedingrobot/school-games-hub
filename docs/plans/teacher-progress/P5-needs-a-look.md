# P5: 'Who needs a look' pills, Today links, flags out of the far column

**Size:** S · **Needs a migration:** no · **Waits for:** P2 (P4 for the 'nearly' pill)

**What's wrong:** Today says '4 pupils on the same step' and links to the Foundational grid, where the flags sit in the 14th column, off screen on a laptop and an iPad, and make rows very tall.

**What done looks like:** Pills at the top of the Progress tab: 'N stuck', 'N nearly ready to move up', 'N finished a game', 'N gone quiet'. A pill filters the table to those pupils (and is in the address: ?show=stuck). Today's Foundational alert lines link to /progress?show=stuck&game=<id>. On the Foundational skills grid, the flags move from the far-right column to a small '!' count beside the pupil's name that opens their list, so rows stay one line high.

## The change

1. `src/teacher/progress/Progress.tsx`: count states over all cells; a pill sets `?show=`.
2. `src/teacher/foundational/alerts.ts`: change the alert `to` link for 'same step' lines to the Progress tab.
3. `src/teacher/foundational/FoundationalGrid.tsx` and `foundational.css`: drop the Flags column; show a '! 3' button in the name cell that opens the existing flag list in a small popover (reuse the cell-detail panel pattern already in the grid).

## Files

src/teacher/progress/Progress.tsx; src/teacher/foundational/{alerts.ts,FoundationalGrid.tsx,foundational.css}; tests beside them.

## Tests and checks

Update the existing grid and alerts tests for the new link and the moved flags; one test that ?show=stuck keeps only stuck pupils.

## Session prompt (ready to paste)

```text
You are building card P5 of the teacher progress plan for the Games Hub: 'Who needs a look' pills, Today links, flags out of the far column.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P5-needs-a-look.md) first. Create your own branch from origin/main named teacher-progress-p5. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board.

What done looks like: Pills at the top of the Progress tab: 'N stuck', 'N nearly ready to move up', 'N finished a game', 'N gone quiet'. A pill filters the table to those pupils (and is in the address: ?show=stuck). Today's Foundational alert lines link to /progress?show=stuck&game=<id>. On the Foundational skills grid, the flags move from the far-right column to a small '!' count beside the pupil's name that opens their list, so rows stay one line high.

Steps:
1. `src/teacher/progress/Progress.tsx`: count states over all cells; a pill sets `?show=`.
2. `src/teacher/foundational/alerts.ts`: change the alert `to` link for 'same step' lines to the Progress tab.
3. `src/teacher/foundational/FoundationalGrid.tsx` and `foundational.css`: drop the Flags column; show a '! 3' button in the name cell that opens the existing flag list in a small popover (reuse the cell-detail panel pattern already in the grid).

Files: src/teacher/progress/Progress.tsx; src/teacher/foundational/{alerts.ts,FoundationalGrid.tsx,foundational.css}; tests beside them.

Tests and checks: Update the existing grid and alerts tests for the new link and the moved flags; one test that ?show=stuck keeps only stuck pupils.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
