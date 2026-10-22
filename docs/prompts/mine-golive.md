# Prompt: Mine Runner, going live (after stage 5)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-mine` (branch `mine`).

---
You are continuing **Mine Runner**, a Descent-style 3D mine-flying game in James's **School Games Hub** (games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

## Step 0: quick check (1 minute)
Ask James, in plain words, whether he has changed or applied anything since stage 5, whether he has tried the phone preview (link in `docs/MINE-PLAN.md`, Stage 2 results) and is happy with how it feels, and which live steps he wants to do today. Then do **step 1 only** (pre-flight, nothing live) and stop for his word before step 2.

## Where things stand
- **Stages 1 to 5 are built and tested** on branch `mine`. Read `docs/GAME_DEVELOPMENT_GUIDE.md` section 8 and 9, then `docs/MINE-PLAN.md`: "Stage 4 results" and "Stage 5 results" (the go-live list is at the bottom of each).
- **Nothing is live.** Two migrations are written and tested on a scratch copy but NOT applied, and must go in this order: `20261021000100_mine.sql` (runs, bests, questions, boards, the maths switch) then `20261021000200_mine_hub.sql` (the game's on/off switch, points, achievements, New Season and teacher-list hooks). The `mine` function (`supabase/functions/mine/index.ts`) is built but NOT deployed.
- The **code switch** is `ON = false` in `src/games/mine/switch.ts`, so the game is not in the build at all. The **teacher switch** (`app_settings.mine_enabled`) starts off everywhere. The card shows only when both are on.
- Both migrations depend on `20261020000100_game_hooks.sql` (applied live 20 Oct 2026) and on the shared maths functions (`space_maths_context`, `record_fact_answers`). Check, don't assume (step 1).
- The function checks sign-in with `userIdFromToken`, makes and marks questions itself, replays every run, and refuses to start while the teacher switch is off. Server cost was measured: about 620 function requests for a class of 30 flying mines 1 to 4 (`npm run mine:sim`); the free plan allows 500,000 a month.

## Rules
- **Applying a migration, deploying the function, merging to `main` and switching things on all touch the live site. Only do each one if James says so, in words, in this session.** Ask once, plainly, before the first live step, and say exactly what will happen. Approval for one step is not approval for the next.
- Never `supabase db reset` (other sessions share the local database). Never a bare `git push` (use `git push origin mine`). Never push to `main` from this worktree.
- Build only your own function: `npm run build:functions -- mine`. If `supabase/functions/monster/index.ts` changes, `git checkout` it.
- Say plainly about any failure; don't hide it.

## The steps (stop and ask James before each live one)
1. **Pre-flight (nothing live).**
   - `git fetch`, merge `origin/main` into `mine`. Run `node scripts/migration-numbers.mjs`. If either mine migration number is now taken or something newer than `20261021000200` has arrived, **renumber the mine files after it** (never rename a migration already on `main`), and check any shared function that arrived since is not re-created by mine (it should not be: mine only uses `hub_games` hooks).
   - Check the shared database tests still agree with the new `main`: `supabase/tests/database/security.test.sql` lists every function a signed-in user can call (mine adds `my_mine`, `mine_board`, `teacher_set_mine`, `teacher_set_mine_maths`) and `progress_access.test.sql` counts achievements (mine makes it 83 on top of the 77 on `main` when this was written). If other games added some since, add up again.
   - Run `npm run typecheck`, `npm run test:all` (about 3 minutes; a few busy-computer timeouts pass alone with `--testTimeout=30000`: say so) and `npm run build`.
   - Database checks on a scratch copy built from `main`'s migrations plus mine: `scripts/scratch-db.sh mine` then `scripts/scratch-test.sh mine` (all files). Four tests already fail on any scratch copy (the clans midnight job twice, one focus-results day check, and none of them are Mine Runner's); anything else failing needs fixing. Drop the copy after: `docker exec supabase_db_school-games-hub psql -U postgres -c 'drop database mine'`.
   - Check the live database has what Mine Runner depends on, by asking it (Supabase SQL Editor, or `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi "<sql>"`): `select to_regclass('public.hub_games'), to_regclass('public.game_points');` (both a name) and `select to_regprocedure('public.space_maths_context(uuid)'), to_regprocedure('public.record_fact_answers(uuid,text,uuid,jsonb,integer,integer,integer)');` (both a name). If any is empty, stop and tell James.
   - Tell James the plan in plain words.
2. **Apply the migrations** to the live database, in order: `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/20261021000100_mine.sql`, then the same for `20261021000200_mine_hub.sql` (or paste each into the SQL Editor). Add both numbers to the `migration repair` note at the bottom of `docs/PLAN.md`.
   *Check it worked:* `select count(*) from public.mine_runs;` is 0; `select distinct mine_enabled from public.app_settings;` is `false` only; `select count(*) from public.achievement_types where game = 'mine';` is 6; `select id from public.hub_games where id = 'mine';` is one row; the older games' counts are unchanged (`select count(*) from public.scored_games;` is not smaller than before; write it down in step 1 first).
3. **Deploy the function:** `npm run build:functions -- mine`, then
   `npx supabase functions deploy mine --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`.
   *Check it worked:* `curl -s -X POST https://zqzhetlzvtptnkmeiumi.supabase.co/functions/v1/mine -H 'content-type: application/json' -d '{"action":"start"}'` answers a 401 JSON message ("Please sign in again."), not a crash or a 404. Only deploy other functions if the branch really changed them, and say so.
4. **Check from outside.** Signed out and as a pupil: `mine_runs`, `mine_bests` and `mine_questions` are closed (error 42501 when read directly); `mine_load_run`, `mine_claim_answer`, `record_mine_run`, `mine_runs_today`, `mine_store_run` and the `mine_*` hooks can't be called by a pupil (42501); `my_mine()` and `mine_board('l1', true)` answer a signed-in pupil with their own and their own school's rows only; a signed-out visitor gets 42501. Older data untouched.
5. **Merge to `main`** (only when James says). Merge `origin/main` into `mine` one last time, set `ON = true` in `src/games/mine/switch.ts` as part of this merge (the card still hides until the teacher switch is on), then either open a pull request for James (he has merged from his phone) or push `mine:main` only if he says so. Watch "Test and publish" go green.
6. **Try it live as a teacher** while pupils' switch is off: open `/#/mine` signed in as James's teacher account. Fly Greenstone Hollow and Otago Diggings with maths on, answer a question door right and wrong (wrong costs 20 shield and 6 seconds), try a pad, finish a mine, check the time appears on the school board and in "Your best", try Practice, try hard mode, switch maths off in the Mine Runner panel on the Teacher page and check the question doors are open, and check the panel's game switch. Check the points show on James's progress page and the achievements appear after the Mine Runner switch is on. Try it on James's phone too (touch sticks, aim, the aim assist at the reactor shaft).
7. **Switch it on for pupils** (only with James's OK): Teacher page, Mine Runner panel, **Switch Mine Runner on** for the class. Set the maths switch as James likes (default "Students choose"). Watch the first lesson: the function logs in the Supabase dashboard (look for errors, not names) and the request count.
8. **Write it down:** a "went live" note in `docs/MINE-PLAN.md` (what was applied, deployed and checked, when), update the memory note, and **stop for James's feedback**.

## How to turn it off again (gentlest first)
- **The teacher switch** (Teacher page, Mine Runner panel, **Switch Mine Runner off**). Pupils don't see the card, the function refuses to start any dive, nothing is deleted. (Don't use `update public.app_settings set mine_enabled = false where id;`: `app_settings` has one row per class now.)
- **Maths only:** the same panel, maths **Off**: question doors open, pads do nothing, separate "without maths" boards.
- **The code switch:** set `ON = false` in `src/games/mine/switch.ts` and publish: the game is gone from the build.
- **The function:** delete `mine` in the Supabase dashboard: everything that needs the server stops (pupils can still fly Practice).
- **Database:** never drop the tables. If something must change, write a new migration.

## Known edges to mention to James
- A New Season clears Mine Runner's times, saved runs and achievements for the school (through the hooks).
- Recorded runs are kept for 7 days (best runs for ever); question lists for 2 days.
- Daily cap 20 saved runs a pupil. If every door's six questions are wrong the pupil starts the mine again.
- Medal times come from the pretend pilot and may need retuning after real pupils play.
