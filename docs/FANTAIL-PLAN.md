# Fantail Flight: plan

*Working name "Fantail Flight" (id `fantail`, prefix `.ff-`). James, 11 Nov 2026: "I have had a lot of requests for a flappy bird style game, it would go in the easy maths game section ... checks would ask maths questions to reduce time (like marble maths) there should be 10 initial levels of increasing difficulty."*

**Status: plan only, nothing built.** Written 11 Nov 2026 from `main` after reading the game guide, LEARNING-DESIGN.md and Marble Rush's plan. Art style and name are James's choice (section 11). Art waits for James's ComfyUI evenings: the game is built with drawn stand-ins first ([FANTAIL-ART-PLAN.md](FANTAIL-ART-PLAN.md)).

## The short version

- **Tap to flap.** A pīwakawaka (fantail) flies right through a course of gaps. One button: tap, click or Space. Our own game, our own name, art and courses: the one-button flapping feel isn't owned by anyone, but the name *Flappy Bird*, its pipes and its art are, so none of those are used.
- **No game over.** A bump costs **+3 seconds** and the bird pops back up at the last perch. You always finish. Like Marble Rush, the clock counts up and your time earns bronze, silver or gold.
- **Checks** (James's word): perches along the course. The bird lands, **the clock stops**, and a maths question from the pupil's own focus shows. Right: **3 seconds off**. Wrong: nothing lost, and the right answer shows with a reason. This is Marble's pit stop.
- **Answer gaps** from level 3: a sign shows a quick question and the next wall has 2 or 3 gaps labelled with answers. Flying through the right one gives a **tailwind, 2 seconds off**. The wrong one is just a normal gap. This is Marble's answer gate.
- **10 levels** across Aotearoa, from a wide, slow garden to a stormy Southern Alps pass. The flying gets harder; **the maths doesn't**, because it always comes from the pupil's own focus.
- **Server in charge**: deterministic physics in `shared/fantail/`, the server makes and marks every question (way A) and replays the flaps to check the time before saving. About 6 calls per level.
- **Easy maths group** (`group: 'easy-maths'`), for Years 4 to 6.

## 1. How a level plays

1. Pick a level on the map (level 1 open, each finish opens the next).
2. "Tap to start." The bird hovers until the first tap, so nobody crashes in the first second.
3. Fly. The world scrolls at a set speed; each tap gives the same lift; gravity pulls down. Walls come in pairs (top and bottom) with a gap between.
4. **Bump** (a wall, the ground or the top): the bird tumbles, +3 s, and comes back hovering at the last perch or the start. Hover again until you tap.
5. **Check** (a perch on a post): the bird lands by itself, the clock stops, a question card shows. Answer, see "Right! 3 seconds off" or the right answer with its reason, then tap to fly on (the bird hovers first).
6. **Answer gap** (level 3 on): a sign floats in about 4 seconds before the wall ("6 × 7"), then the wall has 2 or 3 gaps with numbers. The first gap the bird flies through is its answer.
7. **Finish**: the nest. Time = flying time + bumps − check and tailwind bonuses. Medal, best time, "Next level" button.

**Why no game over:** classic flappy games end at the first touch, which for a 9-year-old on a Chromebook trackpad means a lot of 3-second runs and no maths. Bump-and-carry-on keeps every pupil reaching the checks and the finish. The classic one-touch version comes back as a reward (section 9, Sky Dash).

**Physics (all in `shared/fantail/config.ts`):** fixed step of 1/60 s, like Marble. Inputs are just the step numbers of each flap, so a 60-second run is a few hundred numbers. Lift, gravity and top falling speed are gentler than the arcade game ("floaty") on early levels. Canvas 2D drawing (no three.js), so it loads fast on Chromebooks; the screen draws the latest position and the physics never depends on the frame rate.

**Gentle wings** (per pupil, any level): 80% speed and a slightly bigger bird gap. Finishing counts and opens the next level; gold needs normal wings. Shown as a feather on the time.

## 2. The 10 levels

Flying difficulty rises; question difficulty is always the pupil's focus. Numbers are starting values for the simulator (section 10) to tune. "Gap" is the opening height in bird heights; "spacing" is seconds between walls.

| # | Name | Place | Length | Speed | Gap | Spacing | Checks | Answer gaps | New thing |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Garden Hop | a backyard and fence | 30 s | slow | 5.0 | 2.6 s | 1 | none | Tap to flap (the guided first go) |
| 2 | Bush Track | native bush, tree ferns | 40 s | slow | 4.6 | 2.4 s | 2 | none | Walls a little higher and lower |
| 3 | Riverbank | a braided river | 45 s | slow | 4.4 | 2.3 s | 2 | 1 (2 gaps) | First answer gap |
| 4 | Waterfall | a bush waterfall | 50 s | medium | 4.2 | 2.2 s | 2 | 2 (2 gaps) | Walls that slide up and down slowly |
| 5 | Kauri Forest | giant kauri trunks | 55 s | medium | 4.0 | 2.1 s | 3 | 2 (2 or 3 gaps) | Narrow and wide gaps mixed |
| 6 | Coast Cliffs | west coast rocks and surf | 60 s | medium | 3.9 | 2.0 s | 3 | 2 (3 gaps) | Wind gusts (arrows show which way) |
| 7 | Harbour Lights | a harbour at dusk | 60 s | medium-fast | 3.8 | 1.9 s | 3 | 3 (3 gaps) | Darker sky, lit-up gaps |
| 8 | Steam Valley | geothermal pools | 65 s | medium-fast | 3.7 | 1.9 s | 3 | 3 (3 gaps) | Steam vents that push up |
| 9 | Mountain Pass | snowy tussock and rock | 70 s | fast | 3.6 | 1.8 s | 4 | 3 (3 gaps) | Sliding walls + wind together |
| 10 | Alpine Storm | Southern Alps in a storm | 80 s | fast | 3.5 | 1.7 s | 4 | 4 (3 gaps) | Everything, plus gusty rain |

- **Each level is the same course every time** (fixed layout, so practice pays off and best times are fair). Which gap holds the right answer comes from the run's seed, as Marble's doors do.
- **Checks sit before the hardest section**, so a pupil gets a breather and a fresh start right where they need it.
- **Medals** come from the bot (`npm run fantail:sim -- --write-medals`), as Marble: gold = no bumps and every bonus, silver = a couple of bumps, bronze = finishing. A class with maths off gets its own gold time, so maths-off pupils can still earn gold.
- **What a pupil sees between levels**: the map (a fantail's trip down the country), medals on each stop, and the next level glowing.

## 3. Maths (way A, copying Marble Rush)

- **`start`** reads the teacher switch, `space_maths_context(player)` and makes about 10 questions with `makeFocusPack` from a fresh seed (teacher focus, own pick or auto all work). Stored in `fantail_questions` (pupils can't read it). The browser gets `publicQuestion()`s only.
- **Checks** use the focus questions as they come (60% focus, 30% review, 10% stretch: the pack's job). Shown with `QuestionModal`, so typed answers, choices, the decimal key and fractions all work. **The clock is stopped**, so careful thinkers aren't punished (rule 8). The browser sends `{ seed, slot, value, ms }`; the server marks it once and records it with `recordMathsAnswers`.
- **Answer gaps** must be read while flying, so they use **confidence-builder facts** (`boxes: [3, 4]`, facts this pupil already knows well) and only kinds that fit a short sign (no fractions with long prompts; choices come from the pack's multiple choice). The first gap entered is the answer; it's marked when the finished run is replayed. **Read time** setting (on by default for levels 3 to 5): the game pauses when the sign appears until the pupil taps Go (up to 10 s), clock stopped, like Marble.
- **Rescue questions: not at first.** Marble's rescues work because falls are rarer; in a flappy game bumps are common and a question after each would turn into a quiz. Recommend leaving them out; a teacher can't miss them.
- **Maths switch** (`fantail_maths` off / choose / on, `parseMathsSwitch`), copying Marble: off means checks are plain rests and gaps show arrows; times have their own medals.
- **No points for right answers** (nothing to farm), same as Marble.

### Design check (LEARNING-DESIGN.md section 6)

1. **Maths idea and model:** the pupil's own focus (times tables, adding, place value … whatever the ladder says). No picture model: it's practice and recall, so the check card's own help is enough. The move: answering a check, and steering into the right gap.
2. **Winning without maths:** you can always finish (by design: flying is the game). Gold needs the bonuses, so it needs right answers. Guessing a gap is 1 in 2 or 1 in 3, and only the first gap counts; checks are typed unless the class uses multiple choice, and each slot is answered once.
3. **Help ladder:** checks show the right answer with a reason after a wrong answer (rule 7's minimum for Years 4 to 6). A pupil who gets 3 checks wrong in a row gets the next check from their confidence builders (`boxes: [3, 4]`) to rebuild, then back to the focus. Help for flying (Gentle wings, Read time) is separate and never touches the maths.
4. **Demo:** the guided first go (section 7) shows the first check and the first answer gap with a "how it works" bubble.
5. **Progression:** maths progression is the focus system's ladder. Flying progression is the 10 levels.
6. **Wrong-answer table:** comes from the shared pack's choices and reasons; the game adds none of its own. A wrong gap shows the right answer on the sign as the bird flies past ("6 × 7 = 42"), then again on the results screen.
7. **Recorded per answer:** fact key, first answer right or wrong, time (clock stopped, starts when the card is shown), whether it was a check or a gap, the date. Teacher: Games-table summary (levels finished, checks right this week), `hardest(classId)` (3 hardest facts from checks), `alerts` (many bumps on the same level for a week: "stuck on level 6", or checks under 60% right).
8. **Fun:** the flying itself, beating your own time, the next level, and the tailwind whoosh when you pick the right gap.

## 4. Big goal, seasons, moves a day (guide 1a items 1 to 3)

- **Big goal:** reach the Alpine Storm nest (level 10), then a gold on all 10. A pupil playing 2 sittings a week should finish all 10 in about 3 weeks (sim to check); golds take longer.
- **Season game? No**, it's fresh runs, like Marble. New Season clears only boards and the week's bests (`season_fn`); medals and levels opened are kept.
- **Moves a day: no limit** (it's practice; more maths is good). Points cap: only the first 10 finished runs a day earn points (Bond Match's rule), and a "Time for a break?" after 30 runs (`daily_limit`, like Marble). Join the "Unlimited turns today" list only if a cap ever blocks play (it doesn't), so not needed.

## 5. Progress bars and achievements (items 4 and 5)

- **In the game:** the map is the progress bar (10 stops, medals on each). During a run, a thin bar along the top shows distance to the nest with the checks marked.
- **Home page:** hub level bar and achievements come free. No moves-left chip (no daily limit).

| Achievement | For (pupil words) | Measure, number | Who should get it | Kept at New Season |
|---|---|---|---|---|
| First Flight | Finish level 1 | levels finished ≥ 1 | almost everyone, day one | yes |
| Off the Fence | Finish 3 levels | ≥ 3 | most, first week | yes |
| Halfway Home | Finish level 5 | ≥ 5 | most, in 2 weeks | yes |
| Storm Rider | Finish all 10 levels | = 10 | about half, in a month | yes |
| Clean Flight | Finish any level with no bumps | clean finishes ≥ 1 | many | yes |
| Tailwind | Pick 20 right answer gaps | right gaps ≥ 20 | steady players | yes |
| Gold Feathers | Gold on 5 levels | golds ≥ 5 | keen players | yes |
| All Gold | Gold on all 10 | golds = 10 | a few | yes |

**Points** (`add_game_points`, inside the hub's 40 a day): finish a level 2, first finish of a new level 5, a new gold 3. "Right answers earn no points" is said on How points work.

## 6. Card art (item 6)

Home card scene, Marble Rush course-card style: *a fantail mid-flight over a braided river and tree ferns, with a wall of flax and a gap of sky ahead, bright flat storybook landscape, no text.* Full prompt in the art plan. Until it's painted the card shows the game's colours and icon.

## 7. A guide for new players (item 7)

The guide is the fantail itself ("Pī"), voiced by Bella.

| Moment | What the game does | Why a child gets stuck | Fix |
|---|---|---|---|
| Opens the game | Map with only level 1 lit | Doesn't know what to press | Level 1 pulses; next-step line: "Tap Garden Hop to start." |
| Start of level 1 | Bird hovers | Doesn't know the control | Hand shows tap; Bella: "Tap to flap. Each tap lifts me up." |
| First wall | Gap ahead | Taps too much, hits the top | Level 1 has a ghost path dotted through the first 3 gaps |
| First bump | +3 s, back to perch | Thinks it's over | Bubble: "Bump! Just 3 seconds. Keep going." |
| First check | Lands, card shows | Doesn't know why | Bubble: "A check! The clock stops. Get it right to take 3 seconds off." |
| First answer gap (level 3) | Sign, then 2 labelled gaps | Doesn't link the sign to the gaps | Read time pauses it; bubble: "Fly through the right answer for a tailwind." |
| Results | Time and medal | Doesn't know what's next | Big "Next level" button; next-step line names it. |

- **Guided first go** = level 1 with the ghost path and bubbles; ends at the nest (a first success that can't fail, because bumps don't end the run). Who gets it comes from the server (no runs yet). Skippable; "Replay the guide" on the map.
- **Next-step line** on the map, a pure function: "Fly Riverbank next (level 3)" / "Try for gold on Bush Track: 4 seconds to go" / "Every level done! Try Sky Dash."
- **First-time tips** for each new thing in the table in section 2 (sliding walls, wind, steam). Help fades: Lots / Some / Off.

## 8. Voice (Bella)

Bella (Kokoro `af_bella`, `scripts/voice-clips.py fantail`) reads the **fixed lines only**: the guide bubbles, first-time tips, level names on the map, "Check!", "Tailwind!", "Bump! Just 3 seconds", medal lines and the next-step lines that have no changing numbers. About 60 lines. Maths questions are **not** read aloud (Years 4 to 6, like Sky Isles), and lines with changing numbers stay silent. A 🔊 Voice on/off button in the top bar, on by default.

## 9. After the 10 levels

- **Sky Dash** (opens after level 10): the classic version. One touch and the run ends; endless; a check every 30 seconds gives a **spare feather** (one free bump) instead of time. Score = distance. Class board of best distances, own school only, reset each New Season.
- **More level packs** later (11 to 20) if it's popular; the level format is data, so a new level is a new entry in `shared/fantail/levels.ts`.

## 10. Build stages

Branch `fantail`, own folders only (guide section 2). Next free migration number on 11 Nov 2026: **`20261111000100`** (check again with `node scripts/migration-numbers.mjs` when building). At most 8 tests.

| Stage | What | Live? |
|---|---|---|
| F.1 | `shared/fantail/`: config, physics, the 10 levels as data, replay, medals; `scripts/fantail-sim.mjs` (bot that plays every level, tunes medals and checks each level is beatable) | no |
| F.2 | Screens with drawn stand-in art: map, play screen (canvas), check card, results, How to play (numbers from config), reduced motion (no shake, no parallax); phone preview with a trial backend, published as a private Artifact for James | preview only |
| F.3 | Server: migration (`fantail_runs`, `fantail_questions`, `app_settings` columns `fantail_enabled`, `fantail_maths`, `fantail_read_time`; `teacher_set_fantail()`; `hub_games` row, achievements), function `fantail` (start / answer / finish with replay), database tests | yes, switch off |
| F.4 | Guide: guided first go, next-step line, tips; Bella clips | with F.3 or after |
| F.5 | Teacher: Games row and Settings, `studentSummary`, `hardest`, `alerts`; code switch on, then the teacher switch | yes, on |
| F.6 | Painted art from James's picks (art plan) | yes |
| F.7 | Sky Dash and its board | yes |

**Requests:** start + up to 4 checks + finish ≈ 6 calls a level. A class of 28 playing one 15-minute lesson a week (about 8 levels each) is about 1,350 calls a week, 5,500 a month, against 500,000.

## 11. Questions for James

1. **Art style** (asked on a card): see the art plan's four options. Recommendation: paper cut-out.
2. **Name** (asked on a card): Fantail Flight (recommended), Kererū Crash-Flap, Tūī Takeoff, or your own. The kererū is famous for clumsy flapping, but Pigeon's Number Line already uses a pigeon.
3. Decided in this plan unless James says otherwise: bump-and-carry-on (no game over) with +3 s; checks take 3 s off; answer gaps from level 3 take 2 s off; no rescue questions; no daily limit; Sky Dash after level 10.
