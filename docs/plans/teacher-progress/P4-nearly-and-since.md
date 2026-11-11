# P4: 'Nearly ready to move up' and 'on this step since'

**Size:** M · **Needs a migration:** yes · **Waits for:** P2

**What's wrong:** The games move pupils up by themselves, so a teacher's 'ready to move on' means 'nearly at the next step' or 'finished the top step'. The first can't be shown: `teacher_foundational_class` doesn't return `good_at_step`. Days on a step are guessed from the last 10 rounds.

**What done looks like:** A green up-arrow on the table and board for pupils one good go away from the next step, and an exact 'on this step since 6 Nov (5 days)'. The 'Who needs a look' count of 'nearly ready' works (P5).

## The change

1. Migration `<next>_teacher_progress_nearly.sql`: create or replace `public.teacher_foundational_class(target uuid)` (latest body is in `supabase/migrations/20261108000900_beanstalk_teacher_stage.sql`; copy it exactly) and add two keys to each game's object: `good` = the progress row's `good_at_step` (Tūī, Robin, Parrot, Lizard, Pigeon, Swamp Hen; null for the others) and `since` = the NZ day of the earliest finished round in an unbroken run at today's step, counting back from the newest (for games whose rounds hold the step: `step`/`level` columns, or `round->>'step'`; null for Beanstalk). Check each column name in that game's own migration.
2. `src/data/foundational.ts` `parseGame`: read `good` and `since` (null-safe).
3. `src/teacher/progress/state.ts`: 'nearly' when `good >= goodToPass - 1` (import each game's `GOOD_TO_PASS` / `STEP_RULES.goodToPass` from `shared/<game>/config.ts`; all are 2 today). For Hop, Penguin Pairs, Weka and Pipi, which move up on fact mastery, 'nearly' = at least 60% of the current step's facts are Secure in the class facts (`classFacts`); put 60% in `src/teacher/foundational/config.ts` as `NEARLY_SHARE`. Days on the step come from `since` when present.

## Files

new migration; src/data/foundational.ts; src/teacher/progress/state.ts; src/teacher/foundational/config.ts.

## Tests and checks

Try the migration on a scratch copy (scripts/scratch-db.sh): a pupil with good_at_step 1 gets good 1; a teacher of another class gets error 42501. One unit test for 'nearly' on a step game and on Hop.

## Session prompt (ready to paste)

```text
You are building card P4 of the teacher progress plan for the Games Hub: 'Nearly ready to move up' and 'on this step since'.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P4-nearly-and-since.md) first. Create your own branch from origin/main named teacher-progress-p4. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Use create or replace with the same guard as the function you change (require_teacher() then teaches_class(...)); copy every existing block exactly and only add. Repeat the revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What done looks like: A green up-arrow on the table and board for pupils one good go away from the next step, and an exact 'on this step since 6 Nov (5 days)'. The 'Who needs a look' count of 'nearly ready' works (P5).

Steps:
1. Migration `<next>_teacher_progress_nearly.sql`: create or replace `public.teacher_foundational_class(target uuid)` (latest body is in `supabase/migrations/20261108000900_beanstalk_teacher_stage.sql`; copy it exactly) and add two keys to each game's object: `good` = the progress row's `good_at_step` (Tūī, Robin, Parrot, Lizard, Pigeon, Swamp Hen; null for the others) and `since` = the NZ day of the earliest finished round in an unbroken run at today's step, counting back from the newest (for games whose rounds hold the step: `step`/`level` columns, or `round->>'step'`; null for Beanstalk). Check each column name in that game's own migration.
2. `src/data/foundational.ts` `parseGame`: read `good` and `since` (null-safe).
3. `src/teacher/progress/state.ts`: 'nearly' when `good >= goodToPass - 1` (import each game's `GOOD_TO_PASS` / `STEP_RULES.goodToPass` from `shared/<game>/config.ts`; all are 2 today). For Hop, Penguin Pairs, Weka and Pipi, which move up on fact mastery, 'nearly' = at least 60% of the current step's facts are Secure in the class facts (`classFacts`); put 60% in `src/teacher/foundational/config.ts` as `NEARLY_SHARE`. Days on the step come from `since` when present.

Files: new migration; src/data/foundational.ts; src/teacher/progress/state.ts; src/teacher/foundational/config.ts.

Tests and checks: Try the migration on a scratch copy (scripts/scratch-db.sh): a pupil with good_at_step 1 gets good 1; a teacher of another class gets error 42501. One unit test for 'nearly' on a step game and on Hop.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
