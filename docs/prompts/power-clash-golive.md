# Power Clash, Stage P.7: go live and class trial

You are continuing work on **Tic-Tac-Toe: Power Clash** in the School Games Hub (~/projects/school-games-hub, GitHub bleedingrobot/school-games-hub). James is a primary-school teacher; the players are 8–10 year olds on Chromebooks. Reply to James in plain, simple words (no jargon, paths or hashes unless he asks).

## Where things stand
- **P.1–P.6 done**, feature complete, on branch `power-clash` (last commit "Power Clash P.6", pushed), worktree `~/projects/school-games-hub-power-clash`. Read `docs/POWER-CLASH-PLAN.md` sections 11–14 first (14 = P.6 results, which ends with the go-live list).
- **Nothing is live.** Three migrations (`20261017001500`, `001600`, `001700`) are written and tested in a scratch database but NOT applied. The functions `save-bot-game` and `power-clash` are built but NOT deployed. `POWER_CLASH_ON` in `src/games/registry.ts` is `false`.
- Chaos Mode is only on the one-screen and bot games, by design (classmates would need a new migration).
- Other sessions use the main checkout and the Gem Keep, monsters and space-maths worktrees: don't touch those. Never use bare `git stash`. Careful with `pkill -f` (it can kill your own shell).

## Rules for this stage
- **Applying migrations, deploying functions and merging to main all touch the live site. Only do them if James says so in this session** (he needs to be out of auto mode). Ask once, plainly, before the first live step, and say exactly what will happen.
- Before anything live: merge `main` into `power-clash` and re-run `npx tsc --noEmit`, `npx vitest run` (known flaky: Gem Keep `levels.test.ts`, chess "medium beats easy", and a few tests that only fail under whole-suite load; re-run those alone) and `npm run build:functions`.
- **Migration order matters.** Check the migrations folder on main and in the other worktrees. If the `space-maths` migrations are not on the live database yet, they must go first (they would overwrite `progress_counts()` otherwise). If any migration on main now has a number at or above `001500`, renumber Power Clash's after it. If a later migration changed `score_bot_game`, `progress_counts` or `progress_rules`, merge the Power Clash lines into those instead of overwriting.
- Run the SQL tests (`npm run test:db`, or the scratch-database recipe in plan section 12) before applying, and say which failures belong to the `space-maths` branch rather than Power Clash.

## Do (in order, stopping to ask James before each live step)
1. **Pre-flight (no live changes):** merge main, run all checks above, list the migrations still to apply and the functions to deploy, and tell James the plan in plain words.
2. **With James's OK:** apply the three migrations in order to the live database; deploy `save-bot-game` and `power-clash` (`npx supabase functions deploy power-clash --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`, and the same for `save-bot-game`).
3. **Check from outside** as the 101 launch did: the `power-clash` function answers 401 JSON without sign-in; `power_games` is closed to signed-out visitors (42501); `save-bot-game` still saves the other games.
4. **Switch on:** set `POWER_CLASH_ON` to `true`, build, merge to main, deploy the site (as the other games were), and check the card shows on the dashboard and the game opens signed in.
5. **One real game between two accounts** (James or a test student on two devices): join by code, pick powers, play a round with each of the eight powers if possible, rematch. This is the first proof of live updates and presence outside SQL. If James can't do it now, say so clearly and keep the card on only if he agrees.
6. **Class trial notes:** write a one-page "how to run the trial" for James in `docs/POWER-CLASH-PLAN.md` (a new section 15): what to watch for (is Medium too hard, is Chaos Mode too wild, is Time Heist fair, do turns feel too slow or too fast, any confusion about Portal Chaos or Force Field), the knobs if something is off (`MEDIUM_SLIP`, `MEDIUM_MAX_DEPTH`, `MEDIUM_POWERS` in `bot.ts`; `CHAOS_EVERY` in `engine.ts`; `TURN_MS` in `live.ts`), and how to turn the card off again (`POWER_CLASH_ON`, redeploy).
7. Add a "Stage P.7 results" section (what was applied and deployed and when, what was checked, what is still untested), update the Power Clash line in `docs/PLAN.md`, commit and push.

## Then
Tell James in simple words what is live and what isn't, and what he should try with his class first. **Stop for his feedback.** After the class trial, the open ideas are: Chaos Mode against classmates (needs a migration for a mode flag, lobby and Rematch rule), a Time Heist badge (needs a new achievement measure and migration), and tuning from what the children actually do.
