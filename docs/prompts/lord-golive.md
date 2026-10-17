# Dragon Maths, going live with saving (after stage L.4)

You are continuing **Dragon Maths** in James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things stand
- **L.0 to L.4 are built and tested** on branch `dragon-maths` (worktree `~/projects/school-games-hub-dragon-maths`; never push or merge to `main` without James saying so; the branch's upstream is `origin/main`, so use `git push origin dragon-maths:dragon-maths` if a push is wanted, never a bare `git push`). Read `docs/LORD-PLAN.md` "L.4 results" first.
- **Nothing is live.** The migration `supabase/migrations/20261018001600_dragon_maths.sql` is written and tested on a scratch copy but NOT applied. The `lord` function (`supabase/functions/lord/index.ts`) is built but NOT deployed. `DRAGON_MATHS_ON` in `src/games/registry.ts` is `false`, so there is no card on the dashboard, and the teacher's switch (`lord_enabled`) is OFF until a teacher turns it on.
- The hidden page `/#/dragon-maths` talks to the real server once the two live steps are done; before that it shows "can't connect".
- Don't start L.5 (arena, computer heroes, daily news, warriors list, points, achievements, the teacher page) until James has tried it with real saving.

## Rules
- **Applying the migration, deploying the function and merging to `main` all touch the live site. Only do them if James says so in this session.** Ask once, plainly, before the first live step, and say exactly what will happen.
- Before anything live: merge `origin/main` into `dragon-maths`, then `npx tsc --noEmit`, `npx vitest run`, `npm run build`. The two known failures are the flaky chess-bot test and the generated `supabase/functions/monster/index.ts` being out of date: say so, and don't fix them in this branch.
- **Migration order.** Check `supabase/migrations/` on `main` and in the other worktrees. This one is `20261018001600`; if another migration now has that number or a later one that changes `app_settings`, `teacher_students` or `progress_counts`, renumber this one after it. It only adds new tables and functions and three columns on `app_settings`, so it should not clash.
- **Run the SQL tests first.** If the local Supabase copy can be used without disturbing another session, `npm run test:db`. The scratch recipe (used for L.4) is: put `begin;`, the migration, then the test file (without its own `begin;`) into one script, run it with `docker exec -i supabase_db_school-games-hub psql -U postgres -t -A < script.sql`, and look for `not ok` lines. It rolls back, so it leaves the shared local database as it was.

## The steps (stop and ask James before each live one)
1. **Pre-flight (no live changes):** merge main, run the checks, check migration numbers, tell James the plan in plain words.
2. **Apply the migration** to the live database (the way the others were: paste `supabase/migrations/20261018001600_dragon_maths.sql` into the Supabase **SQL Editor** and click **Run**, or `npx supabase db query --linked -f supabase/migrations/20261018001600_dragon_maths.sql`). Then add its number to the `migration repair` note at the bottom of `docs/PLAN.md`.
3. **Deploy the function:** `npm run build:functions` would also rebuild `monster/index.ts` (leave that file alone: `git checkout supabase/functions/monster/index.ts` afterwards, or build only this one with `node scripts/build-lord.mjs`), then
   `npx supabase functions deploy lord --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`
4. **Check from outside:** the `lord` function answers 401 JSON without a sign-in; `lord_heroes`, `lord_fights`, `lord_events` and `lord_refusals` are closed to signed-out visitors and to students (42501); `my_lord()` works for a signed-in test student and says the game is off.
5. **Try it as a teacher (the switch is still off for pupils):** open `/#/dragon-maths` signed in as James's teacher account (teachers can play while the switch is off). Pick a class, take forest fights, win and lose one, reload mid-fight (the same fight comes back, no extra fight used), try the shop, healer, bank, inn, a master. (The live game has no test tools, so the dragon needs level 12 there; try it in the browser trial, `npm run lord:preview`, which runs the same rules.) Check the teacher page's maths view shows the new answers.
6. **Only then**, with James's OK, switch it on for pupils: in the SQL Editor run `update public.app_settings set lord_enabled = true, lord_season_start = (now() at time zone 'Pacific/Auckland')::date where id;` (`teacher_set_lord()` does the same from a teacher's signed-in session, which the L.5 teacher page will use). Set `lord_forest_per_day` and the first season date as he likes. (The dashboard card stays off until L.5 sets `DRAGON_MATHS_ON`; pupils can use the page by its address.)
7. Add a short "Stage L.4 went live" note to `docs/LORD-PLAN.md` (what was applied and deployed, when, what was checked), update the memory note, and **stop for James's feedback**.

## How to turn it off again
`update public.app_settings set lord_enabled = false where id;` (heroes are kept; pupils see "the village gates are closed"). To remove the function: delete `lord` in the Supabase dashboard.
