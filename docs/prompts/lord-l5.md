# Prompt: Dragon Maths, stage L.5 (the arena, news, points and the teacher page)

Paste this into a new chat to start the build. **Only start it after James has tried L.4 with real saving** (see docs/prompts/lord-golive.md) and has told you what he found.

---
You're continuing Dragon Maths, a game in James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: worktree ~/projects/school-games-hub-dragon-maths, branch `dragon-maths`. Work only in this worktree. Don't merge to `main`, don't push to `main`. The branch's upstream is `origin/main`, so never use a bare `git push` (use `git push origin dragon-maths:dragon-maths` if James asks for a push).
- **Read first:** docs/LORD-PLAN.md (sections 9 to 11, 13, 15 and the "L.4 results" notes), docs/LORD-RULES.md, then shared/lord/server.ts (the request rules, run by both the `lord` function and the browser trial), supabase/functions/lord/, supabase/migrations/20261018001600_dragon_maths.sql, src/data/lord.ts and src/games/lord/. For how a game gives points, achievements, a board and teacher views, copy **Maths Monsters N.6**: supabase/migrations/20261018001500_maths_monsters.sql (scoring inside the 40-a-day bot cap, `award_achievements`, `monsters_leaderboard`, `teacher_monster_class`, the new-season rules) and docs/MONSTER-PLAN.md "N.6 results".
- Done so far: L.0 to L.4. The server keeps the hero, hands out and replays every fight, and marks every maths answer. Ask James first whether L.4 is **live** yet (migration applied, `lord` deployed, switch on). If it isn't, build and test L.5 the same way (a new migration, tested in a rolled-back transaction; **do not apply it live or deploy**), and put the new steps in a go-live prompt.
- James's decisions so far: 10 forest fights a day, soft losing, 5-week seasons with fresh heroes, no romance or orphans or gambling, the dragon is "a fight, not a test", dark BBS look. Open from L.4 (ask him, don't guess): should an abandoned mid-fight count as a loss after a while; should a teacher see the test tools in the live game; should a pupil who plays twice a week be able to reach the dragon (plan question 12).

## This step: L.5 (stop for James when done)

Keep the server the boss: everything below is decided by the server with the shared rules in `shared/lord/`, and nothing a pupil types is ever shown to classmates.

1. **Computer heroes.** About 8 village heroes with believable names and a clear "computer hero" label, who level up on a schedule through the same engine and simulator (never LORD.ts's different fight maths), so the arena and news are busy from day one. They never cost a pupil anything.
2. **The arena.** 3 fights a day (already in the hero as `arenaLeft`) against a saved copy of a classmate's hero or a computer hero, played by the computer using the engine. Pick opponents the server chooses near the pupil's level. A win gives a little experience and a news line; **losing costs nothing**. A classmate's hero is only a copy, so nothing happens to them. The server plays it (seeded, so it is replayable) and stores it in `lord_fights`.
3. **Daily news.** Computer-written lines only ("Brave Kiwi beat Master Halder!", "Quiet Tui was flattened by a Grumpy Troll"), from accepted events, plus the daily village event from plan section 15 (one line a day, often a small maths moment). A `lord_news` table the pupils read only through a function. No student text, ever.
4. **Warriors list and the Hall of Heroes.** Level and dragon stars, top 10 plus you, hub names and avatars only, never maths scores. The Hall of Heroes keeps who beat the dragon in each season (and how many times) across seasons.
5. **Points and achievements**, inside the shared 40-a-day cap like Maths Monsters: 1 point per 3 forest wins, 3 for a master, 10 for the dragon (my pick; check with James), `ranked: false`. About 8 achievements (first master, level 6, level 12, dragon, 10 arena wins, 50 riddles...). Teach `progress_counts`, `progress_rules`, `rebuild_progress`, `my_progress`, `teacher_students` and `teacher_new_season` about Dragon Maths without overwriting the Maths Monsters lines (merge into the latest versions of each).
6. **Seasons for real.** The countdown for the last days of a season, the Hall of Heroes saved when a season ends, the class choice at the new season (already built), and the school-holiday pause (the season clock waits while the game is closed).
7. **The teacher page** (a small, tidy addition to the existing teacher page; keep changes to shared files tiny): the game on/off switch, forest fights a day, the first season date and the pause, a list of the requests the server turned down (`lord_refusals`, with names), each pupil's topics using Gem Keep's "hardest facts" panel, **reset one pupil's hero**, and the Hall of Heroes. Use `teacher_set_lord()` and add the new teacher functions in the same style as `teacher_monster_class()`.
8. **Turn on the dashboard card** only behind a switch (`DRAGON_MATHS_ON` stays false in this stage; James flips it when he says go). Update the how-points page text for the new points.
9. **Tests:** handler tests for the arena, the computer heroes, news, points and the new teacher functions; a replay test for arena fights; SQL tests for every new table and function (students can't write, read only what they should, points stay inside the daily cap, the new season clears points but keeps stars and the Hall); website tests for the new screens. Run the local SQL tests the way the L.4 results describe (a rolled-back transaction), and `npm run check`.

## How to work

- Small commits on `dragon-maths`, with the attribution line the system gives you. Run `npm run check` before any push. If it shows the same failures as before (the flaky chess-bot test, and the generated `supabase/functions/monster/index.ts` being out of date), say so and don't fix them in this branch. Build only the lord function with `node scripts/build-lord.mjs`. Merge `origin/main` into `dragon-maths` now and then, and check migration numbers against the other worktrees.
- Add a short "L.5 results" section to docs/LORD-PLAN.md and update the memory note school_games_hub.md.
- If something in the plan turns out to be wrong or too big, say so plainly and suggest a fix instead of quietly changing course.
- **Stop for James after L.5** with a plain-words summary and the exact steps to apply the migration, deploy the function and turn on the card (copy the style of docs/prompts/lord-golive.md). Don't start L.6 (how to play, the accessibility pass, the slow-Chromebook check, the hint button and the final docs) until he has tried it with the class.
