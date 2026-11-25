# Star Web solo: plan

*James, 25 Nov 2026: "some kids really love the star web game! can you plan how we can turn this into a single player game on the main dash please!" Id `starweb`, CSS prefix `.sw-`, group `'complex-maths'` (next to Class Live). Older-pupil route, Years 3 to 6.*

**Status: plan only (this PR). Nothing built. Stages SW1 to SW5 below; James's three choices are on question cards, the plan is written on my recommendations meanwhile.**

## The short version

- **Same game, one player.** One known fact glows in the night sky (6 × 7 = 42). The pupil types facts they can work out from it (7 × 6, 42 ÷ 6, 12 × 7, 60 × 7, 3 × 7 ...). Each true, linked fact shoots a star into one of the seven arms (Turn around, Divide, Double, Halve, Tens, Near facts, Wild links) with its "how we know" line. Light every arm and the sky creature draws itself.
- **Reuse almost everything.** The fact reader, checker and link finder are the class game's pure rules (`shared/classlive/stars.ts`, imported, never changed). The sky is the class game's `StarSky` and `NightBackdrop` (`src/games/classlive/StarSky.tsx`), the arm colours and hints are `arms.ts`, the painted night sky, the Star Web music and Bella's Star Web lines all exist.
- **The big goal: a Sky Atlas.** 21 constellations, one per known fact, in three chapters that open in order: Small (3 × 4 ... 4 × 6), Middle (6 × 7 ... 6 × 8), Big (6 × 12 ... 7 × 11). These are the class game's three `LEVELS`. Each constellation earns bronze (every arm lit), silver (25 stars) or gold (supernova, 30 stars). Finishing a chapter adds a new line-art creature to the Atlas.
- **No clock at all** (James, 25 Nov 2026): pupils light a sky at their own pace, so they think. No race mode.
- **Help follows the pupil:** a nudge to the emptiest arm (as now), the lag hint with the fact's own numbers when they stall, then "Show me" with a worked example on a *different* fact. Never this sky's answers.
- **Server in charge:** the browser checks each fact at once with the shared rules for instant feedback; the server re-checks every fact with the same rules when it saves (every few stars and at the end). About 4 to 8 calls a sky.
- **Teacher:** an on/off switch, an "Other games" Progress column (constellations lit), and a Today line on the arm the class finds least ("Hardly anyone halves yet").

## Decisions

| Question | Recommendation | James chose |
|---|---|---|
| A clock? | No clock to light a sky; 3-minute Night Race opens after 5 lit skies | **No clock at all** (25 Nov) |
| How much a day? | No limit; the first 5 skies a day earn hub points | (card) |
| Where the starting fact comes from | A Sky Atlas of 21 constellations in 3 chapters | (card) |
| Name | Keep **Star Web** (pupils know it); card subtitle "Fill the Sky Atlas" | mine |
| Group | `complex-maths`, beside Class Live | mine |
| Ladder answers | Not recorded (open-ended facts aren't ladder questions, as in Class Live) | mine |

## How a sky plays

1. **Sky Atlas** (the game's home): a dark star map with three chapter skies. Lit constellations glow with their medal; the next one to try pulses. Tap one to open it.
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

1. **Big goal:** fill the Sky Atlas: 21 constellations lit (bronze), then gold on all 21. A lit sky takes a strong Year 5 about 5 to 8 minutes (19 stars), so 2 to 3 skies a session: all 21 lit in about 3 weeks at 3 to 4 days a week; gold on all takes a term. After that: a **Free sky** (type any × fact up to 12 × 12) that never ends.
2. **Season game?** Not for this game: nothing piles up that late joiners can't catch.
3. **Play a day:** no limit (it's practice). Hub points for the first 5 skies a day (`add_game_points`, writes `scored_games`, so it counts for Hard workers): 2 for bronze, 3 silver, 4 gold. Not in `UNLIMITED_GAMES` (nothing to unlock).
4. **Progress bars:** on the Atlas, a bar "14 of 21 lit" and a chapter bar; in a sky, the seven arm meters and a star count towards 25 and 30.
5. **Achievements** (`hub_games`):

   | Name | For (pupil words) | Measure | Number | Who gets it | Kept at New Season |
   |---|---|---|---|---|---|
   | First Light | Light every arm of a sky | `starweb_lit` | 1 | most, day one | yes |
   | Star Finder | Find 100 new facts | `starweb_stars` | 100 | many, week 1 to 2 | yes |
   | Every Way | Light a sky without a hint | `starweb_nohint` | 1 | about half | yes |
   | Supernova | Get gold on a sky | `starweb_gold` | 1 | about half | yes |
   | Chapter Done | Light every sky in a chapter | `starweb_chapter` | 1 | many | yes |
   | Sky Atlas | Light all 21 skies | `starweb_lit` | 21 | some | yes |
   | Golden Atlas | Gold on all 21 skies | `starweb_gold` | 21 | a few | yes |

6. **Home card:** `src/assets/home/starweb.webp` + `-small`. Stand-in: a copy of Class Live's painted `pick/stars.webp`. Scene to paint: "a child on a hilltop at night with a telescope, a glowing constellation web of seven coloured arms above, a whale drawn in starlight lines, deep blue, no writing".
7. **Guide for new players:** a guided first go on the first constellation (3 × 4), using the real keypad, one lit-up thing at a time.

   | Moment | What the game does | Why a child gets stuck | Fix |
   |---|---|---|---|
   | First sky | Bella: "We know 3 × 4 = 12. What else do we know?" | doesn't know what "a fact" is here | guided go: the Turn arm pulses, keypad shows "4 × 3 = ?" ghost layout; success can't fail |
   | First star | star shoots, "how we know" read aloud | doesn't see why it counted | the line stays on the card until the next send |
   | Stall (no new star for 20 s) | lag hint for the emptiest arm with the fact's numbers (`lagHint`) | no idea how to halve or use tens | "Show me": a worked example on another fact (2 × 5 → 4 × 5), then back |
   | Wrong answer | "Not quite" + working after 2 tries | arithmetic slip | the working, never this sky's answer |
   | "True but unlinked" | "How does it link?" | typed a random true fact | names the arms to try |

   Next-step line always there (pure function `nextStep(sky)`), naming the arm and a starting point but never a whole fact: "Divide needs 2 more stars: start from 12." First-time tips on the Atlas and the first medal. "Replay the guide" on the Atlas.
8. **Learning design:** the maths is the move (every star is a true, linked fact; no choices to guess from). The model is the "how we know" line and the constellation arms (the seven ways facts link). Help follows the pupil: hint after a stall, "Show me" after two hints on one arm, fading as they light arms without hints (`shared/kit/help.ts`). Pacing: instant feedback, no holds. Progression: Small, Middle, Big chapters, then Free sky and decimals (halves of odd numbers appear in Middle).

   | Mistake | Its choice | "Why" line | What the picture does |
   |---|---|---|---|
   | doubles both numbers and the answer | 12 × 14 = 84 | "Double both and the answer is 4 times as big" | the arm line shows × 2 twice |
   | × 10 adds a zero to both | 60 × 70 = 420 | "Each × 10 makes it 10 times bigger: 4200" | two × 10 marks on the Tens arm |
   | near fact off by the wrong group | 6 × 8 = 49 | "6 × 8 is one more group of 6: 42 + 6" | groups drawn as dots |
   | halving an odd number | 3 × 7 = 22 | "Half of 42 is 21" | half bar |

Also: **lesson fit:** a sky fits 5 to 10 minutes and saves as it goes. **Who plays:** solo; no names, nothing shown to classmates. **Teacher:** see below. **Rewards:** points only (no coins).

## Teacher

- Code switch `src/games/starweb/switch.ts` and the teacher switch (`teacherSwitch: true`, column `starweb_enabled`, default on like every switch).
- `progressColumns`: "Star Web: 14/21 lit" on the Progress tab, plus a `teacher_progress_other_games` block.
- `hardest` for Today: the arm the class lit least this week, with its hint ("Hardly anyone halves yet: try 'halve one number' as a warm-up").
- Nothing to reset (no `teacher_set_starweb` settings in SW1 to SW4).

## Server, data and cost

- Function `starweb` (`handler.ts`, `entry.ts`): `atlas` (load), `open` (start or resume a sky), `save` (a batch of typed facts with times: the server re-runs `readFact`, `isTrue`, `linkOf`, `factKey` from `stars.ts` and the solo caps, and keeps only what holds), `finish` (medal, points once, achievements).
- Tables (RLS on, read through functions): `starweb_skies` (player, anchor, mode, stars jsonb, medal, hints, updated) and `starweb_stats` (player, lit, gold, stars). Migration number: next free was `20261125000500` on 25 Nov 2026; re-run `node scripts/migration-numbers.mjs` at SW1.
- Cost: atlas 1 + open 1 + a save every 4 stars or 20 s + finish 1: 6 to 8 calls a sky, about 200 a class a lesson. Small.

## Art, music, voice (reuse first)

| Need | Reuse | New painting (James's PC, ComfyUI) |
|---|---|---|
| Sky backdrop | `classlive/art/paint/back/star-sky.webp` | Small chapter: dusk sky; Big chapter: aurora sky |
| Atlas map | drawn in code on `star-sky` | an old star-map parchment-at-night backdrop |
| Creatures | the whale line art (`StarSky.tsx`) | none: two more drawn in code (a falcon, a dragon) |
| Home card | copy of `pick/stars.webp` | the scene in Design 6 |
| Music | `classlive/music/stars.mp3` (`stars-hot.mp3` once a sky reaches silver) | none |
| Voice | Class Live's Star Web and HOWTO lines | ~25 new Bella lines (guide, medals, Atlas) |

Art plan file `docs/STARWEB-ART-PLAN.md` and `docs/starweb-art/config.json` come in SW4. Never wait for the paintings.

## Stages

| Stage | What | Live? |
|---|---|---|
| **SW1. One sky** | `shared/starweb/` (solo caps, medals, next-step line, config), migration, function `starweb` (`open`, `save`, `finish`), screens: one sky with the reused `StarSky`, keypad, feedback; preview `preview/starweb/`; code switch off | |
| **SW2. Sky Atlas** | Atlas map, 3 chapters opening in order, medals, resume, creatures, points (first 5 a day), achievements | |
| **SW3. Guide and help** | guided first go, lag hint → "Show me" ladder, mistakes "why" lines, first-time tips, Bella lines | |
| **SW4. Teacher, art plan, go live** | teacher switch, Progress column, Today `hardest`, home card stand-in, art plan, tests, screen checks; switch on for every class | |
| **SW5. Free sky** | type any × fact up to 12 × 12 as the known fact; an endless sky after the Atlas | |
| Art (evening, James's PC) | home card, Atlas map, dusk and aurora skies | |

Rules for every stage: import from `shared/classlive/` and `src/games/classlive/`, never edit them from this branch; if Star Web solo needs a change there (say `StarSky` must take a smaller size), make it a tiny separate PR. Tests within the 8 for an older game (docs/TESTING.md).

## Went live

Nothing yet. Next prompt is on the Games Hub Prompts board (`starweb-sw1`).
