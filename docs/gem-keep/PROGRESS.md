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
