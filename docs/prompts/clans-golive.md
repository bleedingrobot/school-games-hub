# Prompt: Clan Quest, going live (after stage C.7)

Paste everything below the line into a new chat to start the go-live.

---
You are continuing **Clan Quest** in James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Step 0: quick check (1 minute)

Ask James, in plain words, whether he has changed or applied anything since C.7 (James tried the C.7 test page and said everything looks good on 18 Oct 2026), and which live steps he wants to do today. Then do **step 1 only** (pre-flight, nothing live) and stop for his word before step 2.

## Where things stand
- **C.0 to C.7 are built and tested** on branch `clans` (worktree `~/projects/school-games-hub-clans`; never push or merge to `main` without James saying so). Read `docs/CLANS-PLAN.md` "Stage C.6, part B results" and "Stage C.7 results" first, then `docs/CLANS-TEACHER-GUIDE.md`.
- **Nothing is live.** Four migrations are written and tested in a rolled-back transaction but NOT applied, and they must go in this order: `20261018001800_clans.sql` (clans, saving), `20261018001900_clans_fights.sql` (mine fights, the midnight job, the teacher's switch `clans_enabled`), `20261018002000_clans_village.sql` (village, news, classmate raids, groups, the raids switch `clan_raids_enabled`) and `20261018002100_clans_rewards.sql` (fame, points, achievements, scoreboard, maths settings and records; it also redoes `progress_counts`, `progress_rules`, `rebuild_progress`, `my_progress`, `teacher_students` and `teacher_new_season` on top of Dragon Maths' versions). The `clans` function (`supabase/functions/clans/index.ts`) is built but NOT deployed.
- **Dragon Maths comes first.** Its migrations `20261018001600` and `20261018001700` must already be live (the Dragon Maths branch says they were applied on 18 Oct 2026; check with step 1 below, don't assume). If either is missing, stop and tell James.
- `CLAN_QUEST_ON` in `src/games/registry.ts` is already `true`, so once the site is deployed the card shows, but **it hides itself while the teacher's switch (`clans_enabled`) is off**, and the switch starts off. Classmate raids have their own switch (`clan_raids_enabled`), also off.
- Teachers can always open `#/clan-quest` to try it, even while it is off.

## Rules
- **Applying a migration, deploying the function, merging to `main` and switching things on all touch the live site. Only do each one if James says so, in words, in this session.** Ask once, plainly, before the first live step, and say exactly what will happen. Approval for one step is not approval for the next.
- Before anything live: merge `origin/main` into `clans` (the branch is a few commits behind), then run `npx tsc --noEmit`, `npx vitest run` (about four minutes; a few fight, gem-keep and 101 tests can time out when the computer is busy and pass alone: run them again with `--testTimeout=30000`) and `npm run build`. Say plainly about any other failure; don't hide it.
- **Check migration numbers.** Look at `supabase/migrations/` on `main` and in the other worktrees. If something newer than `20261018002100` has arrived that changes `app_settings`, `teacher_students`, `progress_counts`, `progress_rules`, `rebuild_progress`, `my_progress` or `teacher_new_season`, merge its changes into the `20261018002100` versions before applying, and renumber after it if needed.
- **Never `supabase db reset`** (other sessions share the local database).

## The steps (stop and ask James before each live one)
1. **Pre-flight (nothing live changes).** Merge main, run the checks above, and run the database checks in a rolled-back transaction on the local database: put `begin;`, then `20261018001600` and `20261018001700` (the local database only goes up to `20261018001500`), then the four clans migrations, then one test file from `supabase/tests/database/` (`clans.test.sql`, `clans_fights.test.sql`, `clans_village.test.sql`, `clans_rewards.test.sql`, without its own `begin;`), into
   `docker exec -i supabase_db_school-games-hub psql -U postgres -t -A`
   and look for `not ok` lines (there should be none; the file's own `rollback` leaves the shared database as it was). Check the live database has Dragon Maths: in the Supabase **SQL Editor** run `select to_regclass('public.lord_heroes'), to_regclass('public.lord_news');` (both should come back with a name, not empty). Tell James the plan in plain words.
2. **Apply the four migrations** to the live database, in order: paste each of the four files into the Supabase **SQL Editor** and click **Run**, or `npx supabase db query --linked -f <file>`. Then add the four numbers to the `migration repair` note at the bottom of `docs/PLAN.md`.
   *Check it worked:* `select count(*) from public.clans;` is 0 (no error); `select clans_enabled, clan_raids_enabled from public.app_settings;` is `false, false`; `select count(*) from public.achievement_types where game = 'clan-quest';` is 8.
3. **Deploy the function.** Build only this one with `node scripts/build-clans.mjs` (`npm run build:functions` also rewrites `monster/index.ts`, which must be left alone; if it changed, `git checkout supabase/functions/monster/index.ts`), then
   `npx supabase functions deploy clans --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`
   *Check it worked:* `curl -s -X POST https://zqzhetlzvtptnkmeiumi.supabase.co/functions/v1/clans -H 'content-type: application/json' -d '{"type":"load"}'` answers a 401 JSON message (it needs a sign-in), not a crash or a 404.
4. **Check from outside.** The tables `clans`, `clan_requests`, `clan_fights`, `clan_villages`, `clan_news`, `clan_scores` (and the rest the migrations made) are closed to signed-out visitors and to students (error 42501 when read directly); `clan_scoreboard()` answers a signed-in student with clan names and fame only; `clan_extras(player)` is closed to students; the 199+ older scored games were untouched (`select count(*) from public.scored_games;` is not smaller than before).
5. **Merge to `main`** (only when James says). Then deploy the website the usual way (it goes out with the other games). Until the teacher's switch is on, the dashboard card stays hidden.
6. **Try it as a teacher (the switch is still off for pupils).** Open `/#/clan-quest` signed in as James's teacher account. Make a clan. Take mine fights (win one, lose one, reload in the middle of a fight: the same fight comes back and no extra fight is used). Try the Market, Training Hall, Church, Empire, a Quest, the Village (give gold, vote), How to play, the Scoreboard and Achievements. On the Teacher view check the **Clan Quest** panels (the switch, maths settings, fame season, villages, the raids switch) and that your own clan shows on the teacher's pupil page.
7. **Switch it on for pupils** (only with James's OK): Teacher view, Clan Quest panel, **Switch Clan Quest on**. The card appears on every pupil's home page. Set the maths year band, the topics and the mine fights a day as James likes.
8. **Make groups** (optional, James decides): in the **Clan Quest villages** panel make a group such as "Room 12" and move the pupils into it. Until then everyone is in one village called **Everyone else**.
9. **Switch classmate raids on** (only with James's OK, and only after he has watched the class use the game for a few days): the **Raids** switch in the villages panel.
10. Add a short "Clan Quest went live" note to `docs/CLANS-PLAN.md` (what was applied and deployed, when, what was checked), update the memory note, and **stop for James's feedback**.

## How to turn it off again
- **Raids only:** the Raids switch in the villages panel (or `update public.app_settings set clan_raids_enabled = false where id;`). The server refuses every classmate raid straight away.
- **The whole game:** the Clan Quest switch on the Teacher view (or `update public.app_settings set clans_enabled = false where id;`). Clans are kept; pupils see "Clan Quest isn't switched on yet"; the card disappears. The midnight job still gives clans their night's rest.
- **To remove the function:** delete `clans` in the Supabase dashboard.
- **Fame after a bad day:** the Clan Quest fame season button sets every clan's fame back to 0 (clans, gold, levels and achievements stay). Points only: the school-wide *new points season* clears Clan Quest's points and leaves fame alone.
- **One pupil starting again:** Teacher view, the pupil, Clan Quest, **Reset this clan…**.
