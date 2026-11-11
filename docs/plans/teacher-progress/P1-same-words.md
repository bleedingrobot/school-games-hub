# P1: Same words for steps everywhere

**Size:** S · **Needs a migration:** no · **Waits for:** nothing

**What's wrong:** Six different words mean 'where a pupil is in a game': step, level, reached, sum, stage, and 'Bonds to 20'. 'Help level 2' (picture help) sits right after 'Step 3', and the pupil Overview's 'Level 5' is a points level.

**What done looks like:** Every Foundational game reads 'Step 3 of 6: Give 6 to 10' on the pupil page, in Today alerts and in grid flags. 'Picture help' replaces 'help level'. The Overview says 'Points level 5'. The roster column says 'Maths ladder'. Quick looks keeps 'stage' only where it means the Quick looks stages, and the skill map keeps 'stage' for maths ladder stages.

## The change

1. `src/teacher/foundational/config.ts` `GAMES`: set `levelWord: 'step'` for every game (Beanstalk, Hop, Penguin Pairs, Pipi, Weka too). Add an `order: number[]` to `GameWords` listing the saved values from lowest to highest step (Hop saves 10, 5, 2, 3, 4, 200; the others 1..top; Beanstalk 0..3), and a helper `stepOf(game, saved) -> { n, of, name }` that turns a saved value into 'Step n of N: name'. Export it for P2, P3 and P6.
2. The pupil-page summaries in `src/pages/Teacher<Game>.tsx` (`robinStudentSummary`, `tuiStudentSummary`, `pipiStudentSummary` and the rest for the 11 Foundational games): start each with `stepOf(...)` words, then the days, then 'picture help N of 5' where the game has it, then the usual slip. Keep the game's own flavour words ('at this tree') out of the summary line.
3. `src/teacher/StudentPage.tsx` Overview: 'Level N · points' -> 'Points level N · points'; 'Ladder' -> 'Maths ladder'. `src/teacher/Students.tsx` column 'Ladder' -> 'Maths ladder'.
4. Check `shared/kit/teacherGrid.ts` flag text uses the level word and level label it is given (it should need no change).

## Files

src/teacher/foundational/config.ts, src/pages/Teacher{Robin,Tui,Parrot,Lizard,Pigeon,Swamphen,Pipi,Weka,Korora,Hop,Beanstalk}.tsx, src/teacher/StudentPage.tsx, src/teacher/Students.tsx, tests next to them.

## Tests and checks

One test that every game in GAMES names every step in `order` and that `stepOf('hop', 2)` gives 'Step 3 of 6: Counting in twos'. Update any existing test whose words changed (search the tests for 'reached', 'help level', 'Ladder').

## Session prompt (ready to paste)

```text
You are building card P1 of the teacher progress plan for the Games Hub: Same words for steps everywhere.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P1-same-words.md) first. Create your own branch from origin/main named teacher-progress-p1. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board.

What done looks like: Every Foundational game reads 'Step 3 of 6: Give 6 to 10' on the pupil page, in Today alerts and in grid flags. 'Picture help' replaces 'help level'. The Overview says 'Points level 5'. The roster column says 'Maths ladder'. Quick looks keeps 'stage' only where it means the Quick looks stages, and the skill map keeps 'stage' for maths ladder stages.

Steps:
1. `src/teacher/foundational/config.ts` `GAMES`: set `levelWord: 'step'` for every game (Beanstalk, Hop, Penguin Pairs, Pipi, Weka too). Add an `order: number[]` to `GameWords` listing the saved values from lowest to highest step (Hop saves 10, 5, 2, 3, 4, 200; the others 1..top; Beanstalk 0..3), and a helper `stepOf(game, saved) -> { n, of, name }` that turns a saved value into 'Step n of N: name'. Export it for P2, P3 and P6.
2. The pupil-page summaries in `src/pages/Teacher<Game>.tsx` (`robinStudentSummary`, `tuiStudentSummary`, `pipiStudentSummary` and the rest for the 11 Foundational games): start each with `stepOf(...)` words, then the days, then 'picture help N of 5' where the game has it, then the usual slip. Keep the game's own flavour words ('at this tree') out of the summary line.
3. `src/teacher/StudentPage.tsx` Overview: 'Level N · points' -> 'Points level N · points'; 'Ladder' -> 'Maths ladder'. `src/teacher/Students.tsx` column 'Ladder' -> 'Maths ladder'.
4. Check `shared/kit/teacherGrid.ts` flag text uses the level word and level label it is given (it should need no change).

Files: src/teacher/foundational/config.ts, src/pages/Teacher{Robin,Tui,Parrot,Lizard,Pigeon,Swamphen,Pipi,Weka,Korora,Hop,Beanstalk}.tsx, src/teacher/StudentPage.tsx, src/teacher/Students.tsx, tests next to them.

Tests and checks: One test that every game in GAMES names every step in `order` and that `stepOf('hop', 2)` gives 'Step 3 of 6: Counting in twos'. Update any existing test whose words changed (search the tests for 'reached', 'help level', 'Ladder').

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
