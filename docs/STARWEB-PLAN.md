# Star Web solo: plan

*James, 25 Nov 2026: "some kids really love the star web game! can you plan how we can turn this into a single player game on the main dash please!" Id `starweb`, CSS prefix `.sw-`, group `'complex-maths'` (next to Class Live). Older-pupil route, Years 3 to 6.*

**Status (25 Nov 2026): LIVE and switched on, with painted art (PRs #846, #848). See "Went live".**

## The short version

- **Same game, one player.** One known fact glows in the night sky (6 × 7 = 42). The pupil types facts they can work out from it (7 × 6, 42 ÷ 6, 12 × 7, 60 × 7, 3 × 7 ...). Each true, linked fact shoots a star into one of the seven arms (Turn around, Divide, Double, Halve, Tens, Near facts, Wild links) with its "how we know" line. Light every arm and the sky creature draws itself.
- **Reuse almost everything.** The fact reader, checker and link finder are the class game's pure rules (`shared/classlive/stars.ts`, imported, never changed). The sky is the class game's `StarSky` and `NightBackdrop` (`src/games/classlive/StarSky.tsx`), the arm colours and hints are `arms.ts`, the painted night sky, the Star Web music and Bella's Star Web lines all exist.
- **The starting fact comes from the times tables each pupil already knows** (James, 25 Nov 2026). The server picks a × fact from the pupil's own records (facts they answer well and fast), within the class's tables, different from their last 5 skies. A pupil who knows few facts yet gets an easy one from the class game's `small` list.
- **The big goal: a Star Map** of the times tables 2 to 12. Each sky lit lights the star of both its tables (6 × 7 lights 6 and 7) at bronze (every arm lit), silver (25 stars) or gold (supernova, 30 stars). As a pupil learns more tables, more of the map can light. New line-art creatures join the map at 4, 8 and all 11 tables lit.
- **No clock at all** (James, 25 Nov 2026): pupils light a sky at their own pace, so they think. No race mode.
- **Help follows the pupil:** a nudge to the emptiest arm (as now), the lag hint with the fact's own numbers when they stall, then "Show me" with a worked example on a *different* fact. Never this sky's answers.
- **Server in charge:** the browser checks each fact at once with the shared rules for instant feedback; the server re-checks every fact with the same rules when it saves (every few stars and at the end). About 4 to 8 calls a sky.
- **Teacher:** an on/off switch, an "Other games" Progress column (constellations lit), and a Today line on the arm the class finds least ("Hardly anyone halves yet").

## Decisions

| Question | Recommendation | James chose |
|---|---|---|
| A clock? | No clock to light a sky; 3-minute Night Race opens after 5 lit skies | **No clock at all** (25 Nov) |
| How much a day? | No limit; the first 5 skies a day earn hub points | **No limit, points for 5 skies** (25 Nov) |
| Where the starting fact comes from | A Sky Atlas of 21 constellations in 3 chapters | **Times tables they know** (25 Nov): Star Map of tables instead |
| Name | Keep **Star Web** (pupils know it); card subtitle "Light up your Star Map" | mine |
| Group | `complex-maths`, beside Class Live | mine |
| Ladder answers | Not recorded (open-ended facts aren't ladder questions, as in Class Live) | mine |

## How a sky plays

1. **Star Map** (the game's home): eleven big stars, one per table 2 to 12, each glowing with its best medal. One button: **New sky** (the server picks the fact). A sky left part-way shows as **Carry on**.
2. **The sky:** the known fact in the middle, the seven arms around it with their goals (Turn 1, the rest 3, `ARM_GOAL`). Under it the pupil's keypad (the class game's keys, real keyboard too, 1 to 4 not needed) and a feedback card.
3. **Send a fact.** Instant reply from the shared rules:
   - new: a star shoots into its arm with "how we know" ("Double 6 → 12, so 42 → 84").
   - already found: that star twinkles ("You found that one. Can you find a new one?").
   - true but unlinked: "True! How does it link to 6 × 7?" (no star).
   - not true: "Not quite. Check the answer." (no star, nothing lost). After two wrong tries at the same fact shape it shows the working: "6 × 14 is double 6 × 7, so double 42."
   - the known fact itself: "That's the fact we know! Find one it unlocks."
4. **Every arm lit:** the creature draws itself (bronze). Keep going for 25 (silver) and 30 (gold, supernova). "Finish" is there from bronze on; leaving earlier keeps the stars (it saves as it goes) and the sky carries on next time.
5. **End card:** stars per arm, medal, best so far, "Next constellation" button.

## Changes from the class rules (in `shared/starweb/`, wrapping `stars.ts`)

- **Wild links capped at 5 stars a sky for medals.** In class the Wild arm is fine; solo, `42 + 1 = 43`, `42 + 2 = 44` ... could farm silver and gold. Wild stars past 5 still show but don't count towards 25 and 30.
- **No glow from classmates.** A repeat just twinkles.
- **No `TRY_GAP_MS` on the browser;** the server only checks that saves come in order and at most 1 star a second over a save.
- **No `MAX_STARS` change:** 120 a sky is plenty.

## Design (docs/game-guide/1-design.md)

1. **Big goal:** light all 11 tables on the Star Map, then gold on each. A lit sky takes a strong Year 5 about 5 to 8 minutes (19 stars), so 2 to 3 skies a session; each sky lights 2 tables, so a pupil who knows their tables lights the map in 2 to 3 weeks; gold on all takes a term. A pupil still learning tables lights more as their records grow (the map follows their learning). After that: a **Free sky** (type any × fact up to 12 × 12) that never ends.

   **Picking the fact** (`pickAnchor` in `shared/starweb/`, pure, seeded): from `space_maths_context(player)` facts, the × facts between 2 × 3 and 12 × 12 (no squares, as `anchorOf`) in the top two mastery boxes and the class's `enabledTables`; prefer facts whose tables aren't gold yet; skip the last 5 skies. Fewer than 3 such facts: pick from the class game's `LEVELS.small`. Reading the focus only, never working out a pupil's level (docs/game-guide/4-maths.md rule 1).
2. **Season game?** Not for this game: nothing piles up that late joiners can't catch.
3. **Play a day:** no limit (it's practice). Hub points for the first 5 skies a day (`add_game_points`, writes `scored_games`, so it counts for Hard workers): 2 for bronze, 3 silver, 4 gold. Not in `UNLIMITED_GAMES` (nothing to unlock).
4. **Progress bars:** on the Star Map, "7 of 11 tables lit"; in a sky, the seven arm meters and a star count towards 25 and 30.
5. **Achievements** (`hub_games`):

   | Name | For (pupil words) | Measure | Number | Who gets it | Kept at New Season |
   |---|---|---|---|---|---|
   | First Light | Light every arm of a sky | `starweb_lit` | 1 | most, day one | yes |
   | Star Finder | Find 100 new facts | `starweb_stars` | 100 | many, week 1 to 2 | yes |
   | Every Way | Light a sky without a hint | `starweb_nohint` | 1 | about half | yes |
   | Supernova | Get gold on a sky | `starweb_gold` | 1 | about half | yes |
   | Bright Ten | Light 10 skies | `starweb_lit` | 10 | many | yes |
   | Star Map | Light every table, 2 to 12 | `starweb_tables` | 11 | some | yes |
   | Golden Map | Gold on every table | `starweb_gold_tables` | 11 | a few | yes |

6. **Home card:** `src/assets/home/starweb.webp` + `-small`. Stand-in: a copy of Class Live's painted `pick/stars.webp`. Scene to paint: "a child on a hilltop at night with a telescope, a glowing constellation web of seven coloured arms above, a whale drawn in starlight lines, deep blue, no writing".
7. **Guide for new players:** a guided first go on the first constellation (3 × 4), using the real keypad, one lit-up thing at a time.

   | Moment | What the game does | Why a child gets stuck | Fix |
   |---|---|---|---|
   | First sky | Bella: "We know 3 × 4 = 12. What else do we know?" | doesn't know what "a fact" is here | guided go: the Turn arm pulses, keypad shows "4 × 3 = ?" ghost layout; success can't fail |
   | First star | star shoots, "how we know" read aloud | doesn't see why it counted | the line stays on the card until the next send |
   | Stall (no new star for 20 s) | lag hint for the emptiest arm with the fact's numbers (`lagHint`) | no idea how to halve or use tens | "Show me": a worked example on another fact (2 × 5 → 4 × 5), then back |
   | Wrong answer | "Not quite" + working after 2 tries | arithmetic slip | the working, never this sky's answer |
   | "True but unlinked" | "How does it link?" | typed a random true fact | names the arms to try |

   Next-step line always there (pure function `nextStep(sky)`), naming the arm and a starting point but never a whole fact: "Divide needs 2 more stars: start from 12." First-time tips on the Star Map and the first medal. "Replay the guide" on the Star Map.
8. **Learning design:** the maths is the move (every star is a true, linked fact; no choices to guess from). The model is the "how we know" line and the constellation arms (the seven ways facts link). Help follows the pupil: hint after a stall, "Show me" after two hints on one arm, fading as they light arms without hints (`shared/kit/help.ts`). Pacing: instant feedback, no holds. Progression: the facts follow the pupil's own times-table records, so harder anchors (and halves of odd numbers) arrive as they learn more; then Free sky.

   | Mistake | Its choice | "Why" line | What the picture does |
   |---|---|---|---|
   | doubles both numbers and the answer | 12 × 14 = 84 | "Double both and the answer is 4 times as big" | the arm line shows × 2 twice |
   | × 10 adds a zero to both | 60 × 70 = 420 | "Each × 10 makes it 10 times bigger: 4200" | two × 10 marks on the Tens arm |
   | near fact off by the wrong group | 6 × 8 = 49 | "6 × 8 is one more group of 6: 42 + 6" | groups drawn as dots |
   | halving an odd number | 3 × 7 = 22 | "Half of 42 is 21" | half bar |

Also: **lesson fit:** a sky fits 5 to 10 minutes and saves as it goes. **Who plays:** solo; no names, nothing shown to classmates. **Teacher:** see below. **Rewards:** points only (no coins).

## Teacher

- Code switch `src/games/starweb/switch.ts` and the teacher switch (`teacherSwitch: true`, column `starweb_enabled`, default on like every switch).
- `progressColumns`: "Star Web: 7/11 tables lit" on the Progress tab, plus a `teacher_progress_other_games` block.
- `hardest` for Today: the arm the class lit least this week, with its hint ("Hardly anyone halves yet: try 'halve one number' as a warm-up").
- Nothing to reset (no `teacher_set_starweb` settings in SW1 to SW4).

## Server, data and cost

- Function `starweb` (`handler.ts`, `entry.ts`): `map` (load), `open` (start or resume a sky), `save` (a batch of typed facts with times: the server re-runs `readFact`, `isTrue`, `linkOf`, `factKey` from `stars.ts` and the solo caps, and keeps only what holds), `finish` (medal, points once, achievements).
- Tables (RLS on, read through functions): `starweb_skies` (player, anchor, mode, stars jsonb, medal, hints, updated) and `starweb_stats` (player, lit, gold, stars). Migration number: next free was `20261125000500` on 25 Nov 2026; re-run `node scripts/migration-numbers.mjs` at SW1.
- Cost: map 1 + open 1 + a save every 4 stars or 20 s + finish 1: 6 to 8 calls a sky, about 200 a class a lesson. Small.

## Art, music, voice (reuse first)

| Need | Reuse | New painting (James's PC, ComfyUI) |
|---|---|---|
| Sky backdrop | `classlive/art/paint/back/star-sky.webp` | two more skies (dusk, aurora) shown at random |
| Star Map | drawn in code on `star-sky` | a star-map-at-night backdrop |
| Creatures | the whale line art (`StarSky.tsx`) | none: two more drawn in code (a falcon, a dragon) |
| Home card | copy of `pick/stars.webp` | the scene in Design 6 |
| Music | `classlive/music/stars.mp3` (`stars-hot.mp3` once a sky reaches silver) | none |
| Voice | Class Live's Star Web and HOWTO lines | ~25 new Bella lines (guide, medals, Star Map) |

Art plan file `docs/STARWEB-ART-PLAN.md` and `docs/starweb-art/config.json` come in SW4. Never wait for the paintings.

## Stages

| Stage | What | Live? |
|---|---|---|
| **SW1. One sky** | `shared/starweb/` (solo caps, medals, next-step line, config), migration, function `starweb` (`open`, `save`, `finish`), screens: one sky with the reused `StarSky`, keypad, feedback; preview `preview/starweb/`; code switch off | |
| **SW2. Star Map** | fact picked from the pupil's known tables, Star Map of tables 2 to 12, medals, resume, creatures, points (first 5 a day), achievements | |
| **SW3. Guide and help** | guided first go, lag hint → "Show me" ladder, mistakes "why" lines, first-time tips, Bella lines | |
| **SW4. Teacher, art plan, go live** | teacher switch, Progress column, Today `hardest`, home card stand-in, art plan, tests, screen checks; switch on for every class | |
| **SW5. Free sky** | type any × fact up to 12 × 12 as the known fact; an endless sky after the Star Map | |
| Art (evening, James's PC) | home card, Star Map backdrop, dusk and aurora skies | |

Rules for every stage: import from `shared/classlive/` and `src/games/classlive/`, never edit them from this branch; if Star Web solo needs a change there (say `StarSky` must take a smaller size), make it a tiny separate PR. Tests within the 8 for an older game (docs/TESTING.md).

## Built (25 Nov 2026)

- **Choices made while building:** Free sky opens after 5 lit skies (not after the whole Star Map, so keen pupils get it sooner); free skies light nothing and earn no points (practice). Help comes slowly (James, 25 Nov: "if kids get stuck it should slowly give them hints"): no new star for 20 s brings a nudge to the emptiest arm, 20 s more the hint with the fact's own numbers, 20 s more "Show me" (a worked example on 2 × 5 or 3 × 4); "I'm stuck" asks for the next rung at once; a new star takes the help back down. Every rung shown counts as help for "Every Way". A lit sky left open is finished (medal and points kept) when the pupil starts a new one. The guided first sky is 3 × 4. The seven arm names stay on the sky; the pad shows small coloured counts.
- **Today's "Hardest right now"** lists the arms that under half the class's skies this week lit (at most 2), with a warm-up idea.
- **Tables lit** measures end in `_step` (they follow the pupil's times tables), so the boards leave them out.

## Went live

- **25 Nov 2026 NZ:** SW1-SW5 merged in PR #846 (deploy green; tables, `starweb_enabled` on, function `starweb` live, outside callers refused). Switched on with a What's new line and the painted art (Star Map backdrop, dusk and aurora skies, home card; picks in `docs/starweb-art/picks.json`) in PR #848.
- **Art notes:** the aurora sky was repainted darker on 25 Nov 2026 (James: "Repaint"): almost black sky, a thin green glow low over the hills. Map try 3 left out (busy compass rose).
- **Next ideas (not planned):** creature pictures for whale, falcon and dragon.
