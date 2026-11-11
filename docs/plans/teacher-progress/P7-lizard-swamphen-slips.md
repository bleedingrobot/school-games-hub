# P7: Usual slip for Lizard and Swamp Hen

**Size:** S · **Needs a migration:** yes · **Waits for:** nothing

**What's wrong:** Lizard and Swamp Hen are the only Foundational games with no `slips` column, so their pupil lines have no 'usual slip'.

**What done looks like:** Their rounds save a slip per go, like Pigeon, and `teacher_lizard_student` / `teacher_swamphen_student` return the commonest slip of the last 10 rounds (3 or more and no tie), shown on the pupil page.

## The change

Copy exactly what Pigeon got in `supabase/migrations/20261110001000_newer_five_slips.sql` and its PR (search the git log for 'slips' and Pigeon): add `slips jsonb` to `lizard_rounds` and `swamphen_rounds`, fill it when a round finishes (the replay already works out slips: `shared/kit/slips.ts`), and return `slip` from the two teacher functions. Add the slip words for each game's kinds in its `words.ts` / teacher panel.

## Files

new migration; supabase/functions or the round-finish SQL for lizard and swamphen; shared/lizard, shared/swamphen (slip kinds); src/pages/TeacherLizard.tsx, TeacherSwamphen.tsx.

## Tests and checks

Follow the Pigeon slips tests: one per game that a round with two 'over' first wrong taps saves them, and the teacher panel shows the words.

## Session prompt (ready to paste)

```text
You are building card P7 of the teacher progress plan for the Games Hub: Usual slip for Lizard and Swamp Hen.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P7-lizard-swamphen-slips.md) first. Create your own branch from origin/main named teacher-progress-p7. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Use create or replace with the same guard as the function you change (require_teacher() then teaches_class(...)); copy every existing block exactly and only add. Repeat the revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What done looks like: Their rounds save a slip per go, like Pigeon, and `teacher_lizard_student` / `teacher_swamphen_student` return the commonest slip of the last 10 rounds (3 or more and no tie), shown on the pupil page.

Steps:
Copy exactly what Pigeon got in `supabase/migrations/20261110001000_newer_five_slips.sql` and its PR (search the git log for 'slips' and Pigeon): add `slips jsonb` to `lizard_rounds` and `swamphen_rounds`, fill it when a round finishes (the replay already works out slips: `shared/kit/slips.ts`), and return `slip` from the two teacher functions. Add the slip words for each game's kinds in its `words.ts` / teacher panel.

Files: new migration; supabase/functions or the round-finish SQL for lizard and swamphen; shared/lizard, shared/swamphen (slip kinds); src/pages/TeacherLizard.tsx, TeacherSwamphen.tsx.

Tests and checks: Follow the Pigeon slips tests: one per game that a round with two 'over' first wrong taps saves them, and the teacher panel shows the words.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
