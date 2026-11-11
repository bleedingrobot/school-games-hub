# P10: Common wrong answers in the maths facts

**Size:** M · **Needs a migration:** yes · **Waits for:** nothing

**What's wrong:** The shared maths record keeps only counts per fact. A teacher can't see that a pupil says 54 for 7 × 8, or that half the class says 13 for 6 + 8.

**What done looks like:** Each fact remembers its last three wrong answers per pupil. The skill map's fact table and the Foundational cell detail show 'Often answers 54'. Hardest questions shows the class's most common wrong answer for each hard fact.

## The change

1. `shared/maths/leitner.ts` `FactAnswer`: add optional `given?: number | string`. Fill it where each game builds its answers (search for `recordMathsAnswers` / `FactAnswer` callers; start with the shared QuestionModal path and the Foundational kit).
2. Migration: add `wrong_recent jsonb not null default '[]'` to `gem_keep_facts`; `record_fact_answers` appends `given` on a wrong answer and keeps the last 3. Then `teacher_class_skill_map` returns it as `wrong`.
3. The edge function `supabase/functions/_shared/recordAnswers.ts` passes `given` through (it changes an edge function, which deploys on merge).
4. Show it in `src/pages/SkillMap.tsx` fact table, `src/teacher/foundational` cell detail and `src/teacher/Hardest.tsx`.

## Files

shared/maths/leitner.ts; callers; supabase/functions/_shared/recordAnswers.ts; new migration; src/data/skillMap.ts; SkillMap.tsx; Hardest.tsx.

## Tests and checks

Scratch-DB: three wrong answers keep the last three; old clients without `given` still save. One UI test for 'Often answers 54'.

## Session prompt (ready to paste)

```text
You are building card P10 of the teacher progress plan for the Games Hub: Common wrong answers in the maths facts.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P10-common-wrong-answers.md) first. Create your own branch from origin/main named teacher-progress-p10. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board. Database: take the next free migration number with node scripts/migration-numbers.mjs (other threads add migrations too, so check again just before merging). Use create or replace with the same guard as the function you change (require_teacher() then teaches_class(...)); copy every existing block exactly and only add. Repeat the revoke/grant lines at the end. Never drop or delete anything; if a step seems to need that, stop and ask James on a question card.

What done looks like: Each fact remembers its last three wrong answers per pupil. The skill map's fact table and the Foundational cell detail show 'Often answers 54'. Hardest questions shows the class's most common wrong answer for each hard fact.

Steps:
1. `shared/maths/leitner.ts` `FactAnswer`: add optional `given?: number | string`. Fill it where each game builds its answers (search for `recordMathsAnswers` / `FactAnswer` callers; start with the shared QuestionModal path and the Foundational kit).
2. Migration: add `wrong_recent jsonb not null default '[]'` to `gem_keep_facts`; `record_fact_answers` appends `given` on a wrong answer and keeps the last 3. Then `teacher_class_skill_map` returns it as `wrong`.
3. The edge function `supabase/functions/_shared/recordAnswers.ts` passes `given` through (it changes an edge function, which deploys on merge).
4. Show it in `src/pages/SkillMap.tsx` fact table, `src/teacher/foundational` cell detail and `src/teacher/Hardest.tsx`.

Files: shared/maths/leitner.ts; callers; supabase/functions/_shared/recordAnswers.ts; new migration; src/data/skillMap.ts; SkillMap.tsx; Hardest.tsx.

Tests and checks: Scratch-DB: three wrong answers keep the last three; old clients without `given` still save. One UI test for 'Often answers 54'.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
