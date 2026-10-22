# Prompt: Star Trader stage T.4 (the school's shared market and news)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-trader`.

---

You are continuing **Star Trader** for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks. He decides every live step.

**The game:** Star Trader, short id `trader`, branch `trader`, folder `~/projects/school-games-hub-trader` (it already exists; do not make a new one). CSS prefix `.st-`.
**Where it is:** T.0 to T.3 are built and pushed on branch `trader`. **Nothing is applied, deployed, merged or switched on.** The hub card is behind a code switch that is `false`. Your job is **stage T.4**.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. `cd ~/projects/school-games-hub-trader`, `git status` (should be clean), `git fetch`, and **merge `origin/main` into `trader`** (don't rebase). Then `node scripts/migration-numbers.mjs` and write the next free number in the plan. Stage T.3's migration is `20261022001000_trader.sql`: it is **not on `main` or live**, so never edit it once it is applied; T.4 gets its own new migration file.
3. Read `docs/TRADER-PLAN.md` in full. It is long; the parts that win over the older sections are **14 (the revision against the guide), 15 (rule sheet and request estimate), 16 (engine and simulator), 18 (screens), 19 (saving, T.3 results)**. Section 8 is the shared-market idea this stage builds. Section 13 and the "James's answers" in 14 are his decisions.
4. Read the T.3 code you will build on: `shared/trader/server.ts` (the rules the server runs, also run by the screens), `shared/trader/market.ts` (prices today come from the galaxy, the day and the planet only), `supabase/functions/trader/handler.ts`, `supabase/migrations/20261022001000_trader.sql`, `src/games/trader/TraderGame.tsx` and `trialBackend.ts` (the preview runs the real handler against a pretend database in the browser). Note: the landing prices are **already** saved in the pupil's game (`market` in `shared/trader/state.ts`, set by `marketFor` when they start, jump or start a new day), so "price fixed when they land" is there; the work is passing the school's push into those `marketFor` calls (and into `bot.ts` / `sim.ts`).

## What James has already decided (don't re-ask)
- **One market for the whole school** (his school only: `school_id` on everything; pupils never see another school).
- Prices drift back to normal overnight. **One pupil's trades can move a price by at most 20% a day at one planet, and a price can't move more than 50% from normal in a day**, however many pupils trade. These two numbers are guesses to be tuned (they live in `shared/trader/config.ts`).
- **A pupil's price is fixed when they land.** They trade at the prices they saw; the market moves after they leave.
- The news explains it in words ("Lots of traders sold Water on Mars: it's cheap there today") and **never names a pupil**.
- Many pupils may trade the same planet at once. Update each price **in one database step**, so no trade is lost or counted twice.
- Maths comes only from the pupil's shared focus (already built in T.3). **Don't change `shared/maths/`, `src/maths/`, `src/styles.css`, `src/components/`, `supabase/functions/_shared/`, other games' folders or functions, any migration already on `main`, or dependencies.**
- No new shared function is re-created; use `hub_games` hooks (the T.3 migration already registered `trader` for the switch, New Season and last played).
- Real planet names. Moon price 20,000. Jumps a day 10 (teacher can change 1–30). 5-week seasons are the pace target; the season ends with the hub's New Season button.

## Stage T.4: what to build
1. **A school-wide market.** New tables (closed to pupils, like every `trader_` table: row security on, no policy, no grant), named as in the plan's section 14: `trader_markets` (keyed by school, planet, good, with how far the price is pushed, how much it has moved today and the day it was last changed) and a small `trader_news`. Selling pushes a price down and buying pushes it up, by a set amount per unit. Keep the guard rails above, read like this:
   - **The 50% limit:** the pushed price stays within 50% above or below that day's base price.
   - **The 20% limit is per pupil**, so the server must remember how far each pupil has pushed each good at each planet today (a small per-pupil record, or inside their saved game; your choice, say which).
   - **Drift halfway back each day is worked out when the row is read** (from the day it was last changed), not by a nightly job.
   Put the numbers in `shared/trader/config.ts`.
   - **Stock** stays per pupil per visit, as it is now (each pupil sees the planet's full stock). Shared stock is a separate question for James; don't build it.
2. **The rules.** Prices a pupil sees on landing = today's base price (already in `shared/trader/market.ts`) pushed by the school's market. Make this a **pure function** of the base price and the push, in `shared/`, so the screens and the server agree. Their landing price is stored in their game for the visit.
3. **The server.** In the `trader` function, a trade changes the school's push **atomically** (one database function, `security definer`, server key only) and refuses nothing for the pupil if a limit is reached (the price just stops moving). A request sent twice still counts once. Keep marking, versions and request ids exactly as T.3 has them. The new pushed prices and the news come back **in the reply the pupil already gets** (load and jump), never as an extra request.
   **New Season:** T.3's `trader_season` must also clear the school's market and news. Do that with `create or replace function` in **your new migration** (don't edit the T.3 file), and keep the `hub_games` row as it is.
4. **The news.** Computer-written lines from the day's biggest moves and the base events ("A drought has dried things up, so Water is dear"), shown on the landing screen and the star chart card. Nobody is named.
5. **Simulate a busy lunchtime** (28 to 100 pupils trading at once, using the bot in `shared/trader/bot.ts` and the simulator in `shared/trader/sim.ts`; today `simulate()` plays one bot at a time, so add a mode where many bots share one market and take turns within each day) to tune the two price limits and the drift; report what you picked and why. Check the moon-day numbers from stage T.1 still look right (careful bot about day 14, sloppy about 17).
6. **Measure requests.** Count what a pupil's day now costs, and write the number against `docs/SERVER-LOAD-PLAN.md`'s rules (fewer requests, not faster ones; a whole class pressing the same button at once is the danger).
7. **Screens.** The market shows the pushed prices and the news line; the preview's pretend database runs the same new rules.

## Rules for the work
- Branch `trader` only. Never commit to `main`, never `supabase db reset`, never a bare `git push` (push by name: `git push origin trader`).
- Test migrations on a throw-away copy: `scripts/scratch-db.sh trader` then `scripts/scratch-test.sh trader supabase/tests/database/trader*.test.sql` (and `game_hooks`, `security`), then drop the copy. Add a pgTAP file for the new tables and functions (pupils get `42501` on every new table and function; a trade counts once; the limits hold; a New Season clears the school's market). Update `supabase/tests/database/security.test.sql` only if you add a function pupils can call.
- Rebuild only your function: `npm run build:functions -- trader`. Keep the "index.ts is up to date" test passing.
- Before saying the stage is done: `npm run typecheck`, `npm run test:all`, `npm run build`, and your database tests on a scratch copy. Say plainly about any failure.
- Write a **"Stage T.4 results"** section at the end of `docs/TRADER-PLAN.md` (what you built, numbers chosen and why, tests, what is untested, the go-live list), update the memory note `star_trader_plan.md`, commit with the attribution line, and `git push origin trader`.
- **Nothing live** (applying a migration, deploying a function, merging to `main`, setting the code switch to `true`, switching the game on for a class) unless James says so in words in this session, one step at a time. Live deploys are blocked in auto mode; he has to leave auto mode first.
- Republish the preview so James can try it: `TRADER_INLINE=1 npx vite build --config vite.trader-preview.config.ts && node scripts/inline-monsters-preview.mjs dist-preview-trader star-trader-test-page.html`, then publish as a private Artifact (the earlier one is https://claude.ai/artifact/HmwsFd6Eph9D7YDPLZMtYo; update it). The preview page wraps the built script and styles in a small fragment with a `<title>`; look at how it was done before.

When you stop, tell James in plain words what is ready, what he can try (the preview link), and what he needs to decide (for example the two price limits, if the simulation shows they should move). Then **stop**; don't start T.5 (contracts, beacons, the school station, quests, points, achievements and the board) until he says.
