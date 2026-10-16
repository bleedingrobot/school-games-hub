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

## Phase 2: maths engine (16 October 2026)

**Built**

- `shared/maths/`: the maths engine. Plain TypeScript with no React, no screen and nothing
  about Gem Keep, so any hub game (and the server) can use it.
  - `config.ts`: every maths tuning number: the campaign's focus tables (levels 1–2 ×2 ×5 ×10,
    3–4 add ×3 ×4, 5–6 add ×6 ×8, 7–8 add ×7 ×9, 9–10 add ×11 ×12), the 60/30/10 mix,
    "quick" = under 5 seconds, box weights, repeat gap, missing factor from level 4.
  - `facts.ts`: `7 × 8` and `8 × 7` are one fact (`mul:7x8`); both orders get asked.
  - `leitner.ts`: mastery boxes 0–4 (quick and right = up one, right but slow = stay,
    wrong = box 1). Box 4 ("fluent") needs quick right answers on two different New Zealand
    days. Keeps attempts, right answers, average time, box and when last seen.
    `mastery()` turns a box into the teacher grid's words: not tried, learning, secure, fluent.
  - `selector.ts`: picks the next fact. About 60% focus tables, 30% review of earlier tables
    (facts with more mistakes come up more), 10% stretch into the next tables. Lower boxes
    come up more often; the last 3 facts aren't repeated; a wrong answer comes back 3–6
    questions later. Can ask only from chosen boxes (for the Gem Forge), falling back to
    any fact when there are none. Only tables the teacher left on are used.
  - `skillPack.ts`: the `SkillPack` interface from the brief, so other skills (addition,
    doubling, place value) can be added later without touching game code.
  - `skillPacks/timesTables.ts`: multiplication (`7 × 8 = ?`), missing factor (`? × 8 = 56`,
    from level 4) and division (`56 ÷ 8 = ?`, only when switched on). All three count towards
    the same fact. Multiple-choice mode gives four believable choices. `curriculumTags` has
    **placeholders** (`TODO-…`) for James to fill in from his alignment tool.
- `src/maths/`: the question box and number pad, also not tied to Gem Keep.
  - The fact is shown big. Big on-screen keys (60 px), and the keyboard works too (digits,
    Backspace, Enter), even after tapping the pad. Up to 3 digits.
  - Right: a sparkle and "Correct!". Wrong: no buzzer; the right answer appears in the blank
    and the whole fact ("7 × 8 = 56") shows for 2 seconds.
  - Multiple-choice mode shows four big answer buttons instead of the pad.
- Preview: a **Maths practice** tab on the test page. Pick a campaign level, division or
  multiple choice, answer 10 questions, and watch a 12 × 12 grid colour in (the same grid
  teachers will get in Phase 5).

**Checked against "done when"**

| Done when | Result |
|---|---|
| Unit tests cover selection weighting, box movement, commutative fact keys and enabled-table filtering | 29 tests in `shared/maths/maths.test.ts`: the 60/30/10 mix over 10,000 picks, lower boxes and more mistakes picked more, box filters, no repeats within 3, wrong facts back after 3–6 questions (5 seeds), every box rule including fluent needing two days, NZ days, `7 × 8` = `8 × 7`, both orders asked, tables switched off never asked, every question kind's answer checked over 1,000 questions, multiple-choice choices including near 1 and 12 |
| The question box works by touch and keyboard | 8 tests in `src/maths/QuestionModal.test.tsx` (pad, keyboard, typing after tapping, 3-digit limit, wrong-answer fact for exactly 2 seconds, multiple choice, missing factor). In a real browser: 10-question rounds answered by keyboard (Chromebook size), by touch (iPad size, phone sideways, phone upright), and by multiple choice with division, one deliberate mistake each time, no page errors and no sideways scrolling |

**Not yet:** questions don't appear in the game until Phase 3, and nothing is saved until Phase 5.
The full test suite is 665 tests, all passing.

## Phase 3: maths in the game (16 October 2026)

**Built** (numbers in `shared/gem-keep/config.ts`, `MATHS`)

| Touchpoint | How it works |
|---|---|
| **Mana Well** | Blue button next to the mana. Up to 10 questions between waves, 15 mana for each right answer, +5 more from 3 right in a row. It rests once used up and fills again when a wave is cleared. It can be opened during a wave too (the game pauses in Calm mode); the brief said "when paused", and this is simpler for students. "Back to the game" leaves early |
| **Gem Forge** | Forging a gem or combining two asks 1 question first. Wrong: the fact is shown, **nothing is spent**, and a new tap gives a new question. Combining grade 1 gems asks facts the student already knows well (boxes 3–4); grade 3 and 4 asks their practice edge (boxes 0–2). Problems (bag full, not enough mana, grades don't match) are caught before asking, so nobody answers for nothing |
| **Wave Gate** | Pressing "Start wave 5 (boss!)" asks 3 questions: 3 right = Power Surge (+25% damage that wave), 2 right = +10%, otherwise the wave starts normally |
| **Keep Shield** | Once a level, the first time the Keep drops below 25%: 5 questions, each right one heals 5% |
| **Level Key** | After a win: 10 questions on the level's focus tables only. 8 right (teacher's setting) unlocks the next level. Otherwise it lists the missed facts, and "Try the Level Key again" asks new ones straight away, as often as needed |

- **Calm mode** (default) pauses the game while any question is up. **Challenge mode** keeps it
  going at half speed. These and the other teacher choices (tables, division, multiple choice,
  pass mark) are in `src/games/gem-keep/settings.ts`; Phase 5 loads them from the database.
- **Mana now mostly comes from maths:** starting mana 140, kills pay 1–6 (boss 30), clearing a
  wave pays 10.
- The question box reports each answer exactly once (a bug found by the new tests: with no
  pause after an answer it could count one twice).
- Preview: a "Teacher settings" strip above the game to try Challenge mode, multiple choice and division.

**Checked against "done when"**

| Done when | Result |
|---|---|
| A level can only be won comfortably by engaging with the Mana Well | Engine tests: without the Well, both computer players **lose** level 1; using the Well and getting only 30% right, every gem colour wins with 3 stars (James: level 1 super easy). At 70% right, more than half of all mana comes from the Well. In the browser play-throughs, 79% of mana came from the Well |
| Wrong answers never cost resources | Tests: a wrong Well answer adds nothing and takes nothing; a wrong Forge answer spends nothing and makes no gem; the Gate and Shield only ever add |
| Level Key gate works with retries | Test: 7/10 fails, lists the 3 missed facts, retry with new questions, 9/10 unlocks. Browser: passed 8/10 at Chromebook size (keyboard) and iPad size (touch) |
| Calm mode pausing | Tests: the game is paused while a question is up in Calm mode and slowed in Challenge mode |

Full level played in a real browser with every question answered (every 4th one wrong on purpose),
at Chromebook size with the keyboard and iPad size by touch: Mana Well every wave, a question for
every gem, the Wave Gate before the boss, the Level Key at the end. Won with 3 stars both times,
no page errors. Tests: 7 new engine tests, 8 new game-screen tests; 681 in total, all passing.

## Phase 4: campaign content (16 October 2026)

**Built**

- **10 levels** as JSON in `shared/gem-keep/levels/` (`index.ts` lists them in order). Maps and
  paths designed by hand; waves made by a small generator as a starting point; then each level's
  new `toughness` (enemy health multiplier) tuned with the computer player.

  | Level | Name | Tables | Waves | Paths | Toughness | Right answers needed to win* |
  |---|---|---|---|---|---|---|
  | 1 | Crystal Valley | ×2 ×5 ×10 (to × 10) | 8 | 1 | 1 | 30% |
  | 2 | Sunny Meadow | ×2 ×5 ×10 (to × 10) | 8 | 1 | 1.28 | 30% |
  | 3 | River Bend | + ×3 ×4 | 9 | 1 | 1.83 | 35% |
  | 4 | Rocky Pass | + ×3 ×4 | 9 | 1 | 2.17 | 35% |
  | 5 | The Long Road | + ×6 ×8 | 10 | 1 | 2.12 | 35% |
  | 6 | Two Rivers | + ×6 ×8 | 10 | 2 | 1.57 | 50% |
  | 7 | Frost Ridge | + ×7 ×9 | 11 | 1 | 2.14 | 50% |
  | 8 | Twin Gates | + ×7 ×9 | 11 | 2 | 1.58 | 55% |
  | 9 | Storm Peaks | + ×11 ×12 | 12 | 2 | 1.63 | 55% |
  | 10 | Gem Keep Castle | + ×11 ×12 | 12 | 2 | 1.17 | 65% |

  \* The lowest share of Mana Well, Wave Gate and Keep Shield answers at which the simple
  computer player wins (2 games out of 3). A student who combines gems and upgrades towers needs
  less. Two-path levels have lower toughness because two paths are harder in themselves.
  Bosses come on wave 5 and 10 and, from level 6, on the last wave too (each with a Wave Gate).
- **Campaign map** (`ui/CampaignMap.tsx`): the 10 levels on a winding trail (1–5 left to right,
  6–10 back), each with its number, name, times tables, best stars, and a lock until the level
  before's Level Key is passed. Total stars at the top. The next level to play glows.
- **In a level:** a heading ("Level 3 · River Bend") and a Map button. After a win: the Level
  Key, then **Next level**. A level whose Key was passed before goes straight to Next level.
  Best stars are kept.
- **Progress** (`progress.ts`) is kept in the browser for now (`localStorage`); Phase 5 saves it
  to the database so it follows the student between devices.
- The maths records now carry from level to level within a visit.
- **Level format guide** for James: [LEVELS.md](LEVELS.md).
- The computer player now spreads its towers so both paths get covered (it used to bunch them
  by one path, which made two-path levels look impossible).

**Checked against "done when"**

| Done when | Result |
|---|---|
| All 10 levels load and validate | Test per level: `checkLevel` finds no problems, 8–15 waves, bosses only on every 5th or the last wave; levels 6, 8, 9 and 10 have two paths |
| All 10 are beatable | Test: the computer player wins every level in 3 out of 3 games at 80% right, and loses every level when it skips the maths. In the browser: level 1 won through the map, level 6 (two paths) won by the browser script with every question answered |
| Difficulty rises steadily | Test: the share of right answers needed never drops by more than 5 points from one level to the next, level 1 needs at most 30%, level 10 needs at least 20 points more but no more than 80% |

**Time per level (estimate, not yet measured with students):** the waves themselves take about
2 minutes (level 1) to 7 minutes (level 7) at normal speed, half that at 2×. A full Mana Well
of 10 questions plus building adds roughly a minute a wave. So levels 1–2 take about 10 minutes,
and later levels about 12–18 (about 10–14 at 2× speed), which is longer than the brief's
8–12. Easy fixes if the class trial shows they're too long: fewer Well questions a wave (each
worth more), or fewer waves. Both are one-number changes.

The full test suite is 699 tests, all passing.

## Class trial release (16 October 2026)

James asked for Gem Keep on the hub straight away so his class can try it, before Phase 5.
So it's now on the dashboard as a normal game card (no bot picker: a new `noBots` option on
`GameDefinition`; the other games' cards are unchanged), at `/#/gem-keep`. For the trial:
progress is kept on each device (`localStorage`), it gives **no points** and isn't on any
leaderboard, and maths records last only for the visit. The map says so. No database or
server changes. Phase 5 adds saving, points, the stars leaderboard and the teacher views.

## Phase 5: hub integration (17 October 2026)

Gem Keep is now a proper hub game: progress follows the student between devices, levels earn
points, there's a "most stars" leaderboard, and teachers get settings, a times-table grid per
student and the class's hardest facts.

**Saving** ([shared/gem-keep/save.ts](../../shared/gem-keep/save.ts), [src/data/gemKeep.ts](../../src/data/gemKeep.ts))

- Everything to save goes into a queue in the browser (one per student) and is sent to the new
  `gem-keep` server function after each level, after a Level Key round, when leaving the game or
  the tab, and when Gem Keep opens. With no Wi-Fi the student plays on (the map says so) and it
  saves later. Every item is safe to send twice.
- Four kinds of item: a finished level (won or lost), a Level Key round, the times-table
  records, and once, the **class-trial progress** kept on the device. That is brought in the
  first time the student opens the saving version, only if they have nothing saved yet, then
  cleared from the device so the next person on a shared iPad can't get it. It earns no points
  by itself.
- The server can't replay a 10-minute game, so it checks that each level is plausible: the level
  exists and is open (the Level Key before it passed), a win has 1–3 stars and every wave, it
  wasn't quicker than the enemies can arrive, the Level Key score is out of 10 and is checked
  against the teacher's pass mark on the server, and times-table records with impossibly quick
  answers are left out. A record can only move forward (more answers), so an old tab or a second
  device can't undo progress.
- A copy of the student's progress, records and settings is kept in the browser, so Gem Keep
  opens offline with the latest.

**Points** (inside the 40-a-day limit shared with games against bots)

| | Points |
|---|---|
| Win a level | 3, 4 or 5 (2 + stars) |
| Lose after reaching wave 3 | 1 |
| Lose earlier | 0 |
| Each achievement | 10 |

Seven achievements: win your first level, pass a Level Key, 3 stars on a level, 5 Level Keys,
15 stars, all 10 Level Keys, all 30 stars. Gem Keep never touches ratings or badges.

**Leaderboard:** a Gem Keep chip on the Leaderboard page shows the top 10 by stars (best stars per
level, so replaying a level doesn't pad it) and the student's own place. Never maths accuracy.
Hidden students aren't on it.

**Teachers** ([src/pages/TeacherGemKeep.tsx](../../src/pages/TeacherGemKeep.tsx), loaded only on the teacher page)

- **Gem Keep settings** for the whole school: Calm or Challenge, times tables on (at least one),
  missing-number questions (from level 4 / always / never), division, multiple choice, and the
  Level Key pass mark (5–10). Students get changes next time they open Gem Keep.
- **Gem Keep: the class**: how many students play, how many have won and passed the Key of each
  level, and the 10 facts most often answered wrongly (asked at least 6 times, to at least 2
  students). Teachers' own play isn't counted.
- **Each student's panel**: their levels (stars, Keys) and a 12 × 12 grid, each square coloured
  and lettered (L learning, S secure, F fluent, blank not tried) so colour isn't the only clue.
- A **new season** clears Gem Keep levels, progress and times-table records (James, 16 Oct 2026).
  Deleting a student deletes all of theirs.

**Database** (migration `20261017001100_gem_keep.sql`): tables `gem_keep_runs`,
`gem_keep_progress`, `gem_keep_facts` (learning data), `gem_keep_imports`; students can't read or
write any of them directly. `scored_games` gets a `solo` kind for Gem Keep levels. The privacy
summary has a line about the learning data.

**Also fixed on the way:** the teacher page was wider than a phone screen (the player list and the
games table pushed it out); it now fits, with the games table scrolling sideways on its own.

**Checked**

| Done when | Result |
|---|---|
| Progress follows a signed-in student across devices | Browser check on the local copy: trial progress came in; a level won and its Key passed on one device; a second device opened with the same stars and the next level open |
| Offline play saves later | Same check: a level and Key played with the connection off showed "No connection right now", stayed queued, and saved with the right points when the connection came back |
| Teacher can change enabled tables and see the heat map | Same check: switching ×12 off saved to the database; the student's grid and levels showed |
| A season reset clears Gem Keep progress | Database test: runs, progress and fact records all gone |

Tests: 66 new database tests (`gem_keep.test.sql`), 18 for the server function, 8 for the save
queue, and page tests for the teacher panels, the stars board and the campaign's saving. 731
unit tests and every database test pass (the space and 101 "refuses made-up seeds" tests failed
once in a full run and pass on their own; they weren't touched).

**To go live** (needs James's yes): apply the migration with `supabase db query --linked -f`,
deploy the new `gem-keep` function (`--no-verify-jwt`), check it from outside (anon
`POST /functions/v1/gem-keep` → 401 JSON), then merge `stage-11` to `main`.

