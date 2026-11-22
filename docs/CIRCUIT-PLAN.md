# Circuit Racer: plan

**Status: Stage 1 done (the physics engine, config, road format, 6 Motherboard roads, tests and simulator in `shared/circuit/`; no screens yet, nothing for pupils to see). Plan PR #733, choices #734, Stage 1 PR #738 (22 Nov 2026). Next: Stage 2, first playable (prompt in `docs/prompts/circuit-s2.md`).** James picked the theme "Circuit Racer" from six new-theme ideas (deep sea, lava, sweets, aurora, circuit, ghost train) on 22 Nov 2026. Game id `circuit`. Next free migration number when written: `20261122000800` on 22 Nov (check again before Stage 2: `node scripts/migration-numbers.mjs`).

**Circuit Racer** is a neon racing game. You are a spark of data racing along circuit-board roads that float inside a giant computer. Steer between 7 lanes, speed up and slow down, jump the gaps, and dive into the port at the end of each road before your **battery** or **signal** runs out.

## The short version

- **Our own game, built on a well-tested kind of physics.** We read the open-source fan remake *OpenRoads* (MIT licence, 2014) closely; it copies how the 1993 DOS game *SkyRoads* moves its ship. We copy the *ideas* in its physics (section 2), write them again in our own code and units, and tune them for 8 to 11 year olds. We use none of SkyRoads' roads, art, music, names or look, and OpenRoads only runs with those original files anyway. The MIT credit goes in `src/games/circuit/art/CREDITS.md` and the physics file's header.
- **One pure rules-and-physics engine in `shared/circuit/`**, 30 steps a second, same inputs = same run on every device. The server **replays the run's inputs** to check the finish and time before saving, as Marble Rush does.
- **Drawn with three.js and bloom** (already used by Mine Runner and Marble Rush, loaded only when the game opens): glowing neon roads, chips, cables and sparks. Painted on the gaming PC with ComfyUI: world backdrops, the world map, the dashboard frame, the racer picker, the finish paintings and the home card (section 6).
- **30 roads in 5 worlds** inside the computer: Motherboard, Graphics Card, Memory Lanes, The Cloud and the Quantum Core.
- **Maths that fits a fast game:** **recharge ports** (a pit stop: the race pauses for one question; right = full battery, wrong = half and the right answer shown) and **data gates** (the road splits into lanes signed with answers; the right lane gives a boost through a shortcut). Questions come from the pupil's maths focus, made and marked on the server (way A).
- **No game over.** Crash or fall and you restart that road at once (or from a checkpoint on long roads). Medals for time, stars for clean runs.
- **What the teacher sees:** an "Other games" column (roads finished), the usual switch, and the maths in the Skill map.

## Decisions (question cards for James, with my recommendations)

| Question | Recommendation | James chose |
|---|---|---|
| Name | **Circuit Racer** | Circuit Racer (22 Nov) |
| Card group | `complex-maths` (focus questions, like Marble Rush) | follows from the maths choice |
| Play a day | No limit (practice game) | **5 finished roads a day, then the game fully stops** ("All done for today. See you tomorrow!"). Crashes and retries don't use one up. Teacher's Unlimited today lifts it |
| How new roads open | **A world opens when you finish 4 of the 6 roads before it**, so one stuck road never blocks anyone | 4 of 6 |
| Ship look | **3D low-poly racer drawn in code, with glow** (crisp at every size); painted portraits on the racer picker. Not a flat sprite like OpenRoads | 3D glowing racer |
| Jump helper | **On**, called **Auto-Pilot** with a dashboard light (it quietly fixes near-miss jumps). Hard mode turns it off | on, off in hard mode |
| Maths | recharge ports + data gates | ports + gates |
| Data gates in the first world | **No:** world 1 teaches driving only; recharge ports from road 3, data gates from world 2 | from world 2 |
| Classmate ghosts | Yes, later stage (copy Marble Rush's ghosts) | **no ghosts** |
| Crashes | kind: explode only above half speed, restart in 1.5 s, checkpoints on long roads | kind |

## 1. What we read (OpenRoads, github.com/praveenscience/OpenRoads-SkyRoads-Clone)

TypeScript + WebGL, about 8,500 lines, MIT. It decodes SkyRoads' own data files (roads, pictures, music), which are not in the repo, so nothing there can be shipped. The useful part is `Ship.ts` (about 570 lines), the physics taken from the old game, and `Level.ts` (how a road is stored and what is solid). Summary of how it works:

- **Road:** a grid 7 lanes wide and up to a few hundred rows long. Each square can hold a **floor tile**, a **block** on top (3 heights) and/or a **tunnel** (a half-pipe you can drive inside). Tile colour sets what the tile does.
- **Fixed 30 steps a second.** If the screen falls more than 3 steps behind, it drops time instead of racing to catch up.
- **Each step:** read what is under the ship → apply that tile → update up/down speed (bounce at half speed if landing hard, else stop) → forward speed (accelerate/brake, capped) → sideways speed (steer only on the ground or in the first moments of a jump) → jump → gravity. Then move toward the new spot in 5 small tries, stopping just before anything solid, and slide forward, across and up separately in shrinking steps so the ship sits flush against what it hit.
- **Wall nudge:** clip a corner and you are pushed sideways about a sixth of a lane instead of stopping.
- **Crash:** hit a wall above about a third of top speed and you explode; slower and you just stop.
- **Ledge slip:** land half over an edge and you slide off it.
- **Jump helper:** near the top of a jump it plays the jump forward. If you would miss, it tries nudging sideways speed and forward speed by 10% to 60% until you would land, and gives the speed back when you touch down.
- **Fuel** burns faster the faster you go; **oxygen** drains with time. Each road has its own gravity, fuel and oxygen. Very high gravity means no jumping.
- **Win:** reach the last rows inside the end tunnel. After a crash it waits about 3.5 seconds, then restarts the road.
- **Demo replay:** inputs indexed by distance along the road, not time (a neat trick we reuse for the server replay).

## 2. Our physics (`shared/circuit/physics.ts`)

Same shape as section 1, our own code, numbers in plain units (1 lane = 1.0 wide, 1 row = 1.0 long, block heights 0.5 / 0.75 / 1.0), every number in `shared/circuit/config.ts`.

| Part | What we keep | What we change for kids |
|---|---|---|
| Step | 30 a second, fixed, pure function `step(state, input, road)` | none |
| Steering | only on the ground or right after take-off | a little more grip (turn rate +20%) |
| Speed | accelerate/brake, top-speed cap; boost and slow tiles push it | gentler braking at very low speed so you never stall |
| Jump | fixed jump speed; gravity per road | slightly longer hang time in world 1 |
| Crash | explode above a speed limit when hitting a wall face | limit raised from 1/3 to **1/2 of top speed**; slower hits just stop you with a "bonk" |
| Wall nudge | push sideways when clipping a corner | push a bit further so it reads clearly |
| Ledge slip | slide off half-landed edges | none (it's what makes landings feel real) |
| Bounce | half-speed bounce on hard landings | none |
| Auto-Pilot | jump helper tries ±10% … ±60% | same, shown as a dashboard light; off in hard mode |
| Battery | drains with speed | tuned so a careful first run never runs out |
| Signal | drains with time | tuned so dawdling, not careful driving, runs it out |

Tests: physics cases (land, bounce, crash, nudge, slip, auto-pilot save, battery and signal), and **every road is finished by a scripted bot run** (`roads.test.ts`), so no road can ship unfinishable. A simulator (`scripts/circuit-sim.mjs`) plays each road with "careful", "average" and "wild" bots to set medal times and check battery/signal.

## 3. Roads and tiles

**Tiles** (what the colour does):

| Tile | Looks like | Does |
|---|---|---|
| Plain trace | green board with gold lines | nothing |
| **Overclock** | bright green arrows, pulsing | speed up |
| **Resistor** | amber stripes | slow down |
| **Short circuit** | red, crackling sparks | explode (the "don't touch" tile) |
| **Cooling gel** | icy blue, shiny | slippery: no steering while on it |
| **Recharge port** | blue ring with a plug | full battery and signal; with maths on, a pit-stop question (section 7) |
| **Data gate** | 3 or 4 lanes with glowing answer signs | right lane = boost into a shortcut (section 7) |

**Blocks** are chips, capacitors and heat-sinks at 3 heights. **Tunnels** are data cables (half-pipes). **The finish** is a giant port you dive into.

**Road format:** our own text grid in `shared/circuit/roads/*.ts`, one string of 7 letters per row (`.` gap, `-` trace, `>` overclock, `r` resistor, `x` short, `g` gel, `+` recharge, `1/2/3` block heights, `t` tunnel, `?` gate), plus gravity, battery and signal per road. Easy to read in a PR, easy for a later road editor.

**Worlds** (6 roads each, getting harder; gravity in brackets):

| # | World | Look | Teaches |
|---|---|---|---|
| 1 | **Motherboard** | green board, gold traces, little chips | steering, speed, first jumps (normal) |
| 2 | **Graphics Card** | hot reds and orange, spinning fans, RGB lights | overclock and resistors, data gates (normal) |
| 3 | **Memory Lanes** | long rows of RAM sticks, blue and silver | narrow lanes, cooling gel, tunnels (heavier: short jumps) |
| 4 | **The Cloud** | white and cyan data clouds in a bright sky | long gaps (lighter: floaty jumps) |
| 5 | **Quantum Core** | purple and gold, shimmering, glitchy | everything; very light gravity, tight signal |

**Hard mode** on a finished road: Auto-Pilot off, a count-down clock. Nothing lost by failing; 🔥 on the result.

## 4. A go (about 1 to 3 minutes a road)

World map → pick a road (medal and stars shown) → short fly-in → race → finish painting with time, medal (bronze = finished, silver and gold by time from the simulator), stars (no crash, battery over half, every gate right) → next road. Crash: a spark burst, about 1.5 s, restart at the road's start or last checkpoint (roads over 60 s have one). Keys: arrows/WASD, Space to jump, Enter to start or retry. Touch: left/right pads, a jump button, speed by sliding a thumb.

## 5. Design (docs/game-guide/1-design.md)

1. **Big goal:** reach the Quantum Core and finish all 30 roads (at least 6 days at 5 a day; about 3 to 4 weeks for most pupils, with retries and medal runs); after that, gold medals, all stars and hard mode.
2. **Season game?** No. Nothing piles up that late joiners can't catch.
3. **Play a day:** **5 finished roads a day** (James). Only a finish uses one; crashes, restarts and quitting mid-road are free. Replaying a finished road (for a medal or stars) also uses one. When all 5 are used the game fully stops with "All done for today. See you tomorrow!" and a countdown to NZ midnight. The server counts and refuses (`nzDate`), never the browser. The world map shows "3 races left today". Added to `UNLIMITED_GAMES` and `teacher_set_unlimited_today()`; extra races on an Unlimited day earn game rewards but no hub points. At 5 a day the 30 roads take at least 6 school days, about 2 to 3 weeks at 3 lessons a week.
4. **Progress bars:** world map path with a dot per road; a road progress bar on the dashboard; `LevelBar` for roads finished.
5. **Achievements:**

   | Name | For (pupil words) | Measure | Number | Who gets it | Kept at New Season |
   |---|---|---|---|---|---|
   | First Boot | Finish your first road | roads_finished | 1 | almost all, day one | yes |
   | Clean Run | Finish a road without crashing | clean_runs | 1 | most | yes |
   | Overclocked | Finish 10 roads | roads_finished | 10 | many | yes |
   | Gold Circuit | Win a gold medal | golds | 1 | many | yes |
   | World Hopper | Open the Graphics Card | worlds_open | 2 | most | yes |
   | Cloud Rider | Open The Cloud | worlds_open | 4 | some | yes |
   | Core Complete | Finish every Quantum Core road | worlds_done | 5 | few | yes |
   | Golden Board | Gold on all 30 roads | golds | 30 | very few | yes |
   | Firewall Free | Finish a road in hard mode | hard_finishes | 1 | some | yes |

6. **Home card:** a glowing circuit-board road floating in a dark computer cosmos, a tiny bright spark racing along it toward a giant glowing port, chips and capacitors like city blocks, flat storybook style, no text (prompt in `docs/circuit-art/config.json`).
7. **Guide for new players:** "Volt", a friendly little robot plug, talks on the dashboard (copy Star Trader's Bolt pattern).

   | Moment | What the game does | Why a child gets stuck | Fix |
   |---|---|---|---|
   | First road | guided go on road 1: steer, then speed, then jump, one lit key at a time | doesn't know the keys | Volt shows the key on screen; road 1 has no gaps until you've jumped once |
   | First short-circuit tile | slows the road, Volt points | doesn't know red kills | first red tiles sit beside a wide safe lane |
   | Battery low | meter flashes, Volt: "Find a blue port!" | doesn't connect battery and speed | first recharge on road 3 comes just as the meter dips |
   | First crash | instant retry, tip "Hit walls slower than half speed" | thinks the game is unfair | the tip shows once, then fades |
   | First data gate | slow-motion zone and the question in big text before the split | can't read and steer at once | gates always come with 4 seconds of slow-mo; no red tiles near a gate |

   Next-step line on the world map ("Finish Fan Alley to open Memory Lanes"), first-time tips, "Replay the guide".
8. **Learning design:** maths is a side part here (it helps, never decides): a wrong answer still shows the right one with a reason (the `QuestionModal` show-why). Pit stops pause the clock, so slow thinkers aren't punished; data gates give a 4-second slow-motion zone and the question stays on screen until the split. Questions only from the focus pack; one question on screen at a time (lesson from Marble, 22 Nov); at least 8 rows between questions (`QUESTION_GAP`).

Also: **lesson fit:** road 1 to 3 in the first 5 minutes; a road is 1 to 3 minutes, so the day's 5 finishes plus retries fill about 10 to 15 minutes, saving after each. **Solo.** **Teacher:** switch, maths on/off (`parseMathsSwitch`), an Other games column "Roads finished", reset progress for a pupil.

## 6. Art (painted on the gaming PC; drawn stand-ins first)

Full list and prompts go in `docs/CIRCUIT-ART-PLAN.md` and `docs/circuit-art/config.json` in Stage 5. Style words: *glowing neon circuit-board world, deep navy and black, electric cyan, green and gold light, clean shapes, cinematic, painterly digital art, no text*.

| Picture | Size | Kind | Used for |
|---|---|---|---|
| 5 world backdrops | 1536 × 864 | scene | far background behind each world's roads (blurred, slow parallax) |
| World map | 1536 × 864 | scene | the road picker, full window |
| 5 finish paintings | 1536 × 864 | scene | finish screen per world |
| Dashboard frame | 1536 × 384 | cut | painted dash around the code-drawn gauges |
| 6 tile textures | 512 × 512 | seamless | trace, overclock, resistor, short, gel, recharge |
| 4 racer portraits | 768 × 768 | cut | racer picker (unlock by worlds) |
| Volt the guide | 512 × 512 | cut | guide on the dashboard |
| Home card | 1600 × 900 | card | hub home page |

The racer, chips, cables, sparks and gates are drawn in three.js with bloom, so they stay sharp and animate smoothly; the paintings set the mood.

## 7. Maths (way A, docs/game-guide/4-maths.md)

- **Start:** the browser asks `circuit` for a road. The function reads `space_maths_context`, makes the pack from a fresh seed, makes one question per port and gate on that road, stores them in `circuit_questions` (no pupil access), and sends only `publicQuestion()`s.
- **Recharge port:** race pauses, `QuestionModal` shows the question. Right = full battery and signal; wrong = half, and the right answer is shown.
- **Data gate:** 3 or 4 lanes signed with answers (multiple-choice style, so it uses `choices`/`choiceLabels`; every ladder kind must show, tested like `shared/archery/server.test.ts`). Right lane = overclock shortcut; wrong lane = the normal road, no harm, the right answer flashes.
- **Marking:** the finish sends the inputs and the answers; the server replays the run, checks each answer was given at its port or gate, marks it against the stored question, claims each slot once and calls `recordMathsAnswers(..., 'circuit')`.
- Maths off: ports just refill, gates become plain overclock lanes.

## 8. Server, data and cost

Function `circuit` (`start`, `finish`). Tables: `circuit_progress` (best time, medal, stars per road per pupil, finishes today and their NZ date), `circuit_runs` (recent finished runs with inputs, for checking), `circuit_questions`. `finish` refuses a 6th finish on the same NZ day unless the teacher's Unlimited today is on. Migration `20261122000600_circuit.sql` (re-check). Points through `add_game_points` on each finished road. About 2 calls a road: a class of 28 playing 15 minutes is roughly 300 calls a lesson.

## Stage 1 results (22 Nov 2026)

`npm run circuit:sim` drives every road with three look-ahead bots (they play each choice forward with the real physics, every few steps): **careful** at 60% of top speed, **average** at 80%, **wild** flat out and looking only half a second ahead. Times are seconds; the two percentages are the lowest battery and signal on the run. Every run is replayed from its recorded inputs and gives exactly the same time.

| Road | Rows | Ports | Careful | Average | Wild | Gold (suggested) | Silver (suggested) |
|---|---|---|---|---|---|---|---|
| 1 Power On | 182 | 0 | 26.4s, 83% / 59% | 19.7s, 79% / 70% | 16.1s, 75% / 75% | 18s | 23s |
| 2 Clock Speed | 213 | 0 | 28.8s, 79% / 60% | 21.8s, 74% / 70% | 18.6s, 71% / 74% | 21s | 26s |
| 3 First Charge | 232 | 1 | 32.3s, 54% / 56% | 26.4s, 49% / 61% | 20.5s, 39% / 71% | 23s | 31s |
| 4 Data Bus | 361 | 2 | 51.8s, 55% / 55% | 39.7s, 44% / 67% | 31.7s, 34% / 73% | 35s | 46s |
| 5 Bridge Chips | 301 | 3 | 40.8s, 62% / 59% | 32.7s, 24% / 44% | 26.9s, 49% / 72% | 30s | 38s |
| 6 Kernel Run | 362 | 3 | 52.7s, 57% / 56% | 43s, 48% / 67% | 32.1s, 39% / 73% | 36s | 50s |

What this shows:
- **Every road is finishable on the first go** by the careful and average bots, and the wild bot finishes them too. `roads.test.ts` checks the average bot on every road (under a second for all six).
- **Battery:** a careful driver never drops below half, so a careful first run never runs out. Flat out on roads 3 to 6 the battery dips to a third or a quarter, so the recharge ports matter for fast drivers (the 24% on Bridge Chips is the average bot skipping a port).
- **Signal:** a careful driver uses under half on every road (the ports refill it on roads 3 to 6), so it only runs out for a racer going at a quarter of the careful speed or stopping a lot: dawdling, not careful driving.
- **Lengths:** roads 1 to 3 take a careful driver about half a minute (the plan's "roads 1 to 3 in the first 5 minutes"); roads 4 to 6 just under a minute. With hesitation and retries a child takes 1 to 3 minutes.
- **Medals:** suggested gold is 10% slower than the wild bot, silver 15% slower than the average bot. Stage 4 sets them for real from this script; bronze is any finish.

Choices made while building (all in `shared/circuit/config.ts`):
- Units are lanes, rows and seconds: top speed 12 rows/s, steering 3.6 lanes/s at top speed (40% of that when stopped, so a stopped racer can edge sideways), jump 6 up, Motherboard gravity 16 (apex 1.1, so the tallest block, 1.0, can just be jumped onto).
- Battery drains by `0.25 � speed share + 0.75 � speed share�`, so driving slower really does stretch it; each road's `battery` is the seconds it lasts flat out and `signal` the seconds it lasts at all.
- Tunnels are a floor with a roof at 1.2 for now (jump inside on a light world and you bump your head); Stage 2 draws them as half-pipes and may curve the sides.
- Inputs are stored as changes, each at a distance slot (8 a row) plus the steps already spent in that slot, so a replay is exact even when the racer stops, and pit-stop pauses (Stage 3) never need recording.
- Data gates (`?`) parse but drive as plain trace until Stage 3.

## 9. Stages

| Stage | What | Live? |
|---|---|---|
| 1 | Physics engine + config + road format + 6 Motherboard roads + bot test + simulator (all in `shared/circuit/`) | no (no screens yet) |
| 2 | First playable: three.js roads with bloom, racer, dashboard, keys and touch, world 1, full window, code art, preview page; server replay, saving, 5-a-day limit, migration, switch (off) | yes, switched off |
| 3 | Maths: recharge ports and data gates, way A, teacher maths switch | yes |
| 4 | Worlds 2 to 5 (24 more roads), checkpoints, hard mode, medals from the simulator | yes |
| 5 | Painted art (art plan, config, ComfyUI on the gaming PC), sounds | yes |
| 6 | Volt's guided first go, voice clips (Bella), achievements, teacher column; **switch on** | yes, on for all |
| 7 | A road editor for pupils (no ghosts: James, 22 Nov) | later |
