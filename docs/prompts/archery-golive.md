# Prompt: Archery Challenge, going live (after Stage 7, without Stage 8)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-archery` (branch `archery`).

---
You are continuing **Archery Challenge** (short id `archery`), Scorched Earth with archers, designed by James with one of his pupils, for his **School Games Hub** (games for his Year 4–6 class at Douglas Park School). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

**James (22 Oct 2026): go live without Stage 8** (the target challenge comes later, as its own stage after launch). Stage 6b (joining from the hub's main Lobby) is its own branch and not part of this.

## Step 0: quick check (1 minute)
Ask James, in plain words, whether he has changed or applied anything since Stage 7, whether he has tried the test page (https://claude.ai/artifact/NW2b62yAKr8HNxfKtqxtG3) and is happy with how it feels, and which live steps he wants to do today. Then do **step 1 only** (pre-flight, nothing live) and stop for his word before step 2.

## Where things stand
- **Stages 1 to 7 are built and tested** on branch `archery`. Read `docs/GAME_DEVELOPMENT_GUIDE.md` sections 8 and 9, then `docs/ARCHERY-PLAN.md`: "Decisions", and the "Stage 4 results" to "Stage 7 results" sections with James's answers (the go-live list is at the bottom of each).
- **Nothing is live.** Three migrations are written and tested on a scratch copy but NOT applied, and must go in this order:
  1. `20261021000300_archery.sql` (coins, gear, speed rounds, bot fights, the game's on/off switch, points hooks),
  2. `20261022000100_archery_classmates.sql` (classmate fights: `archery_duels` with Realtime and its pupil-read rule, `archery_here()`, the `tidy-archery-duels` pg_cron job),
  3. `20261022000200_archery_hub.sql` (the Classmate fights switch, achievement counts and the ten achievements, kept through a New Season, the teacher summary).
  The `archery` function (`supabase/functions/archery/index.ts`) is built but NOT deployed.
- The **code switch** is `ON = false` in `src/games/archery/switch.ts`, and the game is **not in `src/games/registry.ts`** yet. The **teacher switch** (`app_settings.archery_enabled`) starts off everywhere; **Classmate fights** (`app_settings.archery_duels`) starts on. The card shows only when the code switch and the teacher switch are both on.
- The migrations depend on `20261020000100_game_hooks.sql` (live since 20 Oct 2026), the shared maths functions (`space_maths_context`, `record_fact_answers`), `settings_of`, `require_settings_target`, `my_students`, `pg_cron` and the `supabase_realtime` publication. Check, don't assume (step 1).
- Requests: about 2,170 function requests per class lesson (plan section 9), about 47,000 a month at five lessons a week, against 500,000 on the free plan. "I'm here" goes straight to the database (about 2,000 small queries a class lesson).

## Rules
- **Applying a migration, deploying the function, merging to `main` and switching things on all touch the live site. Only do each one if James says so, in words, in this session.** Ask once, plainly, before each live step, and say exactly what will happen. Approval for one step is not approval for the next.
- Never `supabase db reset` (other sessions share the local database). Never a bare `git push` (use `git push origin archery`). Never push to `main` from this worktree unless James says to push `archery:main`.
- Build only your own function: `npm run build:functions -- archery`. If `supabase/functions/monster/index.ts` changes, `git checkout` it.
- Don't commit `dist-preview-archery/`.
- Say plainly about any failure; don't hide it.

## The steps (stop and ask James before each live one)
1. **Pre-flight (nothing live).**
   - `git fetch`, merge `origin/main` into `archery`. Run `node scripts/migration-numbers.mjs`. If any Archery migration number is now taken, or something newer than `20261022000200` has arrived on `main`, **renumber all three Archery files after it, keeping their order** (never rename a migration already on `main`; the Archery ones aren't). Check nothing shared is re-created by them (they only use the `hub_games` hooks, and replace their own functions).
   - Check the shared database tests still agree with the new `main`: `security.test.sql` (Archery adds `archery_here`, `teacher_set_archery`, `teacher_set_archery_duels`, `teacher_archery_summary` to the signed-in list, `archery_duels` to the readable tables and the Realtime list) and `progress_access.test.sql`'s achievement count (Archery adds 10; it was 93 on the branch, meaning 83 on `main` when Stage 7 was written). If other games added achievements since, add up again.
   - Run `npm run typecheck`, `npm run test:all` (about 3 minutes; a few busy-computer timeouts pass alone with `--testTimeout=30000`: say so) and `npm run build`.
   - Database checks on a scratch copy built from `main`'s migrations plus Archery's: `scripts/scratch-db.sh archery` then `scripts/scratch-test.sh archery` (all files). `clans_fights.test.sql` (the midnight job, twice) and `maths_focus_results.test.sql` ("the day counting began") already fail on any scratch copy and aren't Archery's; anything else failing needs fixing. Drop the copy after: `docker exec supabase_db_school-games-hub psql -U postgres -c 'drop database archery'`.
   - Check the live database has what Archery depends on, by asking it (Supabase SQL Editor, or `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi "<sql>"`):
     `select to_regclass('public.hub_games'), to_regclass('public.game_points'), to_regclass('public.achievement_measures');` (all a name);
     `select to_regprocedure('public.space_maths_context(uuid)'), to_regprocedure('public.add_game_points(uuid,text,integer,text)'), to_regprocedure('public.game_progress_changed(uuid,text)'), to_regprocedure('public.settings_of(uuid)'), to_regprocedure('public.require_settings_target(uuid)');` (all a name; if a signature differs, look it up rather than guessing);
     `select count(*) from cron.job;` (works: pg_cron is there) and `select count(*) from pg_publication where pubname = 'supabase_realtime';` (1).
     And that nothing Archery is there already: `select to_regclass('public.archery_players');` (empty). If any check is off, stop and tell James.
   - Write down `select count(*) from public.scored_games;` and `select count(*) from public.achievements;` (to compare after step 2).
   - Tell James the plan in plain words.
2. **Apply the migrations** to the live database, in order, each with `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/<file>` (or paste each into the SQL Editor). Add the three numbers to the `migration repair` note at the bottom of `docs/PLAN.md`.
   *Check it worked:* `select count(*) from public.archery_players;` is 0; `select distinct archery_enabled from public.app_settings;` is `false` only; `select distinct archery_duels from public.app_settings;` is `true` only; `select counts_fn, players_fn, keep_achievements from public.hub_games where id = 'archery';` has both hooks and `true`; `select count(*) from public.achievement_types where game = 'archery';` is 10; `select jobname from cron.job where jobname = 'tidy-archery-duels';` is one row; `select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'archery_duels';` is one row; `scored_games` and `achievements` aren't smaller than in step 1.
3. **Deploy the function:** `npm run build:functions -- archery`, then
   `npx supabase functions deploy archery --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`.
   *Check it worked:* `curl -s -X POST https://zqzhetlzvtptnkmeiumi.supabase.co/functions/v1/archery -H 'content-type: application/json' -d '{"action":"load"}'` answers a 401 JSON message ("Please sign in again."), not a crash or a 404. Only deploy other functions if the branch really changed them, and say so (it shouldn't have).
4. **Check from outside.** Signed out and as a pupil: `archery_players`, `archery_requests`, `archery_rounds`, `archery_fights` and `archery_here` are closed (42501 read directly); a pupil reads only their own rows of `archery_duels` (none yet); every server step (`archery_state`, `archery_shop`, `archery_round_*`, `archery_fight_*`, `archery_duel_*`, `archery_note`, `archery_counts`) refuses a pupil (42501); `archery_here()` answers a signed-in pupil with `{"off": true}` while the game is off; `teacher_archery_summary()` and `teacher_set_archery_duels()` refuse a pupil; a signed-out visitor gets 42501 everywhere. Older data untouched.
5. **Merge to `main`** (only when James says). First, on the branch, the merge-step edits (each a small addition, see plan section 11): append `archeryChallenge` to the end of `GAMES` in `src/games/registry.ts` behind `archeryOn()`; add `'archery'` to the end of `FUNCTIONS` in `scripts/build-functions.mjs`; add `archery:sim`, `archery:preview`, `archery:single`, `archery:determinism` to the end of `package.json`'s scripts (no new dependencies); `dist-preview-archery/` to `.gitignore`; Archery's lines in `shared/README.md`; and in `docs/PRIVACY-SUMMARY.md`: coins, gear, bows and best scores per pupil (wiped by New Season), speed-round questions and answers (kept 2 days; answers go to the maths records like other games'), bot fights, "who's here" (the last time each pupil had the game open, kept a day), classmate fights (both players' display names, packs and turns, seen by those two only, kept 30 days), achievement counts (numbers only, wiped by New Season while the badges stay) and the teacher's class summary (counts only, the teacher's own pupils). Then merge `origin/main` into `archery` one last time, set `ON = true` in `src/games/archery/switch.ts` (the card still hides until the teacher switch is on), run the tests again, and either open a pull request for James (he has merged from his phone) or push `archery:main` only if he says so. Watch "Test and publish" go green.
6. **Try it live as a teacher** while pupils' switch is off: open `/#/archery` signed in as James's teacher account. Do a speed round (coins come in), buy something in the Armory, pack, fight a bot to the end (points, best score, gear back), and check the Archery panel on the Teacher page: both switches and the "This week" box for his class. **Then a classmate fight on two real devices** with two pupil test accounts in the same class (James's call which accounts), with the game switched on for that class only while trying it: challenge, accept, pack, play some turns, let a turn run out, then switch **Classmate fights off** on the Teacher page part-way and check both screens say the fight stopped and the arrows came back. Check Realtime keeps both screens in step on school Wi-Fi and the turn clock feels fair. Switch the class back off afterwards if pupils aren't starting yet.
7. **Switch it on for pupils** (only with James's OK): Teacher page, Archery Challenge panel, **Switch Archery Challenge on** for the class (Classmate fights is already on; James may want it off for the first lesson). Watch the first lesson: the function logs in the Supabase dashboard (errors, never names) and the request count.
8. **Write it down:** a "went live" note in `docs/ARCHERY-PLAN.md` (what was applied, deployed and checked, when), update the memory note, and **stop for James's feedback**. Stage 8 (the target challenge) is the next stage after launch, only when James asks.

## How to turn it off again (gentlest first)
- **Classmate fights only:** Teacher page, Archery Challenge panel, **Switch classmate fights off**. Open fights stop fairly (arrows back, no points); bot fights carry on.
- **The teacher switch:** the same panel, **Switch Archery Challenge off**. Pupils don't see the card, the function refuses everything except ending a classmate fight fairly, nothing is deleted. (Don't use `update public.app_settings set … where id;`: `app_settings` has one row per class now.)
- **The code switch:** set `ON = false` in `src/games/archery/switch.ts` and publish: the game is gone from the build.
- **The function:** delete `archery` in the Supabase dashboard: everything that needs the server stops.
- **Database:** never drop the tables. If something must change, write a new migration.

## Known edges to mention to James
- A New Season wipes everyone's coins, gear, bows, best scores and achievement counts, but **the badges stay** (James, 22 Oct 2026).
- 8 coin-earning speed rounds a day, then practice rounds (maths recorded, no coins). A perfect round only counts in a coin round.
- Classmate fights are one round; a fight someone leaves gives nobody points; packs can be seen with developer tools (James OK'd this).
- No real Chromebook has been tried yet: the slow-machine numbers are from a slowed headless browser (plan, Stage 7 results). If it's slow in class, "Simpler graphics" is in the fight's settings, and it also switches down by itself.
