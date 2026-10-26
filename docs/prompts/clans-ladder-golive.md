# Prompt: Clan Quest Battle Cry from the ladder, going live

Paste everything below the line into a new chat to start the go-live.

---
You are continuing **Clan Quest** in James's School Games Hub (games for his Year 4-6 class). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things stand
- Branch `clans-ladder` (worktree `~/projects/school-games-hub-clans-ladder`, made from `origin/main` 2343351, no upstream set: push with `git push -u origin clans-ladder`, never a bare `git push`) makes the Battle Cry ask each child a question from their own maths focus or ladder place, and counts the answers. Read `docs/CLANS-PLAN.md` "Battle Cry from the ladder" first.
- **Nothing is live.** Three live pieces, in this order: the migration `20261020000300_clans_ladder.sql`, the `clans` function, then the website (merge the PR).
- Every order is safe on its own: the server only makes ladder fights for a page that asks (`fightStart { ladder: true }`), and fights that are already open finish the old way. But the **website must go last**: the new page needs the migration and the new function.
- Already live separately (20 Oct 2026): the class's Clan Quest topics were set to money and area only. That stays the setting for quests and the shop.

## Rules
- **Applying the migration, deploying the function and merging the PR each touch the live site. Only do each one when James says so, in words, in this session.** Say exactly what will happen first. Approval for one step is not approval for the next.
- Never `supabase db reset`. Use a scratch copy for database tests (`scripts/scratch-db.sh <name>`, `scripts/scratch-test.sh <name> <file>`, then drop it).

## The steps
1. **Pre-flight (nothing live).** `git fetch`, merge `origin/main` into `clans-ladder`. Run `node scripts/migration-numbers.mjs`: if `20261020000300` is taken or something newer arrived, rename the file to the next free number. If anything newer re-creates `load_clan` or `save_clan`, rebuild the migration's copies from that newer version and keep only the changes marked by `questions` and `marks`. Check the live functions still match what the migration starts from: compare `pg_get_functiondef('public.load_clan'::regproc)` and `save_clan` on live with `20261018002600_clans_schools_and_classes.sql` (they were the same on 20 Oct). Run `npm run typecheck`, `npm run test:all`, `npm run build`, `npm run build:functions -- clans marble` (check `git status`: `marble/index.ts` should not change), and `supabase/tests/database/clans_ladder.test.sql` plus the other `clans*.test.sql` files on a scratch copy. In `clans_fights.test.sql`, the two "scheduled for midnight" checks fail on any scratch copy because it has no real scheduler. Ignore those two only. Also check that the live `clans` function matches `origin/main`'s build (download it with `npx supabase functions download clans --project-ref zqzhetlzvtptnkmeiumi` and compare), so the deploy only brings this change. Tell James the results in plain words.
2. **Apply the migration** (James's yes): `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/20261020000300_clans_ladder.sql`. *Check:* `select column_name from information_schema.columns where table_name = 'clan_fights' and column_name in ('questions','marks');` gives both. Load a pupil's clan through the game (or `select public.load_clan(...)` for a test account) to check it still opens.
3. **Deploy the function** (James's yes): `npx supabase functions deploy clans --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. *Check:* an unsigned POST gives 401. The live copy matches the branch build. Children notice nothing yet.
4. **Website** (James's yes): push the branch, open a PR to `main`, let James merge it (or merge on his word), and watch Test and publish go green.
5. **Try it** as James's teacher account: start a mine fight. The Battle Cry should be a ladder question in the question box. Answer one right (pick a power-up), one wrong (the right answer shows) and press "No thanks" once. Reload mid-fight: the same fight and log come back. Then check the answers reached the records: `select key, attempts from public.fact_stats where player = '<teacher id>' order by updated_at desc limit 5;` (or the skill map).
6. **After a school day:** check the `clans` function logs for errors (`clans: maths records failed`, `clans: record answers failed`), check that children's ladder records grew from Clan Quest, and compare the request count with the server-load numbers (each Battle Cry answered is one extra request).
7. Add a "went live" note to `docs/CLANS-PLAN.md`, update the memory note, and stop for James's feedback.

**Rollback:** revert the PR (the old page sends no `ladder` flag, so the server plays old-style fights). The migration's columns can stay. They're empty for old-style fights.
