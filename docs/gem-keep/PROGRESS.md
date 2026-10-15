# Gem Keep: progress

What each phase built, checked against the brief's "done when" ([../prompts/gem-keep.md](../prompts/gem-keep.md), section 6).
Recon and decisions: [RECON.md](RECON.md).

## Phase 1: playable prototype (16 October 2026)

**Where:** `/#/gem-keep` (signed in; not on the dashboard yet). Stand-alone copy without sign-in:
`npx vite --config vite.gem-keep-preview.config.ts`, or build it with `npm run gem-keep:preview`.

**Built**

- `shared/gem-keep/`: the simulation, pure TypeScript with no screen. A fixed 60 steps a second,
  seeded randomness, so the same moves always play out the same way.
  - `config.ts`: every tuning number (mana, costs, damage, enemy health, effects, stars).
  - `gems.ts`: four colours, each with its own shape: red triangle (hits a group), blue circle
    (slows), green hexagon (poisons), yellow star (big hits). Two gems of the same grade
    combine into the next grade, up to 5. Mixing colours makes a gem with both effects at 60%
    strength (the brief's optional stretch; it was cheap to include).
  - `engine.ts`: towers (3 levels), gems in towers, "First in line" and "Strongest" aiming,
    enemies (walker, runner, brute, swarm, boss), waves, mana from kills plus a little after
    each wave, Keep health, win (1–3 stars by health left) and lose.
  - `level.ts`: the level format (a 16 × 10 map of letters, paths as corner lists, waves) and
    `checkLevel`, which explains in plain words what's wrong with a level.
  - `levels/prototype.ts`: one hand-made level, "Crystal Valley", 8 waves with a boss on wave 5.
  - `autoplay.ts`: a simple computer player used by the tests to check balance.
- `src/games/gem-keep/`: the website side. `engine/GameEngine.ts` runs the loop outside React
  (pause, 1× and 2×, pauses itself when the tab is hidden), `render/` draws everything in code
  (no image files), `ui/GemKeepGame.tsx` is the status bar, gem forge, gem bag and tower panel,
  `strings.ts` holds every word students see.

**How it plays:** tap grass → Build a tower. With a tower chosen, tap a forge colour and the
new gem goes straight in. To combine: tap a gem, Combine, then tap a gem of the same grade (in
the bag or in a tower). Everything works by tap, mouse, or keyboard (arrow keys and Enter on
the map; every other control is a button).

**Difficulty:** James asked for the first levels to be super easy and fun, so Crystal Valley
is: building towers of any single colour wins with 3 stars, and doing nothing at all loses.
Phases 3 and 4 tune the levels properly once the maths gives the mana.

**Checked against "done when"**

| Done when | Result |
|---|---|
| A full level can be played start to finish on desktop and iPad | Played start to finish through the real page by a browser script: Chromebook size (1366 × 640, mouse), iPad size (1024 × 700, touch), then Play again. Won with 3 stars both times, no page errors. Keyboard: built a tower with arrows, Enter and Tab. Phone upright shows "turn your device sideways"; phone sideways and iPad upright fit with no sideways scrolling |
| 60 fps with 60 enemies | 58 enemies on screen with 10 towers firing: steady 60 fps, also with the processor slowed 4× and 6× to stand in for a low-end Chromebook (finished build). Needed one fix: enemies, towers and gems are now drawn once and copied each frame |
| Engine unit tests cover damage, effects and targeting | 29 tests in `shared/gem-keep/engine.test.ts`: building, mana, upgrades, gems, combining, grades, mixed gems, damage, splash, slow, poison, critical hits, both aiming modes, range, kills, the Keep, waves, winning, losing, and the same game twice |

**Not in Phase 1:** maths (Phase 3), sounds and particles polish (Phase 6), saving (Phase 5).
The full test suite is 628 tests, all passing.
