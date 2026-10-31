# Prompt: Kingdom Keeper, going live

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-city` (branch `city`).

---
You are continuing **Kingdom Keeper** (short id `kingdom`), a Hamurabi-style city game with a maths council, for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

## Step 0: quick check (1 minute)
Ask James, in plain words, whether he has tried the preview (the private Artifact link in `docs/KINGDOM-PLAN.md`, section 10) and is happy with it, whether he wants to change any of the choices in section 9 of the plan, and which live steps he wants to do today. Then do **step 1 only** (pre-flight, nothing live) and stop for his word before step 2.

## Where things stand
- Built and tested on branch `city` (pushed as `origin/city` only if James said so). Read `docs/GAME_DEVELOPMENT_GUIDE.md` sections 8 and 9, then `docs/KINGDOM-PLAN.md` (decisions in section 9, results in section 10).
- **Nothing is live.** One migration, `20261026000100_kingdom.sql` (the `kingdom_reigns` table, four server-only functions, the switch `app_settings.kingdom_enabled`, the hooks and six achievements), is written and tested on a scratch copy but NOT applied. The `kingdom` function (`supabase/functions/kingdom/index.ts`) is built but NOT deployed.
- The **code switch** is `ON = false` in `src/games/kingdom/switch.ts`. The game is in `src/games/registry.ts` behind it. The **teacher switch** starts off everywhere. The card shows only when both are on.
- It depends on `20261020000100_game_hooks.sql`, `space_maths_context`, `record_fact_answers` (through `recordMathsAnswers`), `settings_of`, `require_settings_target`, `gem_keep_check_player`. Check, don't assume (step 1).
- Requests: about 42 a reign (a year is one decision and up to three council answers); a class of 30 playing two reigns in a lesson is about 2,500.

## Rules
- **Applying the migration, deploying the function, merging to `main` and switching things on all touch the live site. Only do each one if James says so, in words, in this session.** Ask once, plainly, before each live step, and say exactly what will happen. Approval for one step is not approval for the next.
- Never `supabase db reset`. Never a bare `git push` (use `git push origin city`). Never push to `main` from this worktree unless James says to push `city:main`.
- Build only this function: `npm run build:functions -- kingdom`. If `supabase/functions/monster/index.ts` changes, `git checkout` it.
- Don't commit `dist-preview-kingdom/`. Say plainly about any failure.

## The steps (stop and ask James before each live one)
1. **Pre-flight (nothing live).**
   - `git fetch`, merge `origin/main` into `city`. Run `node scripts/migration-numbers.mjs`. If `20261026000100` is taken, or anything newer has arrived on `main`, rename the Kingdom migration to the next free number after it (and update the plan and this prompt).
   - Check the shared database tests agree with the new `main`: `security.test.sql` (Kingdom adds `teacher_set_kingdom` to the signed-in list) and `progress_access.test.sql`'s achievement count (Kingdom adds 6; it was 99 on the branch = 93 + 6). If other games added some since, add up again.
   - If branch `test-trim` (PR #30, the test budget) has been merged, check `scripts/test-budget.test.ts` still passes: Kingdom has 8 tests.
   - `npm run typecheck`, `npm run test:all` (folder by folder if the machine runs short of memory), `npm run build`.
   - Database checks on a scratch copy: `scripts/scratch-db.sh kingdom` then `scripts/scratch-test.sh kingdom` (all files). `clans_fights.test.sql` and `maths_focus_results.test.sql` already fail on any scratch copy and aren't Kingdom's. Drop the copy after: `docker exec supabase_db_school-games-hub psql -U postgres -c 'drop database kingdom'`.
   - Ask the live database (`npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi "<sql>"`):
     `select to_regclass('public.hub_games'), to_regclass('public.achievement_measures');` and
     `select to_regprocedure('public.space_maths_context(uuid)'), to_regprocedure('public.add_game_points(uuid,text,integer,text)'), to_regprocedure('public.game_progress_changed(uuid,text)'), to_regprocedure('public.settings_of(uuid)'), to_regprocedure('public.require_settings_target(uuid)'), to_regprocedure('public.gem_keep_check_player(uuid)');` (all a name), and `select to_regclass('public.kingdom_reigns');` (null: not applied yet).
   - Tell James the results and stop.
2. **Apply the migration** (James's yes): `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/20261026000100_kingdom.sql`. Check: `kingdom_reigns` exists and is empty; `select count(*) from public.app_settings where kingdom_enabled;` is 0; `select id from public.hub_games where id = 'kingdom';` is one row; six `kingdom-` achievements. Add the number to the `migration repair` note at the bottom of `docs/PLAN.md`.
3. **Deploy the function** (James's yes): `npm run build:functions -- kingdom`, then `npx supabase functions deploy kingdom --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. Check: an unsigned `curl -s -X POST https://zqzhetlzvtptnkmeiumi.supabase.co/functions/v1/kingdom` answers 401 "Please sign in again.", not a crash or 404.
4. **Check from outside.** As a pupil (or with the anon key): `select * from public.kingdom_reigns` refused (42501), `select public.kingdom_load(...)` refused; `select count(*) from public.scored_games;` not smaller than before.
5. **Merge to `main`** (James's word): merge `origin/main` into `city` one last time, add `kingdom` to the end of `FUNCTIONS` in `scripts/build-functions.mjs` if not there, then open a pull request (James has merged from his phone) or push `city:main` if he says so. Watch "Test and publish" go green.
6. **Try it live as a teacher** while the pupils' switch is off: teachers can open `/#/kingdom` once the code switch is on, so: set `ON = true` in `src/games/kingdom/switch.ts` (James's yes, its own small merge), then James switches it on for his class on the Teacher page when he's ready.
7. **Write it down:** a "went live" note in `docs/KINGDOM-PLAN.md` (what was applied, deployed and checked, when). Then stop for James's feedback.

**Turning it off:** the teacher switch on the Teacher page (the server refuses everything while it's off), then the code switch (`ON = false`), then deleting the function in the Supabase dashboard. Never drop the table.
