# 5. The signed-in pupil, saving, scores and progress

- **Who is playing.** Browser: `useAuth().profile` (the `RequireAuth` route already makes sure someone is signed in). Server: send the session token (`supabase.auth.getSession()` → `Authorization: Bearer <token>`, plus `apikey: SUPABASE_PUBLISHABLE_KEY`, as in `src/data/lord.ts`). The function reads it with `userIdFromToken(admin.auth)` from `_shared/signIn.ts` and is deployed with `--no-verify-jwt` (server-load S.5).
- **The school check.** Every database function that shows or changes another person's data uses `my_school()` (or `my_students()` / `require_teacher_of()` for teachers) so schools never see each other (`20261018002500` migration). Boards and halls are own-school only, with teachers (`p.role = 'student'`) and hidden profiles left out (`marble_board()`; every board since `20261105000400`, James 4 Nov 2026).
- **Saving.** Your own tables, prefixed with your game. RLS on. Pupils read their own rows through a `my_<game>()` function, not the table. Saving is done by your server function with the server key, through a `record_<game>_…()` function that the server key alone may run. At the end of each migration, revoke every new function from `public, anon` and grant only what's needed (see the "lock new functions" block at the end of `20261018002500`). A save that's sent twice must count once (a seed or request id with a unique index).
- **Daily limits and cost.** The project is on Supabase's free size, and a whole class at once is the danger (`docs/SERVER-LOAD-PLAN.md`). Ask the server as few times as possible: one request per level, run or turn, not per tap. Add a daily cap if a game could be farmed (`marble_runs` asks for a break after `daily_limit`). Estimate requests per class per week in your plan (101's plan did: about 30,000 a month against 500,000).
- **Points and achievements (through `hub_games`, from migration `20261020000100`).** A new game never adds a column to `scored_games` or re-creates a shared function. In its own migration it:
  1. registers itself: `insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements) values (...)`. Every hook is optional, and a trigger refuses a hook with the wrong shape:
     - `switch_column`: its `app_settings` true/false column. While it's off, its achievements and points rules are hidden.
     - `counts_fn(who uuid) returns jsonb`: `{ "<measure>": n }` for its achievements.
     - `rules_fn() returns jsonb`: `{ "lines": ["Finish a course: 3 points.", …] }`, shown on How points work under the game's name.
     - `players_fn() returns setof uuid`: players whose achievements come from progress outside points (a rebuild re-awards them).
     - `season_fn(players uuid[]) returns void`: what else a New Season clears. Its points always go.
     - `last_played_fn(player uuid) returns timestamptz`: for the teacher's list.
     - `keep_achievements`: achievements stay through a New Season.
  2. adds its measures (`insert into public.achievement_measures`) and achievements (`insert into public.achievement_types`, `game = '<id>'`).
  3. gives points from its server function with `add_game_points(player, '<id>', points, once)` (server key only; `once` unique per save, so a retry earns once; at most 100 at a time). They're scored as a solo game inside the shared 40-points-a-day cap, and achievements are checked straight away. When its counts change without points, it calls `game_progress_changed(player, '<id>')`.
  The test `supabase/tests/database/game_hooks.test.sql` shows a whole pretend game doing all of this: copy it for yours. Points are never ranked against maths. The Leaderboard (`src/pages/Leaderboard.tsx`, migration `20261113000100_leaderboard_boards.sql`) needs nothing from a new game: achievements and finished goes count by themselves (see `docs/LEADERBOARD-PLAN.md`). Achievement measures that show maths level end in `_step` (or are `maths_right`) so the boards leave them out. A game's own board (best score, wins) goes on the 🎮 Game boards tab of that page, never as a new tab, and is own-school, pupils only, no hidden profiles. A game with no home card that still has achievements (like `homework`) goes in `HUB_ACHIEVEMENT_GROUPS` in `src/games/registry.ts` so its name shows. Older games keep their own lines in the shared functions; don't copy those.
- **Trophies (profile cards P3, P7).** A trophy is a `public.trophy_types` row (game = the home card id) given by `award_trophy(player, id, detail, season)` from the server, never the browser, and never for maths results. Copy `20261112001700_trophies_games_1.sql`: a small `after insert or update` trigger on your own record table that calls `award_trophy` only when the feat comes true in that save, wrapped so an error can't lose the save, plus a back-award from today's rows. In the game, `<TrophyWonLine games={['<id>']} watch={...} />` (`src/trophies/`) shows "Trophy won!"; `watch` is something that changes after a saved go. Counts a trophy needs across a New Season (wins in a hub season, feats in a year) go in `season_counts` via `season_count_add` (`20261112002200_trophies_games_3.sql`). Trophies give no points. Every trophy shows to the whole school on the Hall of fame and the home page's New trophies strip, with its `how` as "what it was for", and `how` also shows when a pupil points at it in their cabinet: write `how` in pupil words, one short sentence. A trophy won by a maths result (e.g. Royal Decree's Royal Crown, all 8 riddles right) must be inserted with `on_hall = false` so classmates never see it (`20261113000300_trophies_kept_private.sql`).
- **New season.** Your game's points are cleared by New Season automatically. Anything else per-season (boards, best times) goes in your `season_fn` hook. Never edit `teacher_new_season()` itself.
- **Privacy.** Add what you store and who can see it to `docs/PRIVACY-SUMMARY.md`. Never show a pupil's maths results to classmates. Store display names only (real names stay with teachers).

## What to save per go

Save these from day one, so the teacher views and the maths records work. The server works each one out from its own kept round and the replayed taps, never from what the browser claims.

| What | Where it is saved | Who reads it |
|---|---|---|
| Every tap: what was picked and how long it took, `taps: [{pick, ms}]` | the round row (`<id>_rounds`) | replay, "usually 3 s" on the Progress tab |
| Right at the first tap (`first_right`, count per round) and `mistakes` | the round row | "% right first try" |
| The step the round was played at (`step`) | the round row | "on this step since" |
| One slip kind per wrong first try (`slips`, from `slipsOf` in `shared/kit/slips.ts`, words in your `SLIP_WORDS`) | the round row | the pupil's usual slip (`topSlip`) |
| Help shown on each go, where the game has picture help (level shown, demo played) | the round row | the stuck signal |
| The current step, `good_at_step` / `good_in_row`, `days_done`, last day | the progress row (`<id>_progress`) | Progress tab, "nearly ready" |
| Each fact once, right only if the first tap was right, with the wrong answer `given` | `recordMathsAnswers(…, JUNIOR_QUICK_MS)` (junior) or `recordMathsAnswers(…)` (older) | maths records, skill map, "Often answers 54" |
| Kinds the child has seen (for first-time demos) | `kit_seen` through `shared/kit/seen.ts` | `useSeenKinds`, `useKindDemo` |

## Replay: the server re-runs what counts

- **Tap games (junior):** the server keeps the round it made (`start`), and on `finish` replays the child's taps on it with `replayTaps` (`shared/kit/replay.ts`). A tap on a number that isn't a choice throws. Copy `shared/weka/server.ts`.
- **Action games (runs, courses):** the browser sends the seed and the inputs; the server replays the run with the shared rules and works out the time, medals and rewards itself. Copy `shared/toonflap/server.ts` or Marble Rush.
- **Questions:** made and marked on the server ([4-maths.md](4-maths.md), way A).
- A save sent twice counts once: a seed or request id with a unique index, and a `once` key for `recordMathsAnswers` and `add_game_points`.
