# Dragon Maths, shipping L.6 and the topic switches

You are continuing **Dragon Maths** in James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things stand (checked 19 Oct 2026)
- Dragon Maths is **already live and switched on**: L.4 and L.5 are applied and deployed, `lord_enabled` is true for the school and for James's class (read-only check on the live database), and `DRAGON_MATHS_ON` is true on `main`, so the dashboard card shows. The class has tried it and James says nothing felt wrong.
- **What is NOT live yet** is everything on branch `dragon-maths` (worktree `~/projects/school-games-hub-dragon-maths`), three commits ahead of `origin/main`:
  1. **L.6** (`8b91b23`): the How to play page, the hint button (an optional `onHint` on the shared question box, `hinted` on the proof), the letter-key switch, the bundled VT323 font, accessibility fixes, README and docs. Read `docs/LORD-PLAN.md` "L.6 results" first.
  2. A merge of `main` (`02cd5f4`).
  3. **Teacher topic switches** (`2d7ceed`): migration `supabase/migrations/20261019000300_lord_topics.sql` (adds `app_settings.lord_topics`, changes `lord_settings()` and `teacher_set_lord()`), the `lord` function refusing questions from a switched-off topic, and the tick-list on the teacher page. Test file `supabase/tests/database/lord_topics.test.sql`.
- The **live `lord` function does not know about hints yet**, so until it is redeployed a hinted right answer is not paid as a hint answer. The website change and the function change should go out together.
- Not tested with a real screen reader or on a real Chromebook (only Chromium with the processor slowed).

## Rules
- **Merging to `main`, applying the migration and deploying the function all touch the live site. Only do them if James says so in this session.** Ask once, plainly, before the first live step, and say exactly what will happen. Never push with a bare `git push`; the branch's upstream is `origin/main`, so use `git push origin dragon-maths:dragon-maths` for a branch push and `git push origin dragon-maths:main` only with James's say-so.
- Plain reads of the live database are fine; no writes except the migration James approved.
- Before anything live: `git fetch`, merge `origin/main` into `dragon-maths`, then `npx tsc --noEmit`, `npx vitest run`, `npm run build`. Known failures that are not this branch's: the flaky chess-bot test in `App.test.tsx` (passes alone), and the generated `supabase/functions/monster/index.ts` if it is out of date (leave it).
- **Migration number.** `main` has `20261019000100_my_moves_left.sql` and may have more by now. Check `supabase/migrations/` on `main` and in the other worktrees. If something newer than `20261019000300` changes `app_settings`, `lord_settings()` or `teacher_set_lord()`, renumber `lord_topics` after it and merge its changes into the new versions.
- **Run the SQL test first.** Scratch recipe: one script with `begin;`, the migration, then `supabase/tests/database/lord_topics.test.sql` (without its own `begin;`), run with `docker exec -i supabase_db_school-games-hub psql -U postgres -t -A < script.sql`, look for `not ok`. It rolls back. (The test needs the earlier Dragon Maths migrations to already be in the scratch database; check, and if not, put those first.)
- Rebuild the function with `node scripts/build-lord.mjs` (not `npm run build:functions`, which also touches `monster/index.ts`). A test fails if the generated file is out of date.

## The steps (stop and ask James before each live one)
1. **Pre-flight (nothing live):** merge main, run the checks, check migration numbers, run the SQL test, and tell James the plan in plain words: what goes out, in what order, and what the class will notice (a How to play page, a Hint button, a tick-list of topics on the teacher page, nothing lost).
2. **Apply the migration** `20261019000300_lord_topics.sql` to the live database (`npx supabase db query --linked -f <file>` from `~/projects/school-games-hub`, which is the linked checkout). It only adds a column (all eight topics on to start) and replaces two functions. Add its number to the `migration repair` note at the bottom of `docs/PLAN.md`.
3. **Deploy the function:** `npx supabase functions deploy lord --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. Order matters: migration first, then function, then the website, so the website never asks for a setting that does not exist.
4. **Check from outside:** the `lord` function answers 401 JSON without a sign-in; `lord_settings()` now includes `topics` (all eight); the app still reads fine for a signed-in student (use James's teacher account in the browser if no test student is available).
5. **Publish the website:** merge to `main` (`git push origin dragon-maths:main`) only with James's OK. Then, once the site has built, in the browser as the teacher: the **How to play** page (the `?` key, the village button, the class-choice fold-out), a question with the **Hint** button (one clue per question; a hinted right answer pays about half), the letter-key tick box, the **topic tick-list** on the Dragon Maths teacher panel (turn one topic off and on again, check at least one must stay on), and one forest fight end to end.
6. Add a short "L.6 and topic switches went live" note to `docs/LORD-PLAN.md` (what was applied and deployed, when, what was checked), update the memory note `dragon_maths_l5.md`, and stop for James.

## Things to tell James, not to decide for him
- The riddle gold for a hint was changed to ×0.75 (right 1.5, wrong 0.3); the plan wanted "a short worked step", but the packs have no worked-step text, so the hint is a generic clue (two wrong choices greyed out, or "the answer is between 40 and 60").
- Money and patterns topics exist only in Dragon Maths; the tick-list has all eight.
- A real screen reader (NVDA, ChromeVox) and a real Chromebook have not been tried.

## How to turn it off again
The teacher page's Dragon Maths switch, or `update public.app_settings set lord_enabled = false where id;`. The topic list can be put back with `update public.app_settings set lord_topics = '{place-value,add-sub,times-tables,division,fractions,decimals,money,patterns}';`. If the website is the problem, revert the merge commit on `main`; the migration is additive and safe to leave.
