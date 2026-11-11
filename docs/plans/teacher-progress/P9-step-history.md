# P9: Step history: when each pupil moved up

**Size:** M · **Needs a migration:** yes · **Waits for:** P2

**What's wrong:** Only the current step is kept, and rounds go after 30 days, so there's no 'moved up on 6 Nov' and no progress over a term.

**What done looks like:** A new `step_changes` table records every move up (or down) in every Foundational game from today on. The pupil steps card says 'up to step 4 on 6 Nov', and a pupil's game panel shows a small timeline of steps with dates. Kept for the school year; the end-of-year reset clears it.

## The change

1. Migration: `create table public.step_changes (id bigint generated always as identity primary key, player uuid not null references profiles(id) on delete cascade, game text not null, step_from integer, step_to integer not null, at timestamptz not null default now())`, an index on (player, game, at), RLS on with no direct reads (teacher functions only).
2. One `after update` trigger function per progress table (or one shared function given the column name) that inserts a row when `step` (or `reached`, or Beanstalk's `stage`) changes. Hop saves 10/5/2/3/4/200: store the saved value; the client turns it into a step with `stepOf`.
3. `teacher_foundational_class`: add `moves` = the last 5 changes for each game. 4. Back-fill once from the rounds still kept (earliest round at each step), marked as estimated.
5. `AdminYear` end-of-year: clear `step_changes` for the school along with the other season data (follow how the existing reset is written; it's not destructive beyond what the reset already clears, but ask James on a card if unsure).

## Files

new migration; src/data/foundational.ts; src/teacher/progress/PupilSteps.tsx; the year reset function.

## Tests and checks

Scratch-DB: updating robin_progress.step from 2 to 3 adds one row; a teacher of another class can't read it. One UI test for 'up to step 4 on 6 Nov'.

## Session prompt (ready to paste)

```text
You are building card P9 of the teacher progress plan for the Games Hub: Step history: when each pupil moved up.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P9-step-history.md) first. Create your own branch from origin/main named teacher-progress-p9. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Use create or replace with the same guard as the function you change (require_teacher() then teaches_class(...)); copy every existing block exactly and only add. Repeat the revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What done looks like: A new `step_changes` table records every move up (or down) in every Foundational game from today on. The pupil steps card says 'up to step 4 on 6 Nov', and a pupil's game panel shows a small timeline of steps with dates. Kept for the school year; the end-of-year reset clears it.

Steps:
1. Migration: `create table public.step_changes (id bigint generated always as identity primary key, player uuid not null references profiles(id) on delete cascade, game text not null, step_from integer, step_to integer not null, at timestamptz not null default now())`, an index on (player, game, at), RLS on with no direct reads (teacher functions only).
2. One `after update` trigger function per progress table (or one shared function given the column name) that inserts a row when `step` (or `reached`, or Beanstalk's `stage`) changes. Hop saves 10/5/2/3/4/200: store the saved value; the client turns it into a step with `stepOf`.
3. `teacher_foundational_class`: add `moves` = the last 5 changes for each game. 4. Back-fill once from the rounds still kept (earliest round at each step), marked as estimated.
5. `AdminYear` end-of-year: clear `step_changes` for the school along with the other season data (follow how the existing reset is written; it's not destructive beyond what the reset already clears, but ask James on a card if unsure).

Files: new migration; src/data/foundational.ts; src/teacher/progress/PupilSteps.tsx; the year reset function.

Tests and checks: Scratch-DB: updating robin_progress.step from 2 to 3 adds one row; a teacher of another class can't read it. One UI test for 'up to step 4 on 6 Nov'.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
