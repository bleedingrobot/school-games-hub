# Prompt: Sky Isles S.4, the class sky (classmates)

Paste everything below the line into a new Claude session opened in `~/games-hub-isles`. Run it **after** "race questions during the race" (pushed 2 Nov 2026, commit 245f841).

---

You are continuing **Sky Isles** (short id `isles`) for James's **School Games Hub**. James teaches Years 4–6 at Douglas Park School. Sky Isles is an **original** kingdom-building maths game: each pupil grows a floating island in a sky shared by the class. Reply to James in plain, simple words, without jargon, file paths or commit hashes unless he asks. Use Haiku helper agents for quick, simple jobs and Sonnet helpers for jobs that need judgement (looking at screenshots, checking or fixing tests, reviews). There's no need to ask first. **Always ask James questions on clickable cards** (the AskUserQuestion tool, recommended option first).

**This session is stage S.4: the class sky.** Pupils now meet their classmates: Sky Races against a classmate's island, friendship ropes, the class market, and the news board. Also repaint three pieces of art James asked for. Classmates only, never other schools, and never anyone's maths shown to anyone else. Nothing goes live.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` (sections 2, 3, 4 and 7), all of `docs/ISLES-PLAN.md` (especially section 4 "Classmates", section 8 "Server and database", section 9 "Testing", and every result in section 13), `docs/ISLES-RULES.md` and `docs/ISLES-ART-PLAN.md`.
2. Read `shared/isles/` (`config.ts`, `engine.ts`, `race.ts`, `server.ts`, `memoryServices.ts`, `nextStep.ts`), `supabase/functions/isles/` (`handler.ts`, `entry.ts`, the tests), `supabase/migrations/20261102000100_isles.sql`, `supabase/tests/database/isles.test.sql`, `scripts/isles-sim.mjs`, and the screens in `src/games/isles/` (`IslesPlay.tsx`, `TurnSteps.tsx`, `Race.tsx`, `trialBackend.ts`, `isles.css`).
3. Work only in this worktree, on branch `isles`. Check `git log` has "Sky Isles: race questions come during the race" (2 Nov 2026). Merge `origin/main` first (`git fetch`, then `git merge origin/main`). Never commit to `main`, never `supabase db reset`, and push only with `git push origin isles`. Don't edit shared files (`src/styles.css`, `src/components/`, `src/maths/`, `shared/maths/`, other games).
4. Make a plan for the stage and show it to James on a card before building. Ask about anything still open (see "Open questions" below) on cards, recommended option first.

## What to build (plan section 4 is the source; these are the main points)
1. **Races against classmates.** `raceStart` against a classmate's island, using `raceProblem`'s limits (one race a turn, 2 a day, never the same classmate twice a day, an island challenged at most 3 times a day, no challenging an island in its calm start). The challenged island doesn't need to be online, answers nothing, gets its home wind, and **loses nothing**: it gets the "well raced" gift, or the win counted (no prize) if it wins at home (`settleRace`). The race flow is the new one (questions during the race, one stretch at a time from the server); it already works for a classmate, so keep it. Saving both islands must be safe if the classmate plays a turn at the same moment.
2. **A way to pick who to race:** the class sky, showing classmates' islands (name, Sky Keeper, size), with who can be raced now and why not otherwise. The Gull Riders stay, always free.
3. **Friendship ropes:** up to 2 per island; offer by button, accept by button, either side can untie with no penalty. Bonuses: no market fee with a roped friend, +1 idea a day each, and a storm on one island is softened by roped friends' Wind Walls. Nothing is gained by untying.
4. **The class market:** food and goods only; prices from the server, drifting overnight back towards normal; selling lots of one thing lowers its price for the whole class for the day. No typed offers: buttons and amounts. It fills the turn's step 10 ("Market", now "The market opens soon"), which stays in the same place so the 11 steps never change.
5. **The news board:** good news only ("Ana's island reached 12 spots!", "Rawiri won a Sky Race against the Gull Riders", "Storm over the east sky, Wind Walls held."). Never who lost a race, never anything about maths. Read with `load`, never polled.
6. **Server and database:** add what's needed to the on-hold migration `20261102000100_isles.sql` (ropes, market, news, and how classmates' islands are read: own class only, through `my_school()` and class membership; pupils never read another pupil's seed, questions or maths). Add checks to `isles.test.sql`, run them on a scratch copy (`scripts/scratch-db.sh isles`, `scripts/scratch-test.sh isles supabase/tests/database/isles.test.sql`) and drop the copy. Re-run `npm run build:functions -- isles`. Keep the request count low (plan section 8's estimate).
7. **The preview** gets pretend classmates (a few islands of different sizes and ages, one in its calm start) in the trial backend, so James can race, rope, trade and read the news on his phone.
8. **Pip's next step** (`nextStep.ts`) learns about ropes, the market and classmate races where it helps.
9. **Repaint (James, 2 Nov 2026):** farm levels 2 and 3 (no wide wheat slab) and workshop level 1 (so all three workshop levels are windmills). Keepers stay as they are. Paint in ComfyUI on James's gaming PC with `scripts/isles-art.py` (check `curl http://100.97.96.115:8188/system_stats` first; if it doesn't answer, ask James to start ComfyUI, never draw art in code), then `tidy --force` for those pieces. A Sonnet helper checks the new pictures beside the old ones.

## Open questions to settle with James (on cards)
- **Coins pile up for daily players after the Lighthouse is lit** (about 30,000 by season's end). Something worth spending on after the goal: gifts to roped friends, or island decorations that show on the class sky? Plan section 13, S.0 results.
- **1-day-a-week pupils don't reach Grand Isle** (about 8 or 9 spots). Put classmates in the simulator and look again; the small-island extra chunk may already help.
- **The starter race's result card** shows the Gull Riders' luck as below nothing; the screen hides it now. Keep hiding it?
- Anything else the plan leaves open for S.4.

## Tests (still within 8; no new numbered test)
- Extend test 3 for classmates: the browser can't rig a classmate race, the result comes from the seed and the marked answers, the challenged island loses nothing, and every race limit is refused when it should be. Ropes, market and news go in the server tests and the database test (one rope offer sent twice makes one rope, a third rope is refused, another class's islands and news can't be seen, the market can't be sold below nothing).
- Keep tests 1–7 passing. Extend test 7 if new screens or controls are added (focus to each new heading, 44 px buttons, contrast, reduced motion).
- Update `scripts/isles-sim.mjs` with classmates (races against classmates, rope ideas, market prices) and re-run it. Say what moved in the pace table.

## When done
1. Run the type check, `npm run test:all`, the build, the preview build, the simulator, and the database test. Under load, a non-Sky Isles test sometimes fails (Dashboard Season, Skill Map). If one does, run it on its own before calling it broken.
2. Rebuild the one-file preview and republish it to **the same private page**, https://claude.ai/artifact/Q7phU2vhvHx4yYSPBUxpE6: `ISLES_INLINE=1 npm run isles:preview`, then `node scripts/inline-monsters-preview.mjs dist-preview-isles sky-isles-test-page.html`, and change the built file's `<title>` to `Sky Isles Preview` before publishing.
3. Play it in the preview with headless Chrome, at laptop (1366×640) and phone on its side (844×390): race a classmate, offer and accept a rope, sell and buy at the market, and read the news. Copy and change `scripts/isles-race/play-three-races.mjs` (it drives the preview on port 5191 and edits the saved island in `localStorage`, `isles-trial:preview`). On a phone on its side, every screen's main button must show without scrolling (the phone-landscape block at the end of `isles.css`). Save screenshots in `docs/isles-screens/class-sky/` and send them to James.
4. Add "S.4 results" to section 13 of `docs/ISLES-PLAN.md`, update section 4, section 8 and `docs/ISLES-RULES.md` to match what was built, and tick S.4 in the status line at the top of the plan. Commit only your own files, then `git push origin isles`.
5. Tell James in a few plain sentences what changed and what to try on his phone. Ask any questions on cards. Update the memory note `sky-isles.md`, then stop.

**Never:** apply the migration live, deploy the function, merge to `main`, switch the game on, or add it to the registry. Keep the game original.
