# Goblin Storm: plan

*Name **Goblin Storm** (James picked it, 19 Nov 2026; id `goblinstorm`, CSS prefix `.gs-`). James, 19 Nov 2026: pupils want a "bullet heaven" game: "big attacks that can wipe out the entire screen, less damage shields, spinning blades, amazing graphics especially the attacks and lots of different characters to unlock that have different speeds and stuff." It is our own game, with our own name, heroes, monsters, maps and art. The genre (steer only, attacks fire by themselves, level-ups, evolving weapons) isn't owned by anyone; nothing is copied from any one game.*

**Status: stage 1 (plan, rules engine, 3 rule tests) merged from branch `claude/goblinstorm`. Not live; nothing pupils can see yet. Next: stage 2 (playable Canvas run).**

## The short version

- **Steer, don't shoot.** Pick a hero and a map, then survive **3 minutes** against growing swarms. Weapons fire by themselves. Drag anywhere to steer (touch) or use WASD/arrows (laptop).
- **Level-ups are maths.** Beaten monsters drop gems. When the gem bar fills, the game pauses for **one question from the pupil's own focus** (way A).
  - Right: pick from **3** upgrades. Right and quick: **4**.
  - Wrong: **2**, and the right answer shows. You never lose the level.
- **Evolutions wipe the screen.** A weapon at full level plus its matching passive offers an **Evolve!** card. Evolved weapons are much stronger, and every few seconds they unleash a screen-wide blast (Meteor Storm, Blizzard, Thunder God …). This is the only way to wipe the screen, so it feels earned.
- **8 heroes** with different speed, health, start weapon and trait. The Knight and Ranger are free. The other 6 are unlocked by challenges: beat a boss, survive 60 s without a hit, evolve 3 weapons in one run, and so on.
- **8 weapons, 10 passives, 3 kinds of shield.** The shields are the Armour passive (−1 damage a hit per level), the Bubble Shield (blocks a hit, then recharges) and the Spiky Shield (hurts monsters that touch you). Some heroes are also tough by nature.
- **5 maps**, each with its own monster family, a mini-boss at 1:30 and a boss at 2:30. Beat a map's boss to open the next map.
- **Between runs:** gold buys small forever-upgrades, 6 kinds × 5 levels, with the total boost capped. A **Weapon Codex** fills in as you discover weapons and evolutions. Achievements and a profile trophy are on offer, and the class hall of fame shows bosses beaten and best runs, never maths.
- **5 runs a day**, with the teacher's "Unlimited today" switch. **Easy maths group**, Years 3 to 6.

## Decisions (James's choices on question cards, 19 Nov 2026)
| Question | Recommendation | James chose |
|---|---|---|
| Where's the maths | Level-up questions | Level-up questions |
| Who | Years 3–6 | Years 3–6 |
| Theme | Night-time NZ bush | **Fantasy kingdom** |
| Run length | 5 min | **3 min** |
| Unlocks | Challenges | Challenges |
| Screen-wipes | Charge-up ultimate | **Only from evolutions** |
| Controls | Drag or keys | Drag or keys |
| Turns | Unlimited | **5 runs a day** |
| Carry-over | Small forever upgrades | Small forever upgrades |
| Shields | Armour passive | Armour, Bubble, Spiky, hero traits (all four) |
| Social | Class hall of fame | Class hall of fame |
| Art | Painted top-down | Painted top-down (ComfyUI on James's PC; attacks in code) |
| Name | Horde Breakers | **Goblin Storm** |
| Heroes | 8 | 8 |
| Weapons | All 8 | All 8 (spinning blades the star) |
| Wrong answer | Fewer choices | Fewer choices |
| Enemies | Goblin army | **Mixed monsters: a family per map** |
| Maps | 3 | **5** |
| Run rewards | Gold | Gold, achievements + trophy, Weapon Codex |

**My call, 19 Nov:** the boss comes at **2:30**, not 2:45, so there are 30 seconds to beat it. Beating the boss wins the run. Still standing at 3:00 without beating it counts as "Survived": gold, but the next map stays shut.

## Content (all numbers in `shared/goblinstorm/config.ts`)

**Heroes**

| Hero | Speed | Health | Starts with | Trait | Unlock |
|---|---|---|---|---|---|
| Knight | slow | very high | Spinning Blades | +2 armour | free |
| Ranger | fast | low | Arrows | +30% magnet | free |
| Wizard | medium | low | Fireball | +20% area | reach level 15 in a run |
| Barbarian | medium | high | Throwing Axes | up to +50% might as health drops | 1,000 monsters beaten in total |
| Cleric | slow | medium | Holy Aura | heals 1 health a second | beat the Castle Fields boss |
| Rogue | fastest | low | Lightning | 1 in 5 hits do double | survive 60 s without a hit |
| Frost Witch | medium | medium | Ice Nova | monsters 15% slower | beat the Frozen Peaks boss |
| Dragon Kid (secret) | medium | medium | Fireball | +1 armour, +10% might | evolve 3 weapons in one run |

**Weapons → evolution (needs passive)**: Spinning Blades → Blade Storm (Armour) · Fireball → Meteor Storm (Spell Tome) · Lightning → Thunder God (Crown) · Holy Aura → Sun Flare (Holy Water) · Ice Nova → Blizzard (Snow Crystal) · Throwing Axes → Axe Tornado (Gauntlets) · Arrows → Arrow Rain (Swift Boots) · Bubble Shield → Spiky Fortress (Spiky Shield).

**Passives:** Armour, Spiky Shield, Swift Boots, Spell Tome, Crown, Holy Water, Snow Crystal, Gauntlets, Magnet, Heart. You hold up to 4 weapons and 4 passives.

**Maps:**
1. Castle Fields: goblins, slimes, bats → Troll / Goblin King
2. Dark Forest: wolves, spiders, mushrooms → Giant Spider / Forest Ogre
3. Haunted Graveyard: skeletons, ghosts, zombies → Bone Knight / Lich
4. Frozen Peaks: ice imps, yetis, frost wolves → Yeti Chief / Ice Dragon
5. Lava Mines: fire sprites, magma golems, lava slugs → Golem / Fire Dragon

**Forever-upgrades:** Might +5%, Armour +1 (max 3), Speed +4%, Max health +10, Magnet +10%, Gold +5%. Each has 5 levels.

## Design (docs/game-guide/1-design.md)
1. **Big goal:** beat all 5 bosses, unlock all 8 heroes and fill the Weapon Codex (8 weapons + 8 evolutions). At 5 runs a day, 3 to 4 days a week, that's about 3 to 4 weeks for a steady player (the sim will check this in stage 4). Afterwards there are best runs on the hall of fame and boss wins with every hero.
2. **Season game?** No. Forever-upgrades are small and capped, so late joiners catch up in a few days.
3. **Play a day:** **5 runs** (James). The server counts finished *and* abandoned starts by NZ date. Add the game to `UNLIMITED_GAMES` and `teacher_set_unlimited_today()`. Extra turns give gold but no hub points.
4. **Progress bars:** the in-run gem bar and level; on the map screen, bosses beaten out of 5, heroes out of 8 and codex out of 16.
5. **Achievements:**

   | Name | For (pupil words) | Measure | Number | Who gets it | Kept |
   |---|---|---|---|---|---|
   | First Storm | Finish your first run | `goblinstorm_runs` | 1 | almost all, day 1 | yes |
   | It Evolves! | Evolve a weapon | `goblinstorm_evolutions` | 1 | most, week 1 | yes |
   | King Slayer | Beat the Goblin King | `goblinstorm_bosses` | 1 | most | yes |
   | Hero Collector | Unlock every hero | `goblinstorm_heroes` | 8 | some | yes |
   | Storm Master | Beat all 5 bosses | `goblinstorm_bosses` | 5 | few | yes |

   The profile trophy for beating the Goblin King goes through `award_trophy`.
6. **Home card** (16:9, about 1600×900, no text, flat storybook style, calm sky at the top). In the middle, a small knight stands on a castle field at dusk with glowing spinning blades around them, and a ring of goblins and slimes comes in from the edges. Prompt and config go in `docs/goblinstorm-art/config.json` in stage 2. Until it's painted the card is `NOT_PAINTED_YET`.
7. **Guide for new players:** the first run is guided on Castle Fields.
   - "Drag anywhere to move. Your hero attacks by themselves!"
   - At the first level-up: "Answer to power up. Right answers give more choices."
   - At the first weapon reaching full level: "Get its partner passive to evolve it!" (the card shows the partner).
   - At the mini-boss: a warning banner.
   - The next-step line on the map screen comes from a pure function (for example "Beat the Goblin King to open the Dark Forest").

   | Moment | What the game does | Why a child gets stuck | Fix |
   |---|---|---|---|
   | First seconds | Hero stands still, monsters come | doesn't know they only steer | pointing hand + "drag to move" until they move |
   | First level-up | Pauses with a question | thinks the game froze | Bella reads "Level up! Answer to choose a power." |
   | Choosing | 2–4 cards | can't tell weapons from passives | coloured frames + one-line words + level pips |
   | Evolution | Evolve card shows | doesn't know how | Codex shows each pair; the card for the partner passive is starred |
   | Dying early | Run ends | gives up | the end screen says what to try ("Pick Armour to take less damage") and shows gold earned |

   Also in the guide: the guided first go can be skipped and has a "Replay the guide" button. Who has seen it is kept in the server's save, so it follows the pupil to any device. First-time tips use `FirstTimeTip`, and the next-step line has "Show me". It never helps with the maths answer.
8. **Learning design: maths as a side part** (1-design.md: "it nudges, never decides").
   - **What the maths does.** It is not "the move" in this game: steering and choices win runs. A right answer gives one more upgrade card, and a quick right answer gives two more. That nudges which upgrades a pupil gets. A wrong answer gives 2 cards, so guessing costs you choice and never blocks play.
   - **Answering.** Each level-up is one question and only the first answer counts. There's no retry and no re-ask of that slot. There is no maths switch, because the maths is the level-up itself.
   - **Where the questions come from.**
     - `start` reads `space_maths_context` once and holds the focus for the whole run (`parseFocus`, `seededRandom`, `makeFocusPack` with the class's `multipleChoice`, `enabledTables`, `division`). It stores up to 40 questions.
     - After question 40 a level-up gives 3 cards with no question. Pick-only (`choiceLabels`) questions show their choices.
   - **Showing and timing.**
     - The question shows in the shared `QuestionModal` inside the full-window layer.
     - "Quick" is `quickMsForPack(pack)`.
     - Bella reads the question and the answer clock starts when she finishes (`speak(…, 'goblinstorm', onEnd)`).
     - A wrong answer shows the right one with the shared "why" line.
   - **Marking and the record.**
     - `goblinstorm_claim_answer` marks each slot once.
     - `recordMathsAnswers(…, \`${seed}:${slot}\`, 'goblinstorm')` records it, with the given value on wrong answers.
     - Add `'goblinstorm'` to `LADDER_GAMES` in `src/pages/SkillMap.tsx`.
   - **Not for this game:** the picture model, help ladder and `useKindDemo`, because these are fluency questions from the shared focus, and the focus system's own help and the Skill map cover them. There is no mistakes table of our own, because `QuestionModal`'s shared "why" lines are used.
   - **Evidence:** each answer (value, ms, first right) is saved on the run row. The teacher sees answers in the shared Skill map, never in this game.
   - **Before go-live:** score the game against `research-design.md` (3 on every line).

**Lesson fit:** a 3-minute "finished my work" reward with about 15 to 25 focus questions a run. **Who plays with whom:** solo; the hall of fame is own school, pupils only (teachers and hidden profiles left out), on the 🎮 Game boards tab. **Teacher:** an "Other games" column (bosses beaten, "zz" if not played, last played), the on/off switch (`goblinstorm_enabled` default true, `GAME_SWITCH_COLUMNS`, `teacher_set_goblinstorm(…, target_class)` with `require_settings_target()`), `hardest` and `alerts` from the shared focus. **Rewards and coins:** gold is spent only in the shop. The sim (`scripts/goblinstorm-sim.mjs`) checks that gold doesn't pile up unused once the shop is full. Once everything is bought, gold is shown as "best haul" only. **Hub points** go through `add_game_points(player, 'goblinstorm', points, seed)`: 5 for a finished run, +5 for a boss win. They count only on normal turns, within the 40-a-day cap, and write a `scored_games` row so the effort boards count it.

**Season:** `season_fn = null`, `keep_achievements = true`. New Season keeps gold, the shop, heroes, maps and the codex; only hub points go.

**Achievements in full** (copy the `hub_games` rows, `achievement_measures`, `counts_fn`, `rules_fn`, `players_fn` and `last_played_fn` from Toon Flap):

| Name | Tier | `how` (pupils see) | Measure | Number |
|---|---|---|---|---|
| First Storm | easy | Finish a Goblin Storm run. | `goblinstorm_runs` | 1 |
| It Evolves! | medium | Evolve a weapon in Goblin Storm. | `goblinstorm_evolutions` | 1 |
| King Slayer | medium | Beat the Goblin King. | `goblinstorm_bosses` | 1 |
| Hero Collector | hard | Unlock all 8 Goblin Storm heroes. | `goblinstorm_heroes` | 8 |
| Storm Master | hard | Beat all 5 Goblin Storm bosses. | `goblinstorm_bosses` | 5 |

Trophy: a `trophy_types` row "Goblin King's Crown" ("Beat the Goblin King in Goblin Storm"), awarded by trigger as in migration 20261112001700. It is never for maths. The result screen uses `<AchievementPop>` and `<TrophyWonLine>`.

**5 a day:** the server counts by `nzDate` and refuses a 6th run with "All done for today. See you tomorrow!". With "Unlimited today" (`isUnlimitedFor` / `unlimited_today(player, 'goblinstorm')`, `UNLIMITED_GAMES` in `shared/unlimited.ts`), normal turns are used first, and extra turns give gold but no hub points.

**Saved per go** (`goblinstorm_runs`, unique on (player, seed), so a run sent twice counts once): hero, map, steering, picks, outcome, seconds, level, kills, gold, evolutions and each question's value, ms and first-right. A replay refuses a slot that isn't in the stored questions. This is an older game, so there's no `slips` or `step`.

## Steps and the Progress tab
Not a stepped game (older route). The teacher's Progress tab gets one number: bosses beaten (0–5).

## Server, data and cost
- **Function `goblinstorm`.** `start` checks the switch and the 5-a-day count, stamps a seed and stores up to 40 questions. `answer` marks a slot once and returns how many choices you get. `finish` replays the run and saves it. `buy` and `codex` handle the shop and the codex.
- **Replay.** The run is pure and seeded (`shared/goblinstorm/engine.ts`). The browser sends its steering, one of 17 directions per step, run-length encoded, plus its upgrade picks. The server replays these with the choice counts the marks gave and works out the result itself: time, kills, level, bosses, gold, evolutions and unlocks. A run can't finish faster than real time (95%). The replay must stay well inside the function's CPU budget, which a stage 1 test checks.
- **Determinism.** The engine uses only `+ − × ÷` and `Math.sqrt`, never `sin`, `cos`, `atan2`, `hypot` or `Math.random`. Directions come from a written-out table (`trig.ts`). The renderer may use real trig for drawing.
- **Tables:** `goblinstorm_saves` (gold, shop levels, heroes, maps, codex, totals), `goblinstorm_runs` and `goblinstorm_questions`. All have RLS on and pupils reach them only through functions. `goblinstorm_questions` has no policy and no grant. The functions are `goblinstorm_store_questions`, `_load_questions` and `_claim_answer`, plus `record_goblinstorm_*`. Every new `authenticated` function goes on the `security.test.sql` allow-list.
- **Migration number** `20261119000900` (checked 19 Nov; recheck before stage 3). It sits in `supabase/migrations-on-hold.txt` until the go-live PR.
- **Cost:** a run is 1 start, about 20 answers and 1 finish. A class of 30 playing 5 runs in a lesson makes about 3,300 requests, spread over the lesson.

## Files
- `shared/goblinstorm/` holds the rules and config.
- `supabase/functions/goblinstorm/` is the server function.
- `src/games/goblinstorm/`: `index.tsx` (GameDefinition, `group: 'easy-maths'`, `teacherSwitch: true`, colours, Icon), `switch.ts`, `teacher.ts`, `HubButtons.tsx`, `voiceLines.ts`, CSS with the `.gs-` prefix.
- `preview/goblinstorm/` is a preview with no sign-in and a fixed pretend focus that never calls the live site.
- `scripts/goblinstorm-sim.mjs` is the balance sim; bot runs go there, not in tests.
- `docs/GOBLINSTORM-ART-PLAN.md`, `docs/goblinstorm-art/config.json` and `public/voice/goblinstorm/`.
- Shared one-line edits after merging `main`: registry, `registry.test.ts`, `FUNCTIONS`, `package.json` scripts, `shared/README.md`, `docs/PRIVACY-SUMMARY.md` (what's stored: gold, shop, heroes, codex, runs; the board shows bosses and best runs by display name, never maths).
- **Full window:** `position: fixed; inset: 0; z-index: 40`, canvas `100dvh`, own ⌂ Hub and sound buttons, and the question modal inside the layer. Nothing scrolls sideways. Check at 1366×640, 1024×768, 820×1180, 844×390 and 390×844, with 44 px targets and reduced motion respected.

## Tests (TESTING.md: at most 8 for an older game)
- **3 rule tests:** (1) the same seed and inputs give the same run, and the steering codec round-trips; (2) a replay matches a live run, refuses a made-up one, and a whole 3-minute run replays inside the time budget; (3) offers, choice counts and evolution.
- **3 server tests:** refusals (switch off, 6th run, too fast, another pupil's seed); a slot marked once and recorded; a test that runs every `LADDER` skill (copy `shared/archery/server.test.ts`).
- **2 screen tests:** a level-up shows the question then the right number of cards; the voice-lines test.
- `supabase/tests/database/goblinstorm.test.sql` (doesn't count).
- Balance is checked in the sim, not in tests.

## Stages
Art and voice never hold anything up. The game is built and goes live with drawn stand-ins.

| Stage | What | Live? |
|---|---|---|
| 1 | This plan; seeded engine, config with all content, steering codec, replay; the 3 rule tests | no |
| 2 | Playable Canvas run with drawn stand-ins, full window, level-up cards, the preview; art plan + `config.json` with the home card | no |
| 3 | Server: start/answer/finish, way A, replay check, 5-a-day, switch, migration (on hold), saving; the 3 server tests | no |
| 4 | Hero picker and unlocks, map picker, all bosses; balance sim | no |
| 5 | Gold shop, Weapon Codex, achievements, trophy, hall of fame, teacher column, points | no |
| 6 | Effects pass, sounds, Bella voice, guided first go, quality settings; 2 screen tests | no |
| 7 | Go live: ready check (`templates/golive-pr.md`), take the migration off hold, after-merge checks; then the code switch PR (`ON = true`) | — |
| 8 | James paints the art on his PC whenever he likes; swap stand-ins (any time, even after live) | — |

After **every** merge: the Status line here, project memory, and the next prompt on the Prompts board. At go-live, also add a "What's new" line, update the players tracker and delete the branch.

## Stage 1 results
- **Built:** `shared/goblinstorm/`. It holds `config.ts` (all 8 heroes, 8 weapons with evolutions, 10 passives, 5 maps, waves, shop, gold), `engine.ts` (seeded steps, pooled monsters, shots and gems, a collision grid, level-up offers, evolution blasts), `replay.ts` (steering codec, replay check), `trig.ts` (written-out cos and sin), `random.ts` (copied from Diamond Drop) and `bot.ts`.
- **Tests:** 3 rule tests (determinism and codec; replay matches, made-up runs refused, quit; offers, choice counts, evolution and blast).
- **Replay speed:** a whole 3-minute run with 320 monsters replays in about 0.15 s on the Mac. That leaves plenty of room inside the server's CPU limit.
- **Balance so far** (simple bot that runs away and doesn't chase gems):
  - Castle Fields: most heroes survive at levels 9–29.
  - Lava Mines: every fresh hero falls within 80 s.
  - Stage 4's sim must tune map tiers, the gem curve and wave sizes, aiming for about 15–25 level-ups a run. Map 1 should be beatable on day 1, and later maps should need shop upgrades and better heroes.
- **Not done yet:** a determinism fingerprint across Node, Chromium and WebKit (copy Marble's), planned for stage 2 once the browser plays it.

## Went live
(fill in)
