# Leaderboard redesign plan

*Asked for by James, 13 Nov 2026 NZ: a leaderboard that reflects the trophies, games and achievements, with the number of achievements as the main board, effort highlighted, a "recent trophies" strip at the top of the home page, filters by year and class, and homework achievements and trophies. Plan page with feedback boxes: https://claude.ai/artifact/SNg7naPBB2zvHXCkRFykyk (db collection `feedback`).*

**Status:** L1 to L4 built in one PR (migration `20261113000100_leaderboard_boards.sql`).

## What it does

- **Leaderboard tabs** (`src/pages/Leaderboard.tsx`, `?board=trophies|effort|games|hall`): 🏅 Achievements (opens first), 🏆 Trophies, 💪 Hard workers, 🎮 Game boards (the old Chess, Checkers, Gem Keep and Monsters boards, unchanged), 🏛️ Hall of fame.
- **Who** chips for pupils: Whole school, My year, My class. "My year" compares the viewer's year with each pupil's through `year_level_of(uuid)` (migration `20261113000200_pupil_years.sql`, the pupils' own years); until that is live it uses the class's year level. Nobody's year is ever sent to the browser. Teachers see the whole school.
- **Achievements**: all time, or earned this week. Tap a row for that pupil's achievements per game (`achievements_by_game`). The achievements that measure maths level are left out of every count (`board_achievement_counts`: measures ending `_step` and `maths_right`), so the board never ranks maths.
- **Hard workers** (James picked "school days played", 13 Nov 2026): school days (Monday to Friday) with a finished game (a `scored_games` row), then games finished; this week or this hub season. A band names everyone with 4 or 5 school days this week (⭐ for all 5). A 💪 sits beside those names on the achievements board. The early-years garden games don't write `scored_games`, so they count only through their achievements for now.
- **New trophies** strip on the home page (`src/trophies/RecentTrophies.tsx`): the newest 8 trophies won at the school in 7 days, as `recentTrophies` in `my_home_page()`. Same rules as the Hall of fame: pupils only, no hidden pupils, "A classmate" without a made-up name, no garden friend pictures.
- **Homework** (James, 13 Nov 2026): a finished go counts as home play on school days 6:00 to 8:30 am and 3:00 to 8:30 pm, and at weekends 7:00 am to 8:30 pm (`home_time`). Late at night never counts. Hub game `homework` (no card, no switch) with 7 achievements (Home learner, Ten at home, Five home days, Weekend player, Homework hero, Weekend regular, Fifty at home), kept through New Season, and 3 trophies: Homework Star (8 home days in a season), Weekend Explorer (4 weekends in a season), Home Learning Cup (40 home days in a year), painted 13 Nov 2026. Back-awarded from saved goes when the migration ran.

- **Maths trophies are public after all** (James, 13 Nov 2026): migration `20261113000300` hid the Royal Crown (all 8 Royal Decree riddles right) from the Hall of fame and New trophies; James asked to drop that rule the same morning, so `20261113000400` sets `trophy_types.on_hall` back to true for every trophy. The column stays (all true) in case a trophy ever needs hiding.
- **🏆 Trophies board** (James, 13 Nov 2026; `trophies_board`, `trophies_of`, migration `20261113000400`): pupils ranked by different trophies held, then wins; all time or this hub season; tap a row for that pupil's trophies with how each was won. No garden friend pictures (they follow a maths step).
- **Teachers filter too**: teachers have no year or class, so the Who row for them is Whole school, a Year picker (0 to 8) and a Class picker (the school's classes): scopes `year:<n>` and `class:<id>` in `board_pupils`, teachers only.
- **Trophy cabinet hover**: pointing at a trophy shows "How you won it"; a tap opens the plaque.

## Follow-ups (not built)

- Garden games' days could count on Hard workers if they wrote a finished-go row.
- Painted tab icons, if James wants them.
