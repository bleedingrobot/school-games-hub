# Dragon Maths, shipping branch `dragon-art` (art, hero looks, L.6, topic switches)

Reply to James in plain, simple words. **Every live step needs James's yes in this session, one step at a time** (guide section 8).

## Status (26 Oct 2026)
Done: the subitising test fix (PR #20, merged; main published green), pre-flight, **step 1 (migration applied)** and **step 2 (`lord` deployed)**, and the branch pushed with a pull request open. Left: James merges the pull request (step 3), then step 4 (try it live) and step 5.

## What goes out (checked 26 Oct 2026)
Branch `dragon-art` (worktree `~/projects/school-games-hub-dragon-art`, not pushed) is 29 commits ahead of `origin/main` and already has all of `main` in it. It holds:
- Everything from `dragon-maths` that never went live: **L.6** (How to play, Hint button, letter-key switch) and the **teacher topic switches** (migration `20261019001100_lord_topics.sql`, the tick-list on the teacher page).
- The painted art (the gritty set, map v2, 120 monsters, masters, people, the dragon), the **120 hero looks** (new `look` action in the `lord` function; saved inside the hero's JSON, so no migration of its own), and the phone fixes.

Read-only checks of the live project on 26 Oct 2026:
- `app_settings.lord_topics` **does not exist** yet, so the migration is needed.
- The deployed `lord` function has **no hints, topics or looks**, so it needs redeploying.
- The live `lord_settings(player uuid)` and `teacher_set_lord(settings jsonb, target_class uuid)` have the same arguments as the migration's versions, and no later migration on `main` touches them, so `create or replace` is safe. The migration already uses `settings_to_change(target_class)` (one settings row per class).

## Blocker (fixed: PR #20, merged 26 Oct 2026)
`src/subitising/saving.test.ts` ("is something the server accepts") fixes `day: '2026-10-21'` but sets `at: Date.now()`. The server rightly refuses a day more than 1 from `at`, so the test has failed since about 23 Oct, **on `main` too**. "Test and publish" runs every test, so the next publish fails whoever merges. Fix: work out `day` from `at` in the test. It belongs to Quick looks, so ask James where it goes (its own little branch/PR to `main` first, or a commit on `dragon-art`).

## Order: migration, then function, then website
The new function reads `topics` from `lord_settings()`, so the migration must be in first. The old website still works with the new function (`look` is optional, and hints are only sent by the new site), so the function can go out before the site publishes.

### 0. Pre-flight (nothing live)
```sh
cd ~/projects/school-games-hub-dragon-art
git fetch origin && git merge origin/main          # re-check the migration number if main gained any
npx tsc --noEmit -p .
npx vitest run src/games/lord shared/lord supabase/functions/lord   # 234 pass
npm run test:all                                   # on this machine the single big run gets SIGTERM; run it by folder if so
npm run build
node scripts/build-lord.mjs && git status --short supabase/functions/lord   # must show no change
```
SQL test on the local scratch database (rolls back; look for `not ok`): one script with `begin;`, the migration, then `supabase/tests/database/lord_topics.test.sql` without its own `begin;`, run with `docker exec -i supabase_db_school-games-hub psql -U postgres -t -A < script.sql`.

### 1. Apply the migration (live: ask first)
From the linked checkout (`~/projects/school-games-hub`, on `main`), pointing at the file in this worktree:
```sh
cd ~/projects/school-games-hub
npx supabase db query --linked -f ~/projects/school-games-hub-dragon-art/supabase/migrations/20261019001100_lord_topics.sql
```
Check: `select lord_topics from public.app_settings;` gives all eight topics on every row, and `select public.lord_settings();` includes `topics`. Add `20261019001100` to the `migration repair` note at the bottom of `docs/PLAN.md` (in the merge commit).

### 2. Deploy the `lord` function (live: ask first)
```sh
cd ~/projects/school-games-hub-dragon-art
npx supabase functions deploy lord --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api
curl -s -X POST https://zqzhetlzvtptnkmeiumi.supabase.co/functions/v1/lord   # expect a 401 JSON message, not 404 or a crash
```
Only `lord` changed on this branch. Don't deploy any other function.

### 3. Merge to `main` (live: ask first)
Once the subitising test is fixed and pre-flight is green again:
- **Pull request (James merges, e.g. from his phone):** `git push origin dragon-art:dragon-art`, then `gh pr create --base main --head dragon-art`.
- **Or straight to main, only if James says so:** `git push origin dragon-art:main`.

Never push from the main checkout. Then watch it publish: `gh run watch` on the "Test and publish" run (about 4 minutes).

### 4. Try it live
As the teacher, on a phone width and a laptop: choose a look for a new hero; an existing hero gets the "choose your look" nudge and Your hero → Change my look; the map places; a forest fight (name plates level); the shop (forge visible); How to play; a question with Hint; the topic tick-list on the Dragon Maths teacher panel (turn one off and on; at least one must stay on).

### 5. Write it down
A "went live" note in `docs/LORD-PLAN.md` (what was applied and deployed, when, what was checked), and update the memory note.

## Turning it off again
- The Dragon Maths switch on the Teacher page (gentlest; data kept).
- Topics back to all on: `update public.app_settings set lord_topics = '{place-value,add-sub,times-tables,division,fractions,decimals,money,patterns}';`
- Website: revert the merge commit on `main` (the art and looks go away; saved looks stay in the heroes' JSON, harmless).
- Function: redeploy `lord` from `main` after the revert. The migration only adds a column and is safe to leave.
