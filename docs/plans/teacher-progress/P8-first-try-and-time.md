# P8: Right first try and time per go, from taps already saved

**Size:** M · **Needs a migration:** yes · **Waits for:** P2

**What's wrong:** Every tap's pick and time is saved in each round's `taps`, and six games save `first_right`, but teachers only see a tap count.

**What done looks like:** Each pupil and game has '% right first try' and 'usual time to first tap' over the last 10 rounds. They show on the pupil steps card (P6), in the board chip's detail, and as a sort on the Progress table ('Slowest first').

## The change

1. Migration: in `teacher_foundational_class` add to each recent round `f` = goes right first try (from `first_right` where the game has it, else the count of goes whose first tap was right, worked out from `taps`) and `ms` = the median `ms` of each go's first tap. Keep it to the last 10 rounds (already the limit). Check the taps shape in `shared/kit/replay.ts` (`firstTapTimes`).
2. `src/data/foundational.ts`: parse `f` and `ms`. 3. Show them as above.

## Files

new migration; src/data/foundational.ts; src/teacher/progress/*.

## Tests and checks

Scratch-DB check of one round's f and ms; one unit test for the % and median.

## Session prompt (ready to paste)

```text
You are building card P8 of the teacher progress plan for the Games Hub: Right first try and time per go, from taps already saved.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P8-first-try-and-time.md) first. Create your own branch from origin/main named teacher-progress-p8. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Use create or replace with the same guard as the function you change (require_teacher() then teaches_class(...)); copy every existing block exactly and only add. Repeat the revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What done looks like: Each pupil and game has '% right first try' and 'usual time to first tap' over the last 10 rounds. They show on the pupil steps card (P6), in the board chip's detail, and as a sort on the Progress table ('Slowest first').

Steps:
1. Migration: in `teacher_foundational_class` add to each recent round `f` = goes right first try (from `first_right` where the game has it, else the count of goes whose first tap was right, worked out from `taps`) and `ms` = the median `ms` of each go's first tap. Keep it to the last 10 rounds (already the limit). Check the taps shape in `shared/kit/replay.ts` (`firstTapTimes`).
2. `src/data/foundational.ts`: parse `f` and `ms`. 3. Show them as above.

Files: new migration; src/data/foundational.ts; src/teacher/progress/*.

Tests and checks: Scratch-DB check of one round's f and ms; one unit test for the % and median.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
