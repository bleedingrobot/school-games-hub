# P6: Pupil page: 'Steps in each game' card

**Size:** S · **Needs a migration:** no · **Waits for:** P1 and P2

**What's wrong:** On a pupil's page each game's step is a one-line summary inside a folded list of up to 20 games.

**What done looks like:** A card near the top of the pupil page: one row per Foundational game they've played, plus Quick looks. Each row has a step track (one box per step, filled to their step, the current box outlined, red if stuck), 'Step 3: Give 6 to 10', days on this step, and % right first try once P8 is in. 'Not played yet' rows go last. The folded game lines stay below for detail. Looks like mock-5.

## The change

1. New `src/teacher/progress/PupilSteps.tsx`. Data: `foundationalClass(classId)` and pick the pupil (the class is in the address; this keeps one cached call), using `stepOf` and `cellState`.
2. `src/teacher/StudentPage.tsx`: show it between Overview and Games.

## Files

new src/teacher/progress/PupilSteps.tsx (+test); src/teacher/StudentPage.tsx.

## Tests and checks

One test: a pupil on Robin step 3 of 6 shows three filled boxes and the step name; a pupil with no Robin row shows 'Not played yet'.

## Session prompt (ready to paste)

```text
You are building card P6 of the teacher progress plan for the Games Hub: Pupil page: 'Steps in each game' card.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P6-pupil-steps-card.md) first. Create your own branch from origin/main named teacher-progress-p6. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board.

What done looks like: A card near the top of the pupil page: one row per Foundational game they've played, plus Quick looks. Each row has a step track (one box per step, filled to their step, the current box outlined, red if stuck), 'Step 3: Give 6 to 10', days on this step, and % right first try once P8 is in. 'Not played yet' rows go last. The folded game lines stay below for detail. Looks like mock-5.

Steps:
1. New `src/teacher/progress/PupilSteps.tsx`. Data: `foundationalClass(classId)` and pick the pupil (the class is in the address; this keeps one cached call), using `stepOf` and `cellState`.
2. `src/teacher/StudentPage.tsx`: show it between Overview and Games.

Files: new src/teacher/progress/PupilSteps.tsx (+test); src/teacher/StudentPage.tsx.

Tests and checks: One test: a pupil on Robin step 3 of 6 shows three filled boxes and the step name; a pupil with no Robin row shows 'Not played yet'.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
