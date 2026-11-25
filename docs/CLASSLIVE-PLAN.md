# Class Live: plan

**Status: stages 1 and 2 merged (PRs #771, #772) and switched on for every class (PR #773), 24 Nov 2026 NZ. Stage 3 (Mystery Mural) built: server, `classlive_questions` (migration `20261124000700`), screens. Next: stage 4 (rewards, voice, art plan).** James asked (23 Nov 2026) for more creative whole-class games beyond Class Showdown: the projector is the show, every pupil's device is a controller, played live together. Game id `classlive`, migration `20261124000100` (check again: `node scripts/migration-numbers.mjs`).

## The short version

- **One live room, three games.** Class Live is a set of whole-class games that share one server, one join pop-up and one projector shell: **Star Web** (what else do we know from one fact?), **Serpent Chain** (snake maths: a chain of operations), and **Mystery Mural** (your own maths uncovers a hidden painting), plus **Four Corners** (run your avatar to a corner before the dice rolls; docs/CORNERS-PLAN.md), and **Ghost Tag** (run from the ghosts; caught pupils become ghosts; docs/GHOST-PLAN.md). The teacher picks the game; pupils join from the pop-up anywhere in the hub (the same pop-up Class Showdown uses).
- **Different from Showdown on purpose.** Showdown is a boss fight (and its later arenas are races and digs). Class Live games are about **thinking together**: building a web of facts, a long chain of steps, a picture nobody can see yet. No boss, no knockouts, no ranking by maths.
- **Star Web** is open-ended: one known fact (6 × 7 = 42) glows in the night sky; pupils type facts they can work out from it (7 × 6, 42 ÷ 6, 12 × 7, 60 × 7, 3.5 × 6...). The server checks each one is true and works out **how** it links (turn around, divide, double, halve, × 10, near fact, other link). Each new fact shoots a star into its constellation arm. Fill every arm and a sky creature draws itself across the stars. The teacher taps any star to put it big on the screen: "How do we know this?"
- **Serpent Chain** is a mental arithmetic chain: start at 7, then + 11, ÷ 6, × 2, ÷ 10, − 23, + 34... The projector shows a giant serpent winding over a jungle temple with the operations on its scales; every pupil works along it on their own device (their own pace), and their token climbs the serpent. Numbers stay hidden on the big screen until the end, when the serpent wakes and the answers light up scale by scale. Early finishers grow a bonus tail, so nobody waits.
- **Mystery Mural** uses each pupil's **own maths focus** (way A, like Showdown): every right answer lets the pupil flip one tile of a hidden painting on the projector. As the picture appears, pupils guess what it is (picture choices). Class goal: reveal it and guess it.
- **Fair and kind.** Mural questions come from each pupil's own focus pack (untimed ladder skills left out of live questions, James via the coordinator, 23 Nov 2026), one marked answer every 4 seconds, no speed bonus. Star Web and Serpent Chain are the same task for everyone but open-ended or self-paced, with three levels the teacher picks. Wrong answers are never on the projector. Names (first names) only appear for good things, and the teacher can hide them.
- **Flashy.** Night sky with parallax stars and shooting-star trails; a coiled serpent that breathes and wakes with a roar; tiles flipping with sparkles and a painted reveal. Sound only from the projector (Web Audio, like Showdown), announcer lines for Bella later.

## Decisions (made by Claude; James said not to wait, 23 Nov 2026)

| Question | Call |
|---|---|
| One game or three | **One game id (`classlive`) with three activities**: one switch, one server function, one set of tables, one teacher page. Each activity has its own title screen. |
| Who starts | Only the teacher, from the Games table drawer ("Open the big screen") or `/classlive` signed in as a teacher. |
| How pupils join | The class pop-up (`src/data/hubAsks.ts` `CLASS_GAMES`), one tap. |
| Star Web anchors | The teacher picks one of 3 levels (× facts up to 5, up to 10, up to 12) and a fact, or "surprise me". |
| Star Web check | The server parses `a op b = c` (one of + − × ÷, whole numbers or decimals to 2 places) and checks it exactly; then classifies the link (section 2). True but unlinked facts get "True! How does it link to 6 × 7?" and no star. |
| Serpent levels | Green (+ and − within 100), Gold (all four, × and ÷ by 2, 5, 10), Fire (all four, × and ÷ up to 12, numbers to 1000). 12 boxes, every running answer a whole number from 0 to 1000. |
| Serpent wrong answer | Two tries; then the right answer with its working ("18 + 11 = 29") and on to the next box. |
| Mural pace | One marked answer every 4 seconds, like Showdown. |
| Points | **Hub points like any maths game** for Mural answers (they're ladder questions); Star Web and Serpent Chain give a small fixed reward for taking part (stage 4). |
| Ladder | Mural answers are recorded with `recordMathsAnswers(…, 'classlive')`. Star Web and Serpent Chain aren't ladder questions and aren't recorded. |

## 1. A session, start to finish

1. **Teacher opens it.** The projector goes full window: a lobby painting for the chosen game, the class name, "Join now!". A slim teacher bar (game, level, Start, names on/off, end) folds away.
2. **Pupils join** from the pop-up; names fly onto the screen.
3. **Start.** A short "how to play" on the projector and each device, then go.
4. **Play** (sections 2 to 4). No clock by default; the teacher ends it (a 5, 10 or 15 minute timer is optional).
5. **Finish.** A big finish on the projector (the creature, the serpent waking, the painting revealed) and shout-outs; each device shows the pupil's own results.
6. **Again?** Same game, new fact / chain / painting.

## 2. Star Web

- **The anchor**: `a × b = c` with a dot array under it. Arms (each its own colour and constellation shape):

  | Arm | Counts when | Example from 6 × 7 = 42 |
  |---|---|---|
  | Turn around | `b × a = c` | 7 × 6 = 42 |
  | Divide | `c ÷ a = b`, `c ÷ b = a`, or a scaled one (`2c ÷ a = 2b`) | 42 ÷ 6 = 7, 84 ÷ 6 = 14 |
  | Double | a factor or the answer doubled (or 4 times) | 12 × 7 = 84 |
  | Halve | a factor halved (decimals welcome) | 3 × 7 = 21, 6 × 3.5 = 21 |
  | Tens | a factor × or ÷ 10, 100, 1000 | 60 × 7 = 420, 0.6 × 7 = 4.2 |
  | Near | one group more or less (a ± 1 or b ± 1), or c ± a, c ± b | 6 × 8 = 48, 42 + 6 = 48 |
  | Wild | any other true fact using a, b or c, or a multiple of c | 21 × 2 = 42, 168 ÷ 4 = 42 |

- Each new fact is a star with the finder's name (if names are on); the same fact again makes its star glow brighter ("Someone found that one: it shines brighter! Can you find a new one?").
- **Goals**: 3 stars in every arm draws the sky creature; 30 stars is a supernova. The iPad nudges towards the emptiest arm ("Nobody has halved yet!").
- **Spotlight**: the teacher taps a star; it zooms to the middle with the link drawn ("6 → 12 is double, so 42 → 84 is double").

## 3. Serpent Chain

- **The chain**: start number and 12 operations, made on the server from the seed and level; every running answer a whole number 0 to 1000.
- **Each pupil** sees one box at a time ("18 + 11 = ?"); the server only makes steps that work out exactly. The previous answer is carried for them, so a mistake doesn't spoil the rest: after two tries the right answer is shown with its working and they go on from there.
- **The projector**: the serpent coils over the temple with the operations on its scales; every pupil's token (a coloured gem with their first name) moves along; scales glow when anyone passes them; a "serpent stirs" bar fills with right answers.
- **Bonus tail**: a pupil who reaches the head gets 4 more boxes at a time, so fast workers keep going and the serpent grows longer on the big screen.
- **Finish**: the serpent wakes, the answers light up scale by scale, and the head roars the final number.

## 4. Mystery Mural

- **Grid size now (James, 25 Nov 2026):** the grid is sized when the teacher presses Start, from the players and the minutes (untimed counts as 5): tiles ≈ players × 6 right a minute × minutes ÷ 0.75, kept 3:2, 9×6 to 60×40 (`gridFor` in `shared/classlive/mural.ts`). 6 a minute is a class doing well, measured on the live game (24 pupils, 2 minutes: median 5.2, top quarter 5.9 right a minute each). So a class doing well uncovers about 75%; at most 80% can open, at a steady pace. Examples: 24 pupils × 2 min = 24×16; 25 × 5 min = 39×26. The bullets below are the first design; the code is the rule.
- **The picture**: a painting under a 12 × 8 grid of tiles. Each right answer (own focus, way A) lets the pupil flip a tile: they tap one on their device (tiles already flipped are greyed). It flips on the projector with a sparkle.
- **Guessing**: after 15% of tiles, each pupil may guess once per 20 tiles (6 picture choices). The projector shows how many have guessed, never what.
- **Finish**: all tiles flipped, or the teacher taps Reveal: the rest flip in a wave and the answer pops with the pupils who guessed it earliest.

## 5. Server and data

- **Rules** `shared/classlive/`: `stars.ts`, `serpent.ts`, `mural.ts` (pure), `server.ts` (the steps, shared by the edge function, tests and the preview, Showdown's pattern), `memoryServices.ts`, `pretendClass.ts`.
- **Function** `supabase/functions/classlive/`: teacher `open`, `view`, `start`, `spotlight`, `reveal`, `end`, `names`; pupil `join`, `play` (one activity step: a fact, a box answer, a tile, a guess), `ask` and `answer` (Mural).
- **Tables** (`20261124000100_classlive.sql`): `classlive_rooms` (the class reads the public view), `classlive_state` (hidden), `classlive_screens` (the projector's whole picture with first names and the newest numbered events: teachers only), `classlive_players` (own row; the teacher the room's). Stage 3 adds `classlive_questions` (hidden). Saves are compare-and-swap on the room's version. Switch `classlive_enabled`, names `classlive_names`, saved by `teacher_set_classlive()`.
- **Cost**: about 30 pupils, one step every 4 to 10 seconds: under 10 writes a second for one class.

### Adding an activity (database)

Since migration `20261125000800_classlive_activities` the activity list is the table `public.classlive_activities` (id, name, moves, max_speed, reward_line, sort). A new activity's migration only INSERTs: its row there (`moves = true` lets pupils save spots through `classlive_move`, clamped to `max_speed`), plus `achievement_measures` ('classlive_<key>') and `achievement_types` rows. Its trophies count `PupilReward.extra` ({ key: number }, 0 to 500 a session) in `rewardsOf`, which `classlive_finish` adds into `classlive_stats.extra` and `classlive_counts` returns as 'classlive_<key>'. Never create-or-replace `classlive_move`, `classlive_finish`, `classlive_counts`, `classlive_rules`, `classlive_here` or the activity check from a game's migration: several games are built side by side and the last one would wipe out the others. In the memory copy (`memoryMove`) every activity except stars, serpent and mural moves.

### Adding an activity (teacher's picker)

The Class Live page opens on a grid of games (James, 25 Nov 2026 NZ); tapping one shows only that game's options, with "← All games" back. A new activity adds one row to `LIVE_GAMES` in `src/games/classlive/gameList.ts` (id, name, emoji, one-line blurb, group `think`/`run`/`battle`, tint, picture) and renders its setup card in `Setup` (Projector.tsx) under `{pick === '<id>' && …}`. The same list feeds the Class Live card on the teacher's Today page, whose tiles link to `classlive?pick=<id>`.

## 6. Design checklist

1. **Big goal**: draw every sky creature (one per level), wake all three serpents, reveal every mural.
2. **Season game?** No.
3. **Play a day**: teacher-run, no limit.
4. **Progress**: the teacher's Settings drawer lists sessions played.
5. **Achievements** (stage 4): Star Finder (find 10 new facts), Serpent Rider (finish a chain), Sharp Eye (guess a mural first).
6. **Home card**: none (pupils join from the pop-up); a card for the Activities-style listing later.
7. **Guide**: the 20-second "how to play" at the start of each game, on both screens.
8. **Learning design**: Star Web shows **how** each fact links (the reasoning is the point); Serpent shows the working after two tries; Mural shows the right answer with the reason.

## Stages

| Stage | What | Live? |
|---|---|---|
| **1. The live room + Star Web** | migration, function, shared steps, projector shell, controller, join pop-up, Star Web rules and screens, pretend class test page, teacher "Open the big screen" | |
| **2. Serpent Chain** | chain maker, screens, waking finale | |
| **3. Mystery Mural** | way A questions, tile flips, guessing, reveal, stand-in paintings | |
| **4. Rewards and art** | points, achievements, painted lobby, sky creature, serpent and murals (ComfyUI), Bella lines | |

## Stage 1 results (24 Nov 2026 NZ)

- **Rules** `shared/classlive/stars.ts`: facts are read in many forms (`12 x 7 = 84`, `84 = 12×7`, decimals to 2 places), checked exactly in hundredths, and linked to the known fact: turn around, divide (any division whose multiplication links), double / halve (factors × or ÷ 2, 4, 8; "double one, halve the other" goes on Halve), tens (any × or ÷ 10, 100, 1000), near (a factor ± 1 or 2, or the answer ± one group), wild (any other true fact using the answer, or 2×, ½×, 10× it; not by adding 0 or × 1). Duplicates count as the same fact either way round (12 × 7 and 7 × 12), and make the star glow. One try per pupil every 1.5 s; 120 stars at most.
- **Server** `shared/classlive/server.ts` (`classLiveStep`), Showdown's compare-and-swap pattern. Instead of a feed table, the projector listens to **one screen row** holding the whole picture and the last 40 numbered events, so a refresh never replays or loses anything. A timed session ends itself on the first step after time.
- **Screens**: `Projector.tsx` + `StarSky.tsx` (setup, lobby with names flying in, the sky with seven arms, shooting stars, lit-arm lines, sky whale, supernova, spotlight with "how we know", finish with shout-outs), `Controller.tsx` (keypad and keyboard typing, feedback with the link and a nudge to the emptiest arm). Sounds are Web Audio (`audio.ts`), projector only.
- **Test page**: `npx vite --config vite.classlive-preview.config.ts` (`?pretend=30`).
- Tests: 4 (budget 8), plus `supabase/tests/database/classlive.test.sql`.

## Stage 2 results (24 Nov 2026 NZ)

- **Rules** `shared/classlive/serpent.ts`: chains made from the seed (Green: + and − to 200; Gold: all four, × ÷ by 2, 5, 10, to 500; Fire: all four, × ÷ to 12, to 1000), never the same kind twice in a row or a step that undoes the last, every running answer whole. Two tries, then the working; the tail grows 4 boxes ahead of the furthest pupil (48 boxes at most); 60% of the class's 12 boxes wakes the serpent.
- **Screens**: `SerpentScene.tsx` (jungle-temple serpent winding in rows, operations on its scales, pupils' gems below each operation, glowing passed scales, bonus tail, wake bar; numbers hidden until the end, when they light up box by box and the head roars the answer) and `SerpentPad.tsx` (the box as a sum, number pad and keyboard, two tries, calm "the answer was" card).
- Tests: 5 (budget 8).

## Stage 3 results (24 Nov 2026 NZ)

- Server: `ask` keeps the pupil's next way-A question (`makeQuestion` skips `isUntimed` skills), `answer` marks it on the server, claims it once inside the room's save (`classlive_save(..., claim)`, 'answered' if already claimed) and records it with `recordMathsAnswers(..., 'classlive')` (once key `classlive:<room>:<seed>:<slot>`). A right answer earns a flip (at most 3 saved up). `play {tile}` flips, `play {guess}` guesses; teacher `reveal`.
- Pupils' room view never has the picture until it's revealed (only the tile pattern and the choices).
- Database: `20261124000700_classlive_mural.sql` adds `classlive_questions` (no pupil or teacher access) and the open / load / keep question functions; the save gained `claim` (old 7-argument save dropped, same calls still work).
- Tests: one server test with a pretend class of 30 (flips, claim once, guesses, reveal); 6 of 8 in the budget. Database tests 28.

## Stage 4 results (24 Nov 2026 NZ)

- Rewards (`shared/classlive/rewards.ts`): when a session ends (time up or the teacher ends it) the server pays each pupil once: 1 point for joining, 3 for doing some maths (a star, a box right, a question right), +2 when the class reaches the goal (sky creature, serpent awake, picture guessed), +2 for guessing the picture; at most 10. `classlive_finish(room, done)` (migration `20261124000800`) pays once per room and session and keeps each pupil's totals in `classlive_stats`; the teacher's next view retries a failed payout.
- 8 trophies: Live on Stage, Stargazer, Head of the Serpent, Chain Master, Sharp Eye, Tile Flipper, Team Player, Class Live Star.
- Art (14 paintings) and Bella's 14 projector lines went live in PR #779.

