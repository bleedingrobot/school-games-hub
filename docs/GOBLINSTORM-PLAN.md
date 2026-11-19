# Goblin Storm: plan

*Name **Goblin Storm** (James picked it, 19 Nov 2026; id `goblinstorm`, CSS prefix `.gs-`). James, 19 Nov 2026: pupils want a "bullet heaven" game: "big attacks that can wipe out the entire screen, less damage shields, spinning blades, amazing graphics especially the attacks and lots of different characters to unlock that have different speeds and stuff." It is our own game, with our own name, heroes, monsters, maps and art. The genre (steer only, attacks fire by themselves, level-ups, evolving weapons) isn't owned by anyone; nothing is copied from any one game.*

**Status: LIVE 19 Nov 2026 for every class. Go-live PR #622 (migration `20261119000900`, hub entry, Unlimited today, Progress column, What's new) and switch PR #623 (`GOBLINSTORM_ON = true`). Art (stage 8) painted and in. Players tracker still to add (see Went live). Bonus Turns (class quest reward) doesn't cover Goblin Storm yet. 20 Nov 2026: heroes slower to unlock (Wizard level 35, Barbarian 20,000 monsters, Rogue 120 s unhit) and the shop half as dear again (150/300/500/800/1,200, 15,700 in all), migration `20261120000100` (#625). Then a little harder (monster health × (1 + s/90), was /120; gentle start 20 s, was 30) and a Gold card on every level-up, after the cards the answer earned (#626). Class quests Daily Storm (2 finished runs on 5 days) and Storm Chaser (12 in a week), and the Fire Dragon's Scale trophy, migration `20261120000400`, quest banners painted. Then a tougher ending: common, fast and tough monsters born from 2:00 have × 1.5 health and from 2:30 × 2, on top of the growth (mini-boss and boss unchanged). Sim, 4 seeds: bot falls with no shop 77 of 160 runs (was 69), half shop 46 (39), whole shop 19 (11).**

## The short version

- **Steer, don't shoot.** Pick a hero and a map, then survive **3 minutes** against growing swarms. Weapons fire by themselves. Drag anywhere to steer (touch) or use WASD/arrows (laptop).
- **Level-ups are maths, every third one.** Beaten monsters drop gems. When the gem bar fills you level up. **Every 3rd level-up** (the 2nd, 5th, 8th…) pauses for **one question from the pupil's own focus** (way A); the others go straight to 3 cards. James, 19 Nov 2026, after trying it: a question at every level-up meant you "can't really play".
  - Right: pick from **3** upgrades. Right and quick: **4**.
  - Wrong: **2**, and the right answer shows. You never lose the level.
- **Evolutions wipe the screen.** A weapon at full level plus its matching passive offers an **Evolve!** card. Evolved weapons are much stronger, and every few seconds they unleash a screen-wide blast (Meteor Storm, Blizzard, Thunder God …). This is the only way to wipe the screen, so it feels earned.
- **8 heroes** with different speed, health, start weapon and trait. The Knight and Ranger are free. The other 6 are unlocked by challenges: beat a boss, survive 90 s without a hit, evolve 3 weapons in one run, and so on.
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
| Wizard | medium | low | Fireball | +20% area | reach level 20 in a run |
| Barbarian | medium | high | Throwing Axes | up to +50% might as health drops | 5,000 monsters beaten in total |
| Cleric | slow | medium | Holy Aura | heals 1 health a second | beat the Castle Fields boss |
| Rogue | fastest | low | Lightning | 1 in 5 hits do double | survive 90 s without a hit |
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
1. **Big goal:** beat all 5 bosses, unlock all 8 heroes and fill the Weapon Codex (8 weapons + 8 evolutions). At 5 runs a day, 3 to 4 days a week, that's about 3 to 4 weeks for a steady player (stage 4 sim: all bosses and heroes in about 6–10 school days; the whole shop, the Codex and boss wins with every hero take longer). Afterwards there are best runs on the hall of fame and boss wins with every hero.
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
     - `start` reads `space_maths_context` once and holds the focus for the whole run (`parseFocus`, `seededRandom`, `makeFocusPack` with the class's `multipleChoice`, `enabledTables`, `division`). It stores up to 14 questions (`QUESTIONS_PER_RUN`).
     - Only every 3rd level-up asks (`ASK_EVERY`, `questionSlot`); after question 14, or between asks, a level-up gives 3 cards with no question. Pick-only (`choiceLabels`) questions show their choices.
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

**Lesson fit:** a 3-minute "finished my work" reward with about 6 to 8 focus questions a run (every 3rd level-up). **Who plays with whom:** solo; the hall of fame is own school, pupils only (teachers and hidden profiles left out), on the 🎮 Game boards tab. **Teacher:** an "Other games" column (bosses beaten, "zz" if not played, last played), the on/off switch (`goblinstorm_enabled` default true, `GAME_SWITCH_COLUMNS`, `teacher_set_goblinstorm(…, target_class)` with `require_settings_target()`), `hardest` and `alerts` from the shared focus. **Rewards and coins:** gold is spent only in the shop. The sim (`scripts/goblinstorm-sim.mjs`) checks that gold doesn't pile up unused once the shop is full. Once everything is bought, gold is shown as "best haul" only. **Hub points** go through `add_game_points(player, 'goblinstorm', points, seed)`: 5 for a finished run, +5 for a boss win. They count only on normal turns, within the 40-a-day cap, and write a `scored_games` row so the effort boards count it.

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
- **Function `goblinstorm`.** `start` checks the switch and the 5-a-day count, stamps a seed and stores up to 14 questions. `answer` marks a slot once and returns how many choices you get. `finish` replays the run and saves it. `buy` and `codex` handle the shop and the codex.
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

## Stage 2 results
- **Built:** `src/games/goblinstorm/`:
  - `GoblinStormGame.tsx` holds the hero, map and end screens.
  - `PlayScreen.tsx` has the fixed 1/60 s loop copied from Toon Flap, the floating stick and WASD/arrows, the level-up question in the shared QuestionModal, and then the cards.
  - `renderer.ts`, `fx.ts` and `look.ts` are the drawn stand-in art, pooled particles, glow, shake and the evolution flash.
  - `backend.ts` is the server shape stage 3 must meet (start, answer, finish), plus `standInBackend`, which marks in the browser and replays with `replayRun`.
  - `HubButtons.tsx` and `goblinstorm.css` (all `.gs-`).
- **Preview:** `preview/goblinstorm/`, using a pretend focus of the times tables. Add `?mc=1` for pick-an-answer questions. To run it: `npx vite --config vite.goblinstorm-preview.config.ts`. To build it: `npm run goblinstorm:preview`.
- **Recording:** steering is recorded only for real steps, in the order `replayRun` uses (end check, then waiting check, then step). Runs played in the preview, by keyboard and by touch, came back valid from the replay.
- **Determinism:** `shared/goblinstorm/determinism.ts` plays every hero on every map with random steering and picks (540 state lines). `npm run goblinstorm:determinism` gives fingerprint `ba14927f` in Node, WebKit and Chromium (set `PLAYWRIGHT_DIR` to a folder with Playwright to include the browsers).
- **Browser check** (Playwright on the Mac's GPU, at 1366×640, 1024×768, 820×1180, 844×390 and 390×844):
  - Full window at every size, with no sideways scroll.
  - 320 monsters ran at a steady 60 fps, with about 1 ms of drawing a frame.
  - The Blade Storm evolution cleared 320 monsters down to 40–50 newcomers. Bosses stay, as the engine says.
  - The question shows above the play layer, then the cards: 2 after a wrong answer, with Evolve! first.
  - In the software-only headless browser it ran at 30 fps. That's a graphics-card effect, not our drawing; the game drops its particles to 45% when frames run slow.
- **Dev-only hook:** `window.__goblinstorm` (only on the dev server, never in a build) lets browser checks jump ahead. Builds don't include it.
- **For the stage 4 sim:** a Ranger standing still fell at 0:14, while one who moved lasted 0:50. That's harsh for a first go; check it when tuning.
- **Not done (by plan):** no hub registration, no migration, no tests (the 2 screen tests are stage 6), no sounds yet, and only Knight, Ranger and Castle Fields open until saves exist.

## Stage 3 results
- **Built:** `shared/goblinstorm/server.ts` (`handleGoblinStorm`: `start`, `answer`, `finish`) with `memoryServices.ts` for tests; the function `supabase/functions/goblinstorm/` (`handler.ts`, `entry.ts`, built `index.ts`, in `FUNCTIONS`); `src/games/goblinstorm/liveBackend.ts` and `switch.ts` (`GOBLINSTORM_ON = false`; the preview keeps `standInBackend`).
- **start:** switch check, 5 runs a day by NZ date (Unlimited today from `settings_of().unlimited_days.goblinstorm` lifts it; such runs are marked `extra`), hero and map must be open in the save, then a fresh seed and up to 14 way-A questions from `space_maths_context`. The browser gets only `publicQuestion`s.
- **answer:** marks a slot once (`goblinstorm_claim_answer`) as wrong, right or quick (each question's own pack quick time), records it with `recordMathsAnswers(…, '${seed}:${slot}', 'goblinstorm')`, and says the answer and the fact. A second answer to the slot gets the first mark back.
- **finish:** decodes the steering, replays it with `replayRun` and the server's marks (`choicesFor`), refuses a run shorter than 95% of real time (`too-fast`) or one that doesn't replay (`not-valid`), then `record_goblinstorm_run` saves the summary, gold and bosses beaten, once.
- **Migration `20261119000900_goblinstorm.sql` (on hold, not live):** `goblinstorm_saves`, `goblinstorm_runs`, `goblinstorm_questions` (no policies, nothing granted), the server-only functions, `goblinstorm_enabled` default true, `teacher_set_goblinstorm` (on the security allow-list), `goblinstorm_last_played` and the `hub_games` row.
- **Maths change (James, 19 Nov):** only every 3rd level-up asks, so 6–8 questions a run; `QUESTIONS_PER_RUN` 40 → 14. The fingerprint is still `ba14927f`.
- **Tests:** 3 server tests + the deployable-file check; `supabase/tests/database/goblinstorm.test.sql` (30 checks) passes on a clean copy, as does `security.test.sql`.
- **Left for later stages:** `GAME_SWITCH_COLUMNS`, `UNLIMITED_GAMES` and `teacher_set_unlimited_today` wait for go-live (the column isn't live while the migration is on hold). Hub points, the shop, unlocks, achievements and `my_goblinstorm()` for the screens come in stages 4–5.

## Stage 4 results
- **Built:**
  - Hero picker: all 8 heroes with speed, health and starting weapon; locked heroes say what opens them (`UNLOCK_WORDS`, made from `UNLOCK_AT`); `heroOpen(save)` decides.
  - Map picker: `mapOpen(save)` decides; beaten bosses show 👑. The hero screen shows "Heroes x/8 · Bosses beaten x/5".
  - The end screen shows "New hero: …" (the finish reply's `unlocked`) and "New map open: …".
  - `GoblinStormBackend.me()`: live it reads `my_goblinstorm()`; the stand-in keeps a pretend save in the page. The preview's `?open=all` opens everything.
  - Every map already had its own mini-boss and boss look (stage 2). A browser check at 1:32 and 2:32 on each map saw each one drawn, with its own banner.
- **Unlocks on the server:**
  - `newUnlocks(save, summary, map)` in `server.ts` (the function's finish reply).
  - The same rules in `record_goblinstorm_run`, from the replay's summary only, never from the browser: Wizard level ≥ 20; Barbarian 5,000 monsters (raised 20 Nov: see Status) in total (new `goblinstorm_saves.kills`); Cleric beats map 1's boss; Rogue 90 s unhit; Frost Witch beats map 4's boss; Dragon Kid 3 different evolutions. Heroes are never added twice.
  - `my_goblinstorm()`: authenticated, the caller's own save only (gold, shop, heroes, bosses, codex, runs, kills, runs today). It is on the security allow-list.
- **Fixes:**
  - The runs table's outcome check said `'fell'`, but the engine says `'lost'`. It now allows `'lost'`.
  - Text literals in `earned || '…'` were read as arrays. They are now `'…'::text`.
- **Balance sim:** `node scripts/goblinstorm-sim.mjs [--seeds N] [--only still|grid|journey]`. It uses `botRun` with the new `sensibleDirection` (keeps away from monsters, walks to near gems) and `sensiblePick` (evolve, then level up held weapons, heal when low). Answers are 65% right, 20% quick and 15% wrong. It runs in worker threads, about 25 s.
- **Tuning** (all in `config.ts`):
  - Gem curve `3 + 2·level` → `2 + level`.
  - Map tiers 1/1.4/1.9/2.5/3.2 → 1/1.35/1.8/2.3/2.8.
  - Mini-boss health 700 → 350; boss health 1600 → 750.
  - The first wave starts thinner (2 every second, from 0:02); fast monsters wait until 0:25.
  - A warm-up: monsters do half damage for the first 30 s (`WARM_UP_SECONDS`, `WARM_UP_DAMAGE`).
  - Shop costs `[20, 40, 70, 110, 160]` → `[100, 200, 350, 550, 800]` (the whole shop is 10,650 gold).
- **Sim numbers after tuning** (5 seeds, every hero; L = level-ups, Q = questions):

  | Shop | Castle | Forest | Graveyard | Peaks | Lava |
  |---|---|---|---|---|---|
  | none | L14 Q4, won 10% | L16, won 20% | L11, 0% | L11, 0% | L6, 0% |
  | level 2 | L21 Q7, won 28% | won 38% | won 8% | won 8% | L11, 0% |
  | whole | L26 Q8, won 50% | L30, won 58% | won 15% | won 25% | won 18% |

  - A Ranger standing still on Castle Fields now lasts 0:37–2:38, mostly about 1:37 (was 0:14); a Knight about 1:37. Pupil-style runs on Castle survive or win.
  - **A steady player** (5 runs a day, cheapest shop level first, strongest open hero, first unbeaten map):
    - All 5 bosses take 6–10 school days.
    - Rogue, Wizard, Barbarian, Cleric and Dragon Kid open on days 1–2; Frost Witch on days 3–6.
    - About 6,100–6,650 gold is spent by then. The shop is not yet all bought, so gold still has a use.
  - Before tuning, runs had 9–13 level-ups and bosses were almost never beaten. Gold piled up, with the shop all bought by day 5–6 and 20,000+ unspent.
  - The big goal (3–4 weeks) now rests more on the shop, the Codex and boss wins with every hero (stage 5) than on opening maps.
- **Replay speed:** longer runs keep more monsters alive, so a whole Castle Fields replay went from about 79 ms to 133 ms (bundled, on the Mac; `moveEnemies` is most of it). Still far inside the function's CPU. Under vitest the same replay takes about 470 ms (imports go through getters), so the rule test's limit is now 4 s instead of 1 s. It had failed on a CI shard at 1.75 s.
- **Determinism:** the tuning and warm-up change the runs, so the fingerprint moved from `ba14927f` to **`67a677c4`**. It is identical in Node, WebKit and Chromium.
- **Tests:**
  - 4 server tests (unlock rules added) and the deployable-file check.
  - `goblinstorm.test.sql` now has 40 checks (unlocks once each, `my_goblinstorm` own save only, signed-out refused). It passes on a clean copy, as does `security.test.sql`.
- **Still not done (by plan):** no hub registration, migration on hold, code switch off. Stage 7 must add `goblinstorm_enabled` to `GAME_SWITCH_COLUMNS`, add goblinstorm to `UNLIMITED_GAMES` and `teacher_set_unlimited_today`, and take the line out of `supabase/migrations-on-hold.txt`.

## Stage 5 results
- **Gold shop** (`shared/goblinstorm/shop.ts`, `BetweenRuns.tsx`): Might, Armour (to 3), Speed, Health, Magnet, Gold; 5 levels at 100/200/350/550/800 (10,650 in all). The map and end screens have a 🛒 Shop button. Once everything is bought, gold shows only as "🏆 Best haul" (the most gold from one run, `bestGold` in `my_goblinstorm()`).
- **Why buying is a database function** (`buy_goblinstorm(item)`, authenticated, own save only) and not a server action: buying needs no replay and no maths, only the save. One locked `update … where gold >= cost and level < top` can never overspend or go past the top, even with two tabs. A function call would add a round trip and cold starts for nothing. Its reply is `{bought, reason: null|'gold'|'top'|'none', gold, shop}`. The prices and tops live in both `shop.ts` and the function; change them together.
- **The shop gap is fixed:** `start` keeps the shop on the run row (`goblinstorm_runs.shop`, via `goblinstorm_store_questions`) and sends it in the start reply. The browser plays with `start.shop`, and `finish` replays with the run's kept shop, not the save's. A server test buys between start and finish and the run still checks out (with the old code it fails: checked by breaking it on purpose).
- **Weapon Codex** (16 pages): the 8 weapons once picked up, plus the 8 evolutions once made, each pair showing its partner passive ("+ Armour ="). "📖 Codex x/16" is on the map screen.
  - **What fills it, and why it's a summary change:** evolutions were already saved. Weapons picked up were not, so `RunSummary` gained `weapons` (every weapon held, in the order picked up). It comes from the replay, never from the browser. It is only a summary field, not run state, so replays are unchanged and the **fingerprint stays `67a677c4`**. `record_goblinstorm_run` keeps known weapon ids only, in the new `goblinstorm_saves.weapons`.
- **Points:** given inside `record_goblinstorm_run`, so they happen once per seed and can never lose the save: `add_game_points(player, 'goblinstorm', 5 (+5 for a boss), seed)` for a run played to the end (won, survived or lost) on a normal turn. It is inside the 40-a-day cap and writes a `scored_games` row. Extra (Unlimited today) turns and runs left early give gold but no points (so quitting can't farm points); they still call `game_progress_changed`, so achievements count.
- **Achievements** (hooks copied from Toon Flap; `season_fn` null, `keep_achievements` true): First Storm 🌪️ (a run played to the end), It Evolves! ✨, King Slayer 👑 (any boss), Hero Collector 🦸 (all 8 heroes), Storm Master ⚡ (all 5 bosses). `<AchievementPop>` and `<TrophyWonLine>` are mounted for the whole game (so the trophy line has its "before" count), watching the finish reply; both are off in the preview (`onServer` prop, default false).
- **Trophy:** `goblinstorm-crown`, "Goblin King's Crown", "Beat the Goblin King in Goblin Storm.", once. The trigger `goblinstorm_save_trophies` fires when map 0 first joins `bosses`. Nothing to back-award: the game isn't live.
- **Game boards board:** `goblinstorm_board(scope)`: `board_pupils(scope)` (own school, pupils only, hidden profiles left out), ranked by bosses beaten, then the most monsters beaten in one run. Never maths. The top 10 plus the caller. `GoblinStormBoard` in Leaderboard.tsx; it shows once the game is in `GAMES` (stage 7).
- **Teacher column:** `teacher_progress_other_games` re-made from its newest body (20261114000300_glyph_teacher.sql) with a Goblin Storm block: bosses beaten (of 5) and the last run started. `useGoblinStormCells` in `src/games/goblinstorm/teacher.ts`.
- **Sim journey with the real shop** (`shop.ts`'s `buy`, cheapest level first; it now runs until the shop is all bought too):
  - All 5 bosses: 6–10 school days (unchanged). Heroes: as stage 4.
  - **The whole shop: 9–14 school days** (about 2–3 weeks of school), with 16–735 gold left over. After that, gold shows as best haul only.
- **Tests:** 4 server tests (the shop-at-start check folded into the marking test) and the deployable check. `goblinstorm.test.sql` has 64 checks (shop kept at start, codex, 30 points and 3 scored rows for 3 boss wins, none for an extra turn or a quit, achievements, the crown once, buying: can't afford, Armour stops at 3, unknown item, a teacher with no save, nobody else's gold, the board pupils only, the teacher column). It and `security.test.sql` (with `buy_goblinstorm` and `goblinstorm_board` on the allow-list) pass on a clean copy. That copy needed today's `realtime.messages` partition added by hand; that is the copy, not us.
- **Browser check** (Playwright, Chromium): the shop buys and the gold goes down; a run started after buying Might 2 checks out; the Codex shows 1/16 after a Knight run; all bought shows "Best haul"; the Codex works at phone width. The preview has a new `?gold=2000` to try the shop.
- **Stage 7 must also:** pass `onServer` to `GoblinStormGame` on the hub; add the "Goblin Storm" Progress column with `useGoblinStormCells`; recopy `teacher_progress_other_games` into the migration if another migration changed it since 20261114000300.

## Stage 6 results
- **Effects (drawing only; fingerprint still `67a677c4`):** hits make sparks (only the first 6 hits a step, 2 on low) and a ring on crits; gem pickups make one sparkle at the hero and pulse the gem bar; a level-up has a beam of light, two rings, rising sparkles and "LEVEL UP!"; evolution wipes have a second shockwave and 36 shards; a boss arrival dims the screen, slides hazard stripes in at the top and bottom and drops the boss's name in (below the arrival banner). Reduced motion: fewer shards, shorter boss show, no shaking extras.
- **Sounds** (`sfx.ts`): only the hub's own sounds (`playSound`), through the game's sound button. Hit, gem, level-up, wipe, hurt, boss arrival, big kill, the 5-second warnings, evolve, pick, win and fall. Each has a gap before it can play again, and at most 2 sounds play a frame (most important first).
- **Bella** (`voiceLines.ts`, `voice.ts`, 1,247 Kokoro af_bella clips in `public/voice/goblinstorm/`): the 7 guide lines, the 3 map-screen tips, and level-up questions read as pieces (236 word pieces from every ladder skill, plus the numbers 0 to 1000). A question with a decimal, a big number or an unknown piece is read by the browser's voice. She never says an answer. She only speaks when the game's sound is on.
- **The answer clock** starts when she finishes: the time sent is the modal's time minus how long she was reading (an answer while she's still reading counts as 0 ms, so it can be quick). If she never says she's finished (a stuck browser voice), the wait counts at most 1.5 s + 90 ms a letter. The server still decides quick or not from that time, as before.
- **Guided first go:** the first Castle Fields run until the save says `guideSeen`. Bella's box (at the bottom, with "Skip guide") says each line once: move (until the hero moves), the first question, the cards after a question, a weapon at level 5 (get its partner), the mini-boss warning, the boss warning, and "That's the guide done" 10 s into the boss fight. Never about the answer. "🧚 Replay the guide" on the map screen plays it again.
  - **Kept on the server:** `goblinstorm_saves.guide_seen` (in the on-hold migration), set by the new pupil-callable `goblinstorm_guide_seen()` (own save only; makes the save row if there isn't one). `my_goblinstorm()` returns `guideSeen`. It's on the `security.test.sql` allow-list; `goblinstorm.test.sql` now has 69 checks (Ana sets hers, her gold is untouched, Ben's stays false, a new pupil gets an empty save with it set).
- **Map screen:** the next-step line ("👉 …" from `nextStep.ts`: first storm, Shop when there's enough gold, Codex after 2 runs with no evolution, the next boss) with "Show me", which outlines the map, Shop or Codex button. After the first run, `FirstTimeTip` (prefix `gs`, Bella) gives 3 tips once per device.
- **Effects setting:** "Effects: High / Low" on the map screen, kept on the device (`goblinstorm-effects`). Low: fewer particles, no small glows, no extra rings. Either way it drops to low by itself while frames are slow.
- **Tests:** the level-up screen test (`PlayScreen.test.tsx`: the question first, then 2/3/4 cards for wrong/right/quick, with the canvas left out) makes 8 of 8 counted tests; the voice-lines test (`voiceLines.test.ts`: the standard clip checks, plus over 60% of ladder questions read from her clips, numbers in order, decimals and big numbers left to the browser voice) doesn't count.
- **Browser check** (Playwright, Chromium, effects on high, a busy screen 60 s in): 51 to 61 fps at 1366×640 (headless, two runs) and 60 fps at 390×844; the automatic drop didn't trigger. The guide box, next-step line, boss show and cards with Bella's line look right at both sizes.
- **Stage 7 must also:** add a "What's new" line, put Goblin Storm in the players tracker, and check Bella's clips play on the hub (the folder is `voice/goblinstorm/`).

## Went live
- **19 Nov 2026, #622 (go-live):** migration `20261119000900` taken off hold and applied by the publish run (it now also re-makes `teacher_set_unlimited_today` with `goblinstorm`); the function was already deployed from stage 3. Hub: `src/games/goblinstorm/index.tsx` (GameDefinition, teacher switch, "Follows focus", Progress column "bosses beaten"), `GoblinStormPlay.tsx` (`liveGoblinStorm`, `onServer`), `GAME_SWITCH_COLUMNS`, `UNLIMITED_GAMES`, home card moved to `src/assets/home/`, a "What's new" line, `docs/PRIVACY-SUMMARY.md`.
- **Before merging:** database tests on a clean copy built from every migration: goblinstorm 69, security 50, progress_access 65, unlimited_turns 12, bonus_turns 29, teacher_set_games 10, progress_other_games 8, home_my_games 7, non_maths_games 9, trophies_games_4 27, all pass. Determinism `67a677c4`.
- **Checked live after the merge:** the migration is in the live history; the three tables exist and are empty; `goblinstorm_enabled` is on for all 11 settings rows; `hub_games` row and the Crown trophy are there; the function answers 401 "Please sign in again." signed out; signed out, `my_goblinstorm` and `goblinstorm_saves` give 42501; RLS on; `goblinstorm_questions` has no grants; Bella's clips load from the live site (200); `scored_games` not smaller. A signed-in run on the live site was not tried (no test pupil sign-in; never save test data live).
- **19 Nov 2026, #623 (switch):** `GOBLINSTORM_ON = true`; the card, the board and the What's new line show to every class.
- **Players tracker:** not done. The tracker page (made 2 Nov) can't be opened with this session's artifact tools; add `goblinstorm_runs` (one row per run started, `player`, `started_at`) to its query by hand.
