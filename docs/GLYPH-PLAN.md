# Glyph Gates: plan

**Status: plan only, nothing built (13 Nov 2026).** Migration number when building starts: `20261113000800` (`20261113000700` is held by Order Up's plan; check again with `node scripts/migration-numbers.mjs`). Game id `glyph`. Thread: "Plan the equivalent fractions glyph game". Source: James's mock-up (jungle temple wall, 4 × 4 fraction tiles, gold target stone, 4 glyphs, cheering monkeys), project files `glyph/glyph-mockup.png`.

## The short version
- Pupils are explorers trapped in an old jungle temple. Each **wall** is sealed by a **gold stone** showing a fraction (5/6).
- A 4 × 4 grid of stone **tiles** each carries a fraction. Pupils **tap every tile equal to the gold stone**; tapped tiles glow green. Tap again to put one out.
- The tiles that are right always make the shape of a **glyph** (a temple rune). Pupils press **Light the runes**, four glyphs slide out of the wall, and they pick the one that matches their glowing tiles. The right glyph opens the wall, the monkeys cheer, and on to the next.
- The three wrong glyphs are not random: each is the shape a **common mistake** would make (lighting 6/7 for 5/6, missing 25/30). So the glyph check catches the misconception and the show-why explains it.
- **9 walls make a temple** ("Trial 1 of 9"), **6 temples** go deeper into the jungle, ending at the Golden Sanctum. Each temple adds a new kind of equivalence.
- **Help for kids who need it:** a fraction bar under the gold stone, a lens that lays a tile's bar beside the gold stone's, then ×-arrows on top and bottom. It arrives after a mistake, fades with success, and never lights a tile for them.
- **Teacher:** on/off switch, an "Other games" Progress column (temples passed, of 6), the hardest gold stones and the most common mistake.
- **Look:** James's mock-up style: painted cartoon temple, mossy green stone, warm torchlight, gold. An original temple escape-room feel; no film names, characters or likenesses.

## Decisions
| Question | Recommendation | James chose |
|---|---|---|
| When the four glyphs appear | **After "Light the runes"**, so nobody can copy a glyph's shape onto the tiles before doing the maths | **After Light the runes** (13 Nov) |
| Escape-room timer | Calm temples with no clock; an optional **Escape run** (5 walls against a falling-sand timer, best time) opens after temple 3 | **Optional Escape run after temple 3** (13 Nov) |
| Build now? | Start with stages 1 to 3 (rules, server, first 3 temples) | **Build stages 1 to 3 now** (13 Nov) |
| Card group and years | `'complex-maths'`, Years 4 to 6 (equivalent fractions is MS.Y5.NUM.RN.P9; temples 1 to 2 suit Year 4) | recommendation |
| Name | Glyph Gates | recommendation |

## How a wall works (the rules)
1. The server makes the wall from a seed: a gold stone `n/d`, a **glyph** (one of ~30 hand-drawn rune shapes of 4 to 6 cells in a 4 × 4 grid), and 16 tiles. The cells of the glyph hold fractions equal to the gold stone (duplicates allowed, as in the mock-up's two 30/36s); every other cell holds a **trap tile**.
2. Trap tiles come from named mistakes (table below), tuned to the temple, so the wall is never a hunt among random numbers.
3. Three **trap glyphs** are the right glyph with 1 or 2 cells moved: a cell added where a mistake tile sits, or a right cell left out (usually the one with the biggest numbers). All four glyphs have the same number of cells, so counting doesn't give it away.
4. The pupil lights tiles, presses **Light the runes**, then the four glyphs appear (shuffled) and they pick one.
   - Lit tiles exactly right and the right glyph picked: the wall opens.
   - Lit tiles match a trap glyph and they pick it: the wall shakes, show-why on the wrong tile (or the missed one).
   - Lit tiles match no glyph: "None of the glyphs match your tiles. Look again." Counts as a wrong first go; no glyph is used up.
   - The glyphs go back into the wall after a wrong go, so the second go starts from the tiles again.
5. **Two goes a wall.** After the second wrong go, the right tiles glow gold one by one with their ×-arrows, and the wall opens with no star. Only the first go counts for records and stars.
6. **Pass a temple:** 7 of 9 walls opened first go. Replay any temple any time.

## Temples (steps)
| Temple | Name | Gold stones | Right tiles | Traps added |
|---|---|---|---|---|
| 1 | Mossy Gate | halves, thirds, quarters | ×2 to ×4 | add the same to top and bottom; same bottom |
| 2 | Snake Hall | fifths, sixths | ×2 to ×6 | times only the top or only the bottom |
| 3 | Waterfall Shrine | eighths, tenths | ×2 to ×10 | near misses (30/37) |
| 4 | Root Tunnel | not simplest (6/8, 20/24) | simpler and bigger (3/4, 15/20) | different multipliers top and bottom (10/18 for 5/6) |
| 5 | Bat Cave | twelfths, bigger numbers (45/54) | ×2 to ×12 | near misses with big numbers (20/25 beside 20/24) |
| 6 | Golden Sanctum | everything | mixed | all of them; one wall in three has a lit "simplest tile" to find |

Fractions stay under one, as the shared fraction skills do (no 7/4).

## Design (game-guide/1-design.md)
1. **Big goal:** reach the Golden Sanctum (pass all 6 temples), then gold on every wall. At 10 to 15 minutes, 3 days a week: temples 1 to 3 in about 2 weeks, all 6 in about a term. After that, Escape run best times.
2. **Season game?** No: nothing piles up that late joiners would miss.
3. **Play a day:** no limit; it's practice. Points stop at 40 a day already, and a temple gives points once a day (like Bond Match's cap), so no `UNLIMITED_GAMES` entry.
4. **Progress bars:** a jungle map with the 6 temples on a path; inside a temple a row of 9 wall stones (green = first go, grey = opened with help). `LevelBar` for the temple pass (7 of 9).
5. **Achievements** (temple ones end `_step`, so they stay off the board's maths ranking; kept at New Season):

   | Name | For (pupil words) | Measure | Number | Who gets it |
   |---|---|---|---|---|
   | First glyph | Open your first wall | `glyph_walls` | 1 | nearly everyone, day one |
   | Wall breaker | Open 50 walls | `glyph_walls` | 50 | many, steady play |
   | Temple runner | Open 200 walls | `glyph_walls` | 200 | some |
   | Mossy Gate | Pass temple 1 | `glyph_temple_step` | 1 | most |
   | Snake charmer | Pass temple 2 | `glyph_temple_step` | 2 | most |
   | Shrine seeker | Pass temple 3 | `glyph_temple_step` | 3 | many |
   | Root climber | Pass temple 4 | `glyph_temple_step` | 4 | some |
   | Bat dodger | Pass temple 5 | `glyph_temple_step` | 5 | some |
   | Golden Sanctum | Pass temple 6 | `glyph_temple_step` | 6 | few |
   | Quick escape | Escape run under 90 s (if Escape run is chosen) | `glyph_escape_best` | 90 | few |

6. **Home card scene:** an explorer's view of a carved jungle temple wall glowing with green rune tiles, a gold fraction stone in the middle, two cheeky monkeys on the vines, torchlight, no text. Prompt in `docs/glyph-art/config.json`.
7. **Guide for new players:** Mango the monkey (Bolt's role) walks the first wall: one lit thing at a time, real buttons, a 1/2 gold stone with easy tiles (2/4, 3/6, 4/8) so it can't fail. Saved on the server; "Replay the guide" on the temple screen. Next-step line under the grid, always there: "Find the tiles equal to 5/6. You've lit 2." / "Press Light the runes." / "Pick the glyph that matches your green tiles."

   | Moment | What the game does | Why a child gets stuck | Fix |
   |---|---|---|---|
   | First wall | Mango points at the gold stone, then one tile | doesn't know tiles are tapped | pointing hand on 2/4; "Tap every tile that's worth the same as the gold stone" |
   | Tiles lit | Light the runes pulses after the first tile | doesn't know when to stop | next-step line counts lit tiles; button always there |
   | Glyphs appear | Mango points from the green tiles to the glyphs | doesn't see the link between grid and glyph | the lit pattern rises off the grid as a ghost shape for the first 3 walls |
   | No glyph matches | wall rumbles, "Look again" | thinks the game is broken | line says what to do; a lens tip appears (help rung 2) |
   | Temple 4 (simplest) | demo the first time: 20/24 ÷ 4 = 5/6 | only knows "times up" | `useKindDemo` demo, then dividing arrows in help |
   | Big numbers (temple 5) | demo: 45/54, "what times 6 is 54?" | gives up on big numbers | times-table strip in help rung 3 |

8. **Learning design** (LEARNING-DESIGN.md section 6):
   - **The maths is the move:** you can't open a wall without the right tiles; the glyph only checks them. Glyphs hidden until "Light the runes" stops shape-copying; only the first go counts.
   - **Model and help ladder** (follows this child's results through `shared/kit/help.ts`, fades after 3 clean walls, back after 2 wrong):
     - Rung 1 (after a wrong wall, or the first wall of a new temple): a fraction bar under the gold stone.
     - Rung 2: tap the lens, then a tile: its bar slides beside the gold stone's bar, same length; equal or not shows by eye.
     - Rung 3: ×-arrows on the tapped tile: "5 × 4 = 20, 6 × 4 = 24", or for a trap "5 × 6 = 30, but 6 × 6 = 36, not 37". A times-table strip for big numbers. Never lights a tile.
   - **Pacing:** wall opens in 1.2 s (monkeys cheer over the next wall sliding in, no waiting); Bella reads the gold stone ("five sixths") and the next-step line; no clock in temples.
   - **Progression:** temples in research order (doubling families, then any multiplier, then simplifying, then big numbers); 1 wall in 4 reviews an earlier temple's kind.
   - **Mistakes** (`ShowWhy`, `shared/kit/mistakes.ts`):

   | Mistake | Its tile (gold 5/6) | "Why" line | What the picture does |
   |---|---|---|---|
   | Add the same to top and bottom | 6/7, 7/8 | "Adding 1 to the top and the bottom changes the size. Equal fractions times both by the same number." | bars side by side; 6/7 sticks out past 5/6 |
   | Times only one part | 5/12 | "Only the bottom was doubled, so each piece got smaller but you still have 5." | bar of twelfths, 5 shaded, half the length |
   | Near miss | 30/37 | "5 × 6 = 30, but 6 × 6 = 36, not 37." | ×-arrows, the bottom one turns red |
   | Different multipliers | 10/18 | "The top was times 2 but the bottom times 3. Both need the same." | two arrows with different numbers |
   | Same bottom only | 3/6 | "Same pieces, but 3 of them, not 5." | sixths bar with 3 shaded vs 5 |
   | Missed a right tile | 25/30 (not lit) | "25/30 is 5 × 5 over 6 × 5, so it's worth 5/6 too." | the missed tile glows gold with its arrows |
   | Didn't simplify (temple 4) | 5/6 for gold 20/24 | "20 ÷ 4 = 5 and 24 ÷ 4 = 6, so 5/6 is the same." | dividing arrows |

   - **Evidence:** per wall the gold stone, kind, tiles lit, glyph picked, first-go right, help rung reached, mistake names, ms. Stuck signal: a temple tried on 3 days without a pass.

**Also:**
- **Lesson fit:** a temple (9 walls) is 6 to 10 minutes; first 5 minutes is the guided wall and 4 walls of temple 1. Saves after every wall.
- **Who plays:** solo.
- **Teacher:** switch, Progress column, `hardest` (gold stones most often wrong), `alerts` (stuck), reset a pupil's temples. No other settings.
- **Rewards:** hub points per temple go (once a day per temple) and achievements. Wall stars are cosmetic (gold glyphs on the map).

## Maths: why this game makes its own walls
This game teaches one skill (equivalent fractions), so like Order Up and Basic facts training it doesn't follow the pupil's maths focus. The server makes every wall from a seeded engine in `shared/glyph/` and marks every go (the browser decides nothing). Each first go is one answer under the existing ladder key `equiv:same-as` (right only with no help past rung 1), through `recordMathsAnswers` with the `generated` pack's quick time, so it shows on the Skill map's equivalent fractions row. A key of its own (`equiv:find-all`) would be a shared maths PR; not needed to start.

## Steps and the Progress tab
| Step | Name | Moves up when |
|---|---|---|
| 1 to 6 | the temples | 7 of 9 walls first go in one temple go |

`progressColumns`: "Temples" (passed, of 6), plus a `teacher_progress_other_games` block. Saved per wall: `glyph_walls` rows; per pupil `glyph_progress` (temples passed, best stars, guide seen).

## Server, data and cost
Function `glyph`: `start` (temple → 9 walls from a fresh seed, stored in `glyph_walls_made`, which pupils can't read; sends the tiles only), `light` (lit cells → the four glyph shapes, saves the lit set), `pick` (glyph → marks, claims the go once, records). Tables `glyph_progress`, `glyph_goes`, `glyph_walls_made`. About 3 requests per wall: ~27 per pupil per temple, ~800 per class per lesson. Migration `20261113000800`.

## Stages
| Stage | What | Live? |
|---|---|---|
| 1 | Rules: wall maker, glyph library, trap tiles, marking (`shared/glyph/`), tests | no |
| 2 | Server function and migration (tables, achievements, `record_glyph`) | no |
| 3 | Screens: temple wall, grid, glyphs, map, temples 1 to 3, guided first wall, drawn stand-in art; teacher switch off | no |
| 4 | Help ladder, show-why, Bella lines | no |
| 5 | Temples 4 to 6, teacher part, Progress column; switch on | no |
| 6 | Painted art in (from the art plan) | no |
| 7 | Escape run (if chosen) | no |

## Art
`docs/GLYPH-ART-PLAN.md` and `docs/glyph-art/config.json`. Concept tries of the wall, home card, monkeys and stones were started on James's PC on 13 Nov 2026.
