# Dragon Maths season timeline

A "This season" road for Dragon Maths, like the Clan Quest one (docs/CLANS-SEASON-TIMELINE-PLAN.md), so kids can see where the
season is, what comes next and how long they have. Asked for by James, 29 Oct 2026. **Built 29 Oct 2026** on
`claude/project-thread-ccvq4o`.

## What kids see

- **In the game**, at the top of the village's parchment panel (above the menu): "Season 1 · day 24 of 35", a countdown sentence,
  four round stops on a gold road that fills as the days pass, and the pupil's own line in green. Tap a stop for a short note.
- **On the site home page**, in "Complex maths games": the same four stops, small, in the home page's colours, with an
  "Open Dragon Maths" button. When Clan Quest's strip is showing too, the two sit side by side on wide screens (one above the other
  on phones) and are titled "Clan Quest this season" and "Dragon Maths this season". Pupils only, while Dragon Maths is on for
  their class, the school has a season date and season 1 has started.

The four stops (35-day season, from `SEASON_DAYS`):

| Stop | Days | Says | Picture |
| --- | --- | --- | --- |
| Forest | 1–14 | Fight monsters, find gold | the bright forest |
| Masters | 15–28 | Beat your masters to level 12 | High Master Orrin on the training grounds |
| Dragon week | 29–35 | Last chance to beat the Red Dragon | Scorchtail in the lair (red rim) |
| New season | day 1 again | Fresh start · stars stay | the Hall of Heroes |

Dragon Maths has no fixed phases (the dragon opens whenever a hero is ready), so the stops are a **pace guide** from
LORD-PLAN.md section 7 (a steady player reaches the dragon in week 4 or 5). The Masters note says "Ready sooner? Go sooner!".

Countdown sentence: days 1–28 "**N days** until dragon week. M days left in this season."; days 29–34 "**Dragon week!** N days left to
beat the Red Dragon this season."; day 35 "**Last day of the season!** Tomorrow every hero starts again. Your stars stay forever."

The pupil's own line: "You are level 7: 5 more masters to the dragon." / "You are level 12! Win in the forest to get ready for the
Red Dragon." / "You are ready: the Red Dragon is waiting. One try a day." (no line without a hero).

## How it's built

- `shared/lord/seasonRoad.ts`: `lordSeasonRoad(clock, hero)` (stops, sentence, the pupil's line, bar fill, screen reader label) and
  `readLordSeason()` for the home page. Tests: `shared/lord/seasonRoad.test.ts`.
- Game: `src/games/lord/SeasonRoad.tsx` and `.lord-road` in `lord.css`; shown in `Village` (LordPlay.tsx). It replaces the "4 days left in
  this season" line under the village text (the header still says it). Hidden in the browser-only trial, whose season is pretend,
  unless the trial is given a date (`createTrialBackend(player, seasonStart)`; preview/lord `?day=N`).
- Home: `src/components/DragonSeasonStrip.tsx` (reuses the `.season-strip` styles), placed in `Dashboard.tsx` with Clan Quest's.
- Data: migration `20261030000100_home_lord_season.sql` adds to `my_moves_left()` a `lordSeason` `{ start, on }` (from
  `lord_settings()`) and the hero's `level` and `exp`. The browser works out the season from `start` with `seasonOf`. It works with
  the per-class date (live now) and with the school date once `20261028000400` goes live.
- Pictures: `src/games/lord/art/timeline/` (192 px webp, 5–9 KB), cut from the game's own paintings by `scripts/lord-timeline-art.py`.
  New ComfyUI medallions could replace them later with the same file names.
- Previews: preview/home `?day=N&level=N`, preview/lord `?day=N`.

## Not built (possible next steps)

- "You beat the dragon this season" wording (the browser isn't told about this season's Hall entry yet).
- Holiday-pause wording, and painted medallions in place of the cut-out pictures.
