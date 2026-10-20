# Mine game ("Deep Dive"): plan

A 3D "fly a ship through underground mine tunnels" game for the hub, in the spirit of the 1995 game *Descent*: full freedom of movement in all directions, robots to shoot, coloured keys and locked doors, a reactor to blow up, and a dash to the exit before it goes.
Written 20 October 2026 (Stage 0: plan only, **no code yet**). Branch `mine`, folder `~/projects/school-games-hub-mine`, short id `mine`, CSS prefix `.mn-`. Next free migration number when this was written: `20261020000400` (re-check before the first migration).

**Status: James answered section 12 on 20 Oct 2026. Stage 1 built 20 Oct 2026 (rules only). Stage 2 built 20 Oct 2026 (the screen and a phone preview). Stage 3 built 21 Oct 2026 (roomier mines, six named levels, hard mode, medals, WebKit check). Stage 4 built 21 Oct 2026 (the server side and the screen wired to it). Stage 5 built 21 Oct 2026 (hub fit). Nothing live; next is Stage 6 (go-live prompt), only when James says.**

**Decisions (James, 20 Oct 2026):** name **Mine Runner** (id `mine`, prefix `.mn-`); theme **New Zealand mines** (Stage 3 picks the places, carefully, as for Marble); **Chromebooks + phones/tablets**; points and achievements **as listed in section 9**; boards as section 8 but **20 counted runs a day**; shooting **classic but tougher** (read as: rebuild costs +20 s instead of +10 s, and robots hit harder and shoot back more; all numbers live in `shared/mine/config.ts` so they're easy to retune); **doors: key doors need keys, question doors need an answer, a wrong answer costs shield and time**; **start Stage 1 now**.

## The short version

- **Our own game, our own name.** *Descent*, its levels, robots, art and music belong to someone else. We use the idea (fly in 3D tunnels, shoot, keys, reactor), not their things. "Deep Dive" is a working name; James picks.
- **One rules-and-physics engine in `shared/mine/`**, pure TypeScript, no outside physics library, only add / subtract / multiply / divide / square root. Same recorded inputs in = same run out, on every device. So the **server replays a run** to check the finish time before it goes on the board, exactly as Marble Rush does.
- **Drawn with three.js**, which is already in the project (`three@0.186.0`, used by Marble Rush), so **no new dependency**. Loaded only when someone opens the game.
- **Solo play** against robots, with **school-only best-time boards**.
- **Classic-style shooting** (lasers, missiles, hostile robots) but with the kindness rules we use everywhere: robots only (no people), no blood, and **no game over** (a wrecked ship is rebuilt a little way back, with a few seconds added to the clock).
- **Maths** has two jobs, both from the shared maths focus system only: **answer gates** (a question door opens on a right answer, a wrong one costs shield and time) and **power-up pads** (right answer = shield, missiles or ammo; wrong = nothing, never a penalty). The server makes and marks every question.
- **Points and achievements:** a small set through the new `hub_games` hooks (the shared progress functions are not touched).
- **Cost:** about 2 server requests per level for the run itself plus 1 per maths question (section 8). A class playing one lesson a week is a few thousand requests a month, against 500,000 free.

## 1. What's out there (and what we can't use)

Descent-style games exist as open-source engines (Descent 1/2 source ports such as DXX-Rebirth and D2X-XL; browser clones of the idea). All of them either run the original game's levels, robots, sounds and art (which belong to the original makers) or are desktop C/C++ programs under GPL licences, which would force our school code to follow the GPL. I haven't searched GitHub for this plan; before coding I'll do a quick check like Marble's plan did (section 1 of `MARBLE-PLAN.md`) and write it into the Stage 1 results. **Working assumption: write our own**, which matches how every other game here was built.

## 2. What makes it fun (the bits to keep) and what we change for Year 4–6

Keep:
- **Six directions of movement.** Up, down, left, right, forward, back, and turning in any direction. The tunnels twist around and go up and down, so it's easy to get lost, which is half the fun.
- **Keys and locked doors** in three colours (blue, yellow, red in the original). Find the key, go back to the door.
- **Robots that hunt you** and a **reactor** you destroy to start a countdown; then you run for the exit.
- **Shield, energy and ammo** you collect.
- **A map** to find your way.

Change:
- **No game over.** Run out of shield: the ship is rebuilt at the room you last entered (not the start), the clock adds +10 seconds, and robots there are back where they were. Never lose progress on keys or doors.
- **A "steady" flight mode** (on by default) keeps the ship level, so up is always up. Real rolling is an option for confident players. Free 3D flying makes many people dizzy and lost; steady mode is the single biggest thing that makes this playable by a whole class.
- **Count-up clock** with bronze / silver / gold, like Marble. No countdown except the reactor's own escape timer, which is generous on early levels.
- **A clear map and a "where next?" arrow** (a small arrow on screen pointing to the next key, door or exit), switchable off.
- **Short levels.** 2–5 minutes each. A first level that nearly everyone can finish in their first lesson.
- **Robots and rooms are friendly-looking** (chunky low-poly "mining bots", dull colours, little sparks when destroyed). Nothing human, no blood.

## 3. Level design

**Levels are generated from a seed plus a fixed recipe** (`shared/mine/level.ts`), not hand-drawn voxel by voxel. This keeps the data small, lets the server rebuild exactly the same level, and means a "daily mine" or endless levels are possible later.

- The world is a 3D grid of **cells** (say 8 × 8 × 8 units each). Each cell is solid or open.
- A recipe says: how many rooms, how many levels of height, how many branches, where keys and doors go, how many robots and of what type, how many pickups.
- Generator: place rooms on a coarse 3D grid, join them with tunnels that bend in all three axes (so it feels like Descent), then place the start, three keys + three matching doors in an order that always works (key 1 in the open, key 2 behind door 1, and so on), then the reactor room, then the exit. A test proves every level can be finished (a bot flies it).
- Six levels to start, getting harder, each a **fixed seed** in the code (so the board compares like with like). Names are placeholders; a theme would be a fun idea to settle with James (e.g. New Zealand: pounamu mine, gold-rush Otago tunnels, coal mine, volcanic caverns, glow-worm caves — same careful approach as Marble's New Zealand places; see question 3).

## 4. Physics and rules: why our own, and how it stays the same everywhere

Same reasoning as Marble (`MARBLE-PLAN.md`, section 4): the server must get a bit-for-bit identical run to the browser's.

- **Fixed steps.** The rules always move on in steps of 1/30 second, whatever the screen is doing. The screen draws in between (it smooths the ship's position and view), so a slow Chromebook still gets the same rules. 30 steps a second, not 60, halves the size of a recorded run and is plenty for a ship in tunnels.
- **Safe maths only.** Add, subtract, multiply, divide and square root are exact on every browser. `Math.sin` / `Math.cos` can differ slightly between Chrome and Safari, so the rules never use them. A 3D ship needs turning, so we keep the ship's direction as three arrow vectors (forward, up, right) and turn by a tiny amount each step using the safe "small angle" formulas (`cos ≈ 1 − θ²/2`, `sin ≈ θ`), then tidy the vectors with a square root so they stay straight and the right length. Turn amounts come from whole-number inputs (-N..N) so there is no mystery.
- **Everything else the rules need is whole-number or seeded**: robot choices use a seeded counter (the same little `lcg` Marble's determinism test uses), nothing uses `Math.random` or the real clock. Draw-only code (shake, sparks, flicker, sounds) is free to use anything.
- **Collision:** the ship is a ball; the mine is boxes. Ball-against-box is simple, fast and exact with the safe maths. Slide along walls instead of stopping dead.
- **A test proves it:** the same recorded run gives a bit-for-bit identical finish in Node, in Chromium and in real WebKit (Safari's engine), via the same Playwright setup Marble uses (`scripts/marble-determinism.mjs` is the model).

### What the recorded input is
Each step has: thrust in 3 axes (-1, 0, +1 each), turn left/right (−N..N), turn up/down (−N..N), roll (−1, 0, 1), fire laser, fire missile, and "use" (talk to a gate or pad). Mouse movement is turned into the whole-number turn each step; the stored number, not the mouse, is what's replayed.
**Biggest risk (answered in Stage 1):** a smooth mouse makes every step different, so the stored run is much bigger than Marble's. Plan: store each step as a few small numbers, join identical steps, then compress. A 3-minute level at 30 steps a second is 5,400 steps; I expect 10–25 KB as text. Marble's limit is 60 KB; ours will have its own limit set from the real measured sizes. If it's too big, the fallback is to make turning "stepped" (hold a key to turn at a steady rate) which compresses to almost nothing; mouse look would then only be a draw-time feel with the turn amount rounded for the record. That costs a little precision, not safety.

## 5. On screen and controls

- **three.js 0.186** (already pinned in `package.json`; no new dependency). Perspective camera in the ship's nose. Flat-coloured low-poly boxes and a handful of simple robot shapes; no textures, no outside art or music (nothing to license). Simple fog-and-light so rooms feel different (colour per level) and distant parts of tunnels fade, which also keeps the draw cheap. Instanced meshes for repeating wall pieces and a cell-based "only draw what's near" so a Chromebook keeps 30+ frames a second.
- **Lazy loaded** with the game, like Marble.
- **Controls (all must work, picked on the start screen and remembered per device):**
  - **Keyboard:** W/S forward/back, A/D slide left/right, R/F up/down, arrow keys turn, Q/E roll (roll only when steady mode is off), Space = laser, Left Shift or X = missile, Enter/E = use.
  - **Mouse:** drag or pointer-lock look (turn), left click = laser, right click = missile. Pointer lock is optional (some school Chromebooks inside iframes won't give it), with a fallback "drag to look".
  - **Touch (phones/tablets):** two on-screen thumb sticks (move left, look right), big buttons for fire / missile / use. Left- and right-handed layouts.
  - **Gamepad:** later, if anyone asks.
- Pause, Restart level, Sound on/off, "Steady view" (default on), "Less motion" (no camera shake, gentler wobble, follows the device's reduce-motion setting), "Arrow to next goal" on/off.
- A **map** key (M) shows the explored rooms as a simple see-through diagram you can turn; also a flat "level slice" view for small screens.

## 6. Modes

1. **Level run (solo).** Pick a level, fly it, get a time and a medal. Best time per level is saved.
2. **Practice (no maths, nothing saved).** Wide tunnels, slow robots, to learn the controls. Works with no server.
3. **Hard mode** (after finishing a level): faster robots, tighter escape timer, goes on the same board with a 🔥, like Marble.
4. **Later (not in the plan yet):** ghost race (a see-through copy of a classmate's best flight; needs no live connection), student-made mines. Parked unless James asks.

No live multiplayer. It needs constant server updates (expensive on the free plan and unfair on school wifi). Ghosts would give most of the fun for a fraction of the cost.

## 7. Maths (from the shared focus system only; nothing of our own)

Follows `GAME_DEVELOPMENT_GUIDE.md` section 4 exactly. The maths is **never** worked out in the browser.

**The two uses**

| Moment | What the pupil sees | Right answer | Wrong answer / skip |
|---|---|---|---|
| **Key door** (locked door) | A coloured door that needs the matching key. Fly the key to it and the door opens. | n/a | n/a (no question) |
| **Question door** (locked door) | A door with a panel. Fly up and press Use: one question appears (robots keep clear while it's open). | The door opens. | **The ship takes damage and time is added** (James, 20 Oct 2026). The door stays shut; try again with a **new** question (each question answerable once). |
| **Power-up pad** | A glowing pad (shield, missiles, energy). Fly onto it and press Use. | A big refill of that thing, plus a small time bonus (at most 3 a level, so it can't be farmed). | Nothing is lost and the pad stays (limit 3 tries a pad per run). |

**Doors (James's decision, 20 Oct 2026):** there are two kinds of locked door. **Key doors** open only with the matching key. **Question doors** open only by answering. A wrong answer at a question door costs a bit of shield and adds seconds to the clock, but never ends the run (the "rebuilt, +10 s" rule still applies if shield hits zero). The damage and time amounts are set in `shared/mine/config.ts` and go through the replay, so the server charges them too (a `PENALTY` input the server only accepts as many times as it marked wrong answers, like Marble's `REFUND`). With maths Off, question doors become key doors and pads become plain pick-ups. A teacher switch sets Off / Students choose / On (default "Students choose").

**How it works inside** (copy of Marble Rush, `docs/MARBLE-PLAN.md` section 7.2 and 4.3 of the guide):
- `start` → function reads `space_maths_context(player)` → `makeFocusPack(facts, parseFocus(focus), { enabledTables, division }, seededRandom(seed))` → makes about 12 questions for the level → stores them whole in `mine_questions` (RLS on, no policy, no grant) → returns to the browser only `publicQuestion(q, slot)`.
- The browser shows each with **`QuestionModal`** (never drawing `parts` itself). Every kind the ladder can make (typed, choices, decimal key, fractions with `choiceLabels`) works because `QuestionModal` handles them. A test runs every `LADDER` skill through the display (copy Marble's `maths.test.ts`).
- The pupil's answer is sent to the function (`answer`: `seed, slot, value, ms`); it loads the stored question, marks it, **claims the slot once** (`mine_claim_answer`), records it with `recordMathsAnswers(rpc, player, answers, '<seed>:<slot>', 'mine')` (so it counts in the pupil's records, ladder place and teacher focus results), and replies `{ correct, answer }`. The browser shows "7 × 8 = 56" after a wrong answer.
- **Replay stays honest:** the recorded input has a `GRANT` code for "opened a gate / took a pad by answer". The replay only accepts as many `GRANT`s as the server has marked right (Marble does the same with `BONUS` / `REFUND`). A made-up run can't open doors it didn't earn.
- Focus is fixed for a level. No warm-up needed (a pupil with no placement starts at the first skill).
- Server-side `mine_maths` setting (off / choose / on) on `app_settings`, `teacher_set_mine_maths()` and a panel `TeacherMine.tsx` (copy `TeacherMarble.tsx`), per class, using `require_settings_target()`. The focus itself is set on the shared **Set focus** page; no focus controls of our own.
- Two boards per level ("with maths" / "without"), as James chose for Marble, because maths changes how fast you get through.
- **Never shown to classmates:** wrong answers, anyone's maths results. Boards show display names and avatars only.

## 8. Saving, boards, fairness and server cost

**Run saving (same pattern as Marble Rush's M.4):**
1. `start`: the page asks the function for `{ type: 'start', level, mode, maths }`. It checks the sign-in (`userIdFromToken` from `_shared/signIn.ts`, deployed `--no-verify-jwt`), the **teacher switch** (refuses if the game is off for this class), the daily cap, then makes a stamped seed (HMAC, tied to student + level + mode, 6-hour life) and, with maths on, the question list. Returns seed + stamp + the public questions.
2. Play happens in the browser. Nothing is sent while flying, except one `answer` request per maths question (so a right answer is known before a door opens or a pad gives its prize).
3. `finish`: the page sends seed, stamp, level, mode and the recorded inputs. The server **replays** them with `shared/mine/`, works out the finish time itself, needs an actual exit reached, refuses a time faster than the real time since the seed was issued (+ slack), accepts only as many `GRANT`s as it marked right, then saves the run (a unique index on the seed means saving twice counts once), updates the pupil's best (keeps the inputs of the best run, in case ghosts come later), and awards points through `add_game_points`.
4. **Offline:** if the server can't be reached at `start`, the level can still be played as **Practice** and nothing counts (no server stamp, so no board). A finished run that couldn't be sent waits in a small queue and is sent later (Marble's queue pattern).
5. **Daily cap** on counted runs (recommend 40 a day; a keen pupil finishes a level in 3–5 minutes) so the board can't be farmed.

**Tables** (all `mine_` prefixed, RLS on; server-only ones have no policy and no grant): `mine_runs` (player, level, mode, maths on/off, finish steps, inputs text, grants, created), `mine_questions` (never readable by pupils), `mine_bests` (one best per player per level per maths flag, plus the best run's inputs). Pupils read their own bests through `my_mine()`; the board reads through `mine_board()` (top 10 and you, **own school only**, teachers and hidden profiles left out, word-names only), modelled on `marble_board()`. Every new function revoked from `public, anon` and granted only to who needs it (guide section 5).

**Server requests per class per lesson:** per level: 1 start + 1 finish + about 1 request per maths question (a level uses 4–8 questions, maybe 6 on average). That's about 8 per level. A class of 30 playing one 40-minute lesson, each finishing about 4 levels: roughly **1,000 requests a lesson**; once a week is about 4,000 a month, against a 500,000 monthly free limit. Nothing is sent while flying. Marble Rush is the same shape and costs the same. I'll put the number (and the daily cap) in the Stage 4 results.

**Switches (both start OFF):** a **code switch** in `src/games/mine/switch.ts` (copy `src/training/switch.ts`: `const ON = false; export const mineOn = () => ON || import.meta.env.VITE_MINE_ON === 'true'`, so only James's local copy can see it while building) and a **teacher switch** (`app_settings.mine_enabled`, `useTeacherSwitch` in the GameDefinition, set on the Teacher page through `teacher_set_mine()`). The function refuses requests while the teacher switch is off.

## 9. Points and achievements (through `hub_games`)

In its own migration, the game:
1. **registers itself** in `public.hub_games` with `switch_column = 'mine_enabled'`, `counts_fn` (pupil's counts for achievements), `rules_fn` (lines for the How points work page), `season_fn` (New Season clears runs, bests and question lists), `last_played_fn` (the teacher's "last played"),
2. adds **measures** (`achievement_measures`) and **achievements** (`achievement_types`, `game = 'mine'`),
3. gives points from the function with `add_game_points(player, 'mine', points, once)` (server key only; `once` = the run's seed so a retry earns once).

Proposed points (small, inside the shared 40-a-day solo cap, never ranked against maths): **2** for finishing a level the first time, **1** for each level you improve your time on (once a day per level), nothing for right answers (so nothing to farm).
Proposed achievements (about 8): *First dive* (finish level 1), *Mineshaft explorer* (finish all six), *Gold miner* (a gold on any level), *Untouchable* (finish a level without losing a shield), *Collector* (every pickup on a level), *Key master* (open every door with a key on a level), *Brain power* (open 10 gates by answering), *Speedy* (under the gold time on three levels). Final list: question 5 for James.

`supabase/tests/database/game_hooks.test.sql` shows a whole pretend game doing this; copy it. **We never re-create `progress_counts`, `progress_rules`, `rebuild_progress`, `my_progress`, `teacher_students`, `teacher_new_season`, `my_home_page` or `settings_of`.**

## 10. Every file this game will touch

**Ours (free to create and change):**
```
shared/mine/                      rules, config (every tuning number), level generator, bot, replay, save, maths glue; tests
src/games/mine/                   index.tsx (GameDefinition), switch.ts, MinePlay.tsx, renderer.ts, controls.ts, HowToPlay.tsx, mine.css (.mn-), accessibility test
src/data/mine.ts                  calls to our function and database functions
src/pages/TeacherMine.tsx         teacher panel (switch + maths + daily cap if needed)
supabase/functions/mine/          handler.ts, entry.ts, handler.test.ts, index.ts (generated)
supabase/migrations/<next free>_mine.sql              tables, functions, hub_games registration, achievements, app_settings columns
supabase/tests/database/mine.test.sql
preview/mine/ + vite.mine-preview.config.ts           phone preview, fake pupil, no live server
scripts/mine-sim.mjs, scripts/mine-determinism.mjs
docs/MINE-PLAN.md (this), docs/prompts/mine-golive.md
```

**Shared files: one-line edits only, at the end (stage 5), after merging `origin/main`:**
- `src/games/registry.ts`: import and append to the end of `GAMES`, behind `mineOn()`.
- `scripts/build-functions.mjs`: add `'mine'` to the end of `FUNCTIONS`.
- `package.json`: scripts only, at the end (`mine:sim`, `mine:preview`, `mine:determinism`).
- `shared/README.md`, `docs/PRIVACY-SUMMARY.md` (what we store and who sees it), `docs/PLAN.md` (the migration note), `.gitignore` (the preview's `dist-preview-mine/`).
- `src/App.tsx` only if a second page is needed (probably not: every game in `GAMES` gets `/#/mine`).

**Off limits from this branch** (stop and tell James if one is needed): `shared/maths/`, `src/maths/`, `src/styles.css`, `src/components/`, `src/auth/`, `supabase/functions/_shared/`, other games, any migration already on `main`, `package-lock.json` / dependencies, `CLAUDE.md`.

**Reused, not copied:** `useAuth`, `QuestionModal`, `readSettings`, `AvatarImage`, `useSound` / `playSound`, `MuteButton`, `userIdFromToken`, `recordMathsAnswers`, `seededRandom`, `publicQuestion`, `makeFocusPack`, `parseFocus`, `parseMathsSwitch`, `require_settings_target()`, `add_game_points`.

## 11. Stages

Every stage: merge `origin/main` first; own tests as I go; before saying a stage is done: `npm run typecheck`, `npm run test:all`, `npm run build`, and database tests on a scratch copy (`scripts/scratch-db.sh mine` / `scratch-test.sh`). Every stage ends with a "Stage N results" section here (built, decisions, tests, untested, go-live list), a commit, `git push origin mine`, and **a stop for James**. Nothing live without his word, one step at a time.

| Stage | What | Size |
|---|---|---|
| **0** | This plan. Nothing built. | done when James answers section 12 |
| **1** | `shared/mine/`: ship movement, collision, level generator (6 fixed seeds), robot behaviour, weapons, pickups, keys and doors, reactor and escape, input encoding, replay, a bot that flies every level, determinism test in Node. Measure real recorded-run sizes (section 4's risk). No screen. | Biggest piece |
| **2** | Screen: three.js drawing, camera, keyboard / mouse / touch controls, map, HUD, sounds, one level, practice mode, **phone preview for James** (the make-or-break "does it feel good, am I dizzy?" check) | Big |
| **3** | The six levels tuned, robots of 3–4 kinds, weapons feel, hard mode, medal times from bot runs, Chromium + WebKit determinism check | Medium (design and tuning) |
| **4** | Server: function, migration, tables, stamp / replay / board, maths gates and pads (server-made questions, marking, records), teacher maths switch, offline queue. Database tests on scratch copy | Medium–big |
| **5** | Hub fit: GameDefinition, registry line, teacher switch and panel, How to play, points + achievements migration, privacy notes, accessibility pass at 1366 × 640 and 844 × 390, slow-Chromebook check | Medium |
| **6** | Go-live prompt `docs/prompts/mine-golive.md`, then go-live one step at a time with James's yes at each: pre-flight; apply migration; deploy function; check from outside; merge to `main`; try as teacher; switch on | Small, careful |

## 12. Questions for James (my recommended answer first)

1. **Name.** "Deep Dive" (my pick), "Mine Runner", "Tunnel Rush", "Cavern Crawl", or your own. (Not "Descent": it belongs to the original makers.)
2. **Controls on school Chromebooks and phones.** Keyboard + mouse on Chromebooks, two on-screen thumb sticks on phones/tablets; "steady" flight on by default with real rolling as an option. OK? Should pupils be able to play on their own phones at home, or classroom Chromebooks only?
3. **Theme.** Plain "robot mine" (my pick, simplest), or New Zealand mines (pounamu, Otago gold-rush tunnels, a coal mine, glow-worm caves), done as carefully as Marble's New Zealand places? Either needs no photos or logos.
4. **How rough can the shooting get?** Your answer was classic-style. I'll make it lasers and missiles against dull-coloured mining robots, sparks and a flash when one is destroyed, no blood, no people. And a wrecked ship is rebuilt at the room you last entered with +10 s, never "game over". OK?
5. **Achievements.** Do the 8 in section 9 look right, and is "2 points for a first finish, 1 for an improved time (once a day per level)" about right?
6. **Gates vs keys.** Answered 20 Oct: key doors need keys, question doors need answers; a wrong answer costs shield and time.
7. **Boards.** One board per level per maths mode (with / without maths), top 10 plus you, own school only, display names only. And a limit of 40 counted runs a day per pupil?
8. **Where it goes in the queue.** Starting now alongside other branches (it only uses its own folders until Stage 5). Stage 2 is the first time you'd need to try something (a phone preview link).

## Stage results

### Stage 1 results (20 Oct 2026): the rules, no screen

**Built** (all in `shared/mine/`, pure TypeScript, nothing else on the site touched, nothing live):
- `config.ts`: every tuning number in one place (30 steps a second, ship speed and turn rate, robot types, damage, rebuild +20 s, wrong answer −20 shield and +6 s, pads, escape timer). "Tougher" is the rebuild cost, harder-hitting robots and faster shooting; retune here.
- `inputs.ts`: one whole number per step (push in 3 directions, turn left/right and up/down −6..6, roll, laser, missile) plus special codes `HOLD`, `PENALTY` (wrong answer) and `GRANT + n` (right answer for door or pad n). Encode/decode text, strict checking, play-back.
- `level.ts`: makes a mine from a recipe and seed. A twisty 3D maze of rooms joined by 3-block tunnels, always finishable (key 1 reachable with no keys, key 2 behind door 1, and so on; extra loop tunnels never go round a door). Six fixed recipes `l1`–`l6` (3–6 doors, 5–30 robots, more doors and robots as they go).
- `engine.ts`: ship flight with sliding wall collisions (ball against blocks, no outside library), steady and free flight, key doors that open by themselves with the key, question doors that open only on a `GRANT`, power-up pads, pickups, three robot kinds (drone, hunter, turret) that wake up on sight and shoot back, lasers and missiles (splash), reactor, escape timer, exit, rebuild after a wreck (in the last room entered, keys kept), `replay`, `stateKey`.
- `bot.ts`: a pretend pilot that flies each level by the same rules and records the same inputs a person would.
- `determinism.ts`: a long busy workload on all six levels in both flight modes; pinned fingerprint `ab9b563b` in Node.

**Decisions made along the way**
- Rules step at 30 a second (half Marble's 60), which halves recorded run size.
- Maths never touches the physics: `PENALTY` and `GRANT` steps are "held" steps (clock and ship stand still), as Marble's pauses are. The server will only accept as many `PENALTY` and `GRANT` steps as it marked wrong and right. A `GRANT` for something that isn't there or is out of reach is counted in `badGrants`, so a fair run has none.
- Robots sleep until they see the ship, and only chase while they can see it (no path-finding yet). They never stand in the middle column of a room, so a vertical shaft can't be blocked by one.
- Steady flight stops looking up or down at about 76°; a thing directly above or below has to be lined up by sliding sideways (the bot does this).
- Laser energy refills at 9 a second. At 4.5 a second the bot got stuck out of energy facing a turret down a long corridor.
- No `app_settings`, tables or shared files yet: that is Stage 4/5.

**Tests:** 55 in `shared/mine/` (inputs, level, engine, bot, determinism). The bot finishes all six levels, using only question-door `GRANT`s, and its recorded run replays to exactly the same final state. Full checks on top of merged `origin/main`: `npm run typecheck`, `npm run test:all` (207 files, 4,012 tests), `npm run build` all pass.

**Recorded run size (the plan's biggest risk): fine.** Bot runs are 5–26 KB of text (l1 5.4 KB for 70 s up to l6 26 KB for 5 minutes). A worst case where every step is different (a nervous mouse for 3 minutes) is 38 KB; holding the mouse number for 3 steps (10 aim updates a second) makes it 14 KB. At the 15-minute cap the worst case would be about 190 KB. So the plan is: let a saved run be up to **200 KB** of text, and have the screen update mouse aim about 10 times a second. No need for the "stepped turning" fallback.

**Not done / untested**
- Bot run times are a rough guide only: l1 70 s, l2 73 s, l3 119 s, l4 177 s, l5 248 s, l6 500 s (with 9 wrecks). Level 6 is too hard for a bot that never dodges; medal times and balance are Stage 3.
- The bot can't dodge, and robots can't path-find round corners, so real play will feel different. Stage 2 (your phone preview) is the real test.
- Determinism is only pinned in Node. Chromium and WebKit comparison is Stage 3.
- Level names/places (New Zealand mines), pickups' look, sounds: Stage 2–3.

**Go-live list so far:** nothing live. Next free migration number is `20261020000400` (re-check at Stage 4).

### Stage 2 results (20 Oct 2026): the screen and a phone preview

**Preview link (private artifact):** https://claude.ai/artifact/6VYHD91SJaZndP6ExbQbRf (rebuild with `npm run mine:single`, then publish `dist-preview-mine/mine-runner-test-page.html` with its doctype/head/body wrapper tags removed and the title set to "Mine Runner").

**Built** (own folders only; the only shared edits are the `package.json` scripts `mine:preview` and `mine:single` at the end, and `dist-preview-mine/` in `.gitignore`):
- `src/games/mine/renderer.ts` + `walls.ts` + `palette.ts`: three.js, flat colours, no textures. Walls are only the rock faces that touch open space, one mesh per room of the coarse grid (so out-of-view ones are skipped). Doors, keys, pickups, pads, reactor, exit, three robot shapes, lasers, missiles, sparks. Distance fog does the lighting. Draws smoothly between the 30-a-second steps. Lazy-loaded.
- `MineRun.tsx` (run, HUD, pause, map, question modal, finish), `MinePlay.tsx` (picker, how to play, controls, settings), `Settings.tsx`, `MineMap.tsx`, `TouchControls.tsx`, `session.ts` (one run held outside React: the rules' state, the recorded inputs, previous step, rooms visited, events), `guide.ts` (next-goal arrow that points at the next room on the way), `mapView.ts`, `controls.ts`, `prefs.ts` (per pupil on this device), `levels.ts`, `mine.css`.
- Controls: keyboard (WASD slide, R/F rise/sink, arrows turn, Q/E roll in free flight, Space laser, Shift/X missile, Enter use, M map, Esc/P pause), mouse (drag to look, quick tap fires, optional captured mouse with click to fire / right click missile), touch (two sticks, fire, missile, rise, sink, use; left or right handed; shown by itself on touch screens). Turning is decided 10 times a second and held for 3 steps.
- Practice mine (no questions, two slow drones, nothing saved), the six levels with trial questions, best times on this device only, `switch.ts` (off) and the game is **not** in `registry.ts`.
- `trialMaths.ts`: add/take-away/times questions made and marked in the browser, shown with `QuestionModal` and the note "Trial question (preview only). It is not saved." A right answer sends `GRANT + n`, a wrong one at a door `PENALTY`, a wrong one at a pad nothing (3 tries a pad). The real `MinePlay` (not the preview) only lets pupils play the practice mine until Stage 4.

**Decisions**
- Lighting is distance fog on unlit walls (a point light blew out close walls); robots and keys use a light that rides with the camera.
- Question door and pad use keys: Enter / U. (The plan said E, but E is roll.)
- Steady vs free flight is fixed when a run starts (the rules need it); changing it in Pause applies to the next run.
- The screen softens the picture on its own (down to half sharpness) if frames take over 45 ms for a second.
- Map: a slanted view of all floors, or one floor from above; rooms next to ones you have visited show as "?".
- Add `?debug` to the address and the page exposes the running session (`window.__mineSession`) so browser scripts can fly recorded inputs. Harmless; used for the screenshots.
- No shared rules were changed, so the pinned fingerprint is unchanged.

**Measured**
- three.js chunk: 544 kB (137 kB gzip), loaded only on starting a mine. Run screen chunk 48 kB (17 kB gzip). The site's own build is unchanged because the game isn't registered.
- Recorded run size for three minutes of a nervous mouse plus held keys: 12.3 kB of text (1,757 runs), well inside the 200 kB cap.
- Speed: only a software-rendered headless Chromium here (no graphics chip), so this is a worst case. Mine 1: 22 fps; Mine 6: 16 fps (4x slower CPU: 12 fps) at 1366x640, with only 27-32 draw calls and about 9,000 triangles a frame. The rules stayed at the right 30 steps a second throughout. A real Chromebook graphics chip should do far better, but this is untested on a real device.

**Tests:** 79 new tests (controls, prefs, trial maths, levels incl. the practice mine finishable, walls, session, guide, map, the screen with a stand-in picture, accessibility reading the CSS). `npm run typecheck`, `npm run test:all` (217 files, 4,091 tests, 1 skipped as before) and `npm run build` all pass.

**Looked at in a real browser:** 1366x640 and 844x390 (touch), picker, flying, map, pause. Fixed: blown-out lighting, full-width stacked buttons, cramped map and pause on a short screen, toast over the goal chip.

**Untested / for James:** how it *feels* (speed, dizziness, difficulty), real phone touch, pointer capture on a school Chromebook, sound, a real Safari. WebKit determinism is still Stage 3. Robots still can't path-find and the bot can't dodge, so real play will differ from the bot's times.

**Go-live list so far:** nothing live. Next free migration number `20261020000400` (re-check at Stage 4).

### Stage 3 results (21 Oct 2026): the six levels tuned

**James's feedback on the Stage 2 preview:** "the level felt tight, not much room to move." Answers: places picked by me; gentle first two levels; hard mode as a toggle with its own board.

**Built**
- **Roomier mines** (rules change, `config.ts`): tunnels 5 blocks across (was 3), rooms 7 or 9 across (was 5 or 7), rooms 18 apart (was 14). Bot times barely moved (l1 83 s, l6 about 460 s when it doesn't die).
- **Fourth robot, the brute** (slow, 110 shield-hits of armour, hits for 22, slow shot). Drawn as a block on tracks with a drill. Appears from mine 4. `mix` may now have a 4th number.
- **Gentle first two mines:** mine 1 has 3 robots (plus 1 guard), slow drones only; mine 2 has 5 (mostly drones, one hunter); escape timers longer.
- **Hard mode** (`hardRecipe`): same seed, so the same tunnels, keys and doors; 1.5x robots, 2 extra guards, more hunters/turrets/brutes, one fewer shield and missile pick-up, escape timer 0.4 shorter. Board ids `l1:hard` … `l6:hard`. Picker checkbox swaps every card to its hard version; "Next mine" stays in hard.
- **Medals** (`shared/mine/medals.ts`): gold/silver/bronze for all 12 boards, set from the pilot's clean time (its time minus the 20 s per rebuild it paid) x 1.15 / 1.6 / 2.4. Shown on the picker card (best time and goals) and the finish screen. A test keeps them honest (the pilot wins at least bronze everywhere, gold on mines 1 and 2).
- **Six New Zealand mine names**, none a real mine (some real places carry sad history; these name the kind of place): Greenstone Hollow, Otago Diggings, Coromandel Gold Tunnel, West Coast Coal Seam, Glow-worm Caverns, Volcanic Deep. Each has its own rock colours.
- **Determinism in real browsers:** `npm run mine:determinism` (with `PLAYWRIGHT_DIR`, and `WEBKIT_PATH` if the WebKit build number differs). **Node, Chromium and real WebKit give an identical 768-line report** (all twelve boards, steady and free flight). New pinned fingerprint `4376138e` (the rules changed, so the old `ab9b563b` was retired on purpose; nothing is live, so no saved run is affected).

**Bot times (s, with deaths):** l1 83/0, l2 86/0, l3 145/0, l4 261/3, l5 312/2, l6 576/9; hard l1 90, l2 107, l3 240/4, l4 398/9, l5 445/8, l6 750/16. The bot never dodges, so deaths on 4-6 overstate what a person suffers.

**Tests:** new `medals.test.ts`, picker tests for medals and hard mode, level-list tests; the Stage 1-2 tests all still pass with the roomier mines.

**Untested / for James:** whether the roomier mines now feel right; whether mines 1-2 are gentle enough and 5-6 hard enough for real Year 4-6 pupils (medal times are bot-based guesses until real pupils play); how the brute and hard mode feel; sounds; real phone and Chromebook. Medal times may need retuning after real play.

**Go-live list so far:** nothing live. Next free migration number `20261020000400` (re-check at Stage 4).

**Start view fix (21 Oct 2026, James):** the ship now starts looking down a tunnel, not at a wall (`startFacing` in `engine.ts`: the tunnel towards the reactor if it runs level, else the first level tunnel, else a slant up or down the shaft). Rules change, so the pinned fingerprint is now `e3b847d2` (Node, Chromium and WebKit still identical). The pilot's l5:hard run now dies a lot (it never dodges), so the medal test only asks it to finish on the two hardest hard mines.

### Stage 4 results (21 Oct 2026): the server, and the screen wired to it. Nothing is live.

**Built** (own folders only, plus one `package.json` script, `mine:sim`)
- **Migration `20261021000100_mine.sql`** (number checked free across `main` and every branch; re-check at go-live). Tables `mine_runs` (unique seed), `mine_bests` (one per pupil, mine and maths flag, with the best run's inputs), `mine_questions` (server only: RLS on, no policy, no grant). Functions: `record_mine_run` (daily cap 20, duplicate seed counts once, best kept), `mine_runs_today`, `mine_store_run`, `mine_load_run`, `mine_claim_answer` (each slot answered once), all server-key only; `my_mine()` and `mine_board(level, maths)` (top 10 and you, own school only, teachers and hidden profiles left out, names and avatars only); `app_settings.mine_maths` (default "choose") and `teacher_set_mine_maths()`. All functions revoked from public/anon. No `hub_games`, points, achievements or New Season step (stage 5).
- **Server function `mine`** (`start`, `answer`, `finish`; `--no-verify-jwt`, sign-in through `userIdFromToken`). `start`: teacher's switch, daily cap, HMAC-stamped seed (pupil + mine + flight + maths choice, 6-hour life), questions made with `makeSpacePack`/`makeFocusPack` from the pupil's focus and a seeded random, stored whole, only `publicQuestion` sent back. `answer`: marks against the stored question, claims the slot once, records through `recordMathsAnswers(..., 'mine')`, replies `{ correct, answer }`. `finish`: replays the inputs itself, works the time out itself, needs the exit, refuses a time faster than real time, then saves.
- **Shared additions** (`shared/mine/maths.ts`, `save.ts`): the question plan, marking, seed/stamp helpers, `judgeRun`. One rules addition: `makeWorld(level, { maths })`. With `maths: false` the question doors start open and a grant is refused. Default is unchanged, so **the pinned fingerprint `e3b847d2` is unchanged** and no re-pin was needed.
- **Screen**: `src/data/mine.ts` (start, answer, queue, bests, board, teacher switch), real flow in `MinePlay`/`MineRun` (each question shown with `QuestionModal`, sent to the server before a door opens or a pad pays, "7 × 8 = 56" after a wrong answer, finished run queued and sent), `MineBoard` (per mine, with/without maths, hard mode its own board, own place shown), a maths tick-box when the teacher says "students choose", a "School board" button on every mine. Offline: a notice and "Fly it as practice (nothing is saved)". The trial maths stays only in the phone preview.
- **Teacher panel** `src/pages/TeacherMine.tsx` (the maths switch only; not on the shared Teacher page until stage 5).

**Decisions made along the way**
- **Each question door and pad has its own block of question slots** (door: 6, pad: 3). A grant that opens a door must be backed by a right answer in *that* door's block, and the penalties in the run must equal the wrong answers marked at question doors exactly (leaving a penalty out would cut the time). A made-up run can't open a door it didn't earn, skip a penalty, or post an impossible time. If a door's six questions are all wrong the screen says so and the pupil starts the mine again.
- **Maths off means no questions, not no play.** A class with maths off (or a pupil who unticks it) flies with question doors open and pads doing nothing, on separate "without maths" boards. The server refuses a request that disagrees with the teacher's switch, in plain words, and the screen follows the switch.
- An answer sent again (reply lost) gets the same reply and counts once. The screen resends the first value if the pupil retypes after a lost reply.
- The shared body reader stops at 64 KB; runs can be bigger (200 KB cap), so the function reads its own body (220 KB limit). Nothing shared was touched.
- Recorded inputs in `mine_runs` are thrown away after 7 days (best run's copy stays in `mine_bests`), to keep the free database small.

**What is stored and who sees it** (for the stage 5 privacy note). Per saved run: pupil, mine, flight mode, maths flag, time, doors/pads opened by answer, wrong answers at doors, the recorded inputs (7 days). Per pupil per mine: best time and its inputs. Question lists with answers for each started maths run (thrown away after 2 days; never readable by pupils). Pupils see their own times and the school board: rank, display name, avatar, time. Nobody sees another pupil's wrong answers or maths results. Teachers see nothing new yet. Each answer goes into the pupil's normal maths records, ladder place and focus results.

**Tests.** `npm run typecheck`, `npm run build`, `npm run test:all` (224 files, 4,279 tests, 1 skipped as before) all pass. Function tests 47 (every refusal, plus the pretend pilot accepted on four mines with right answers, penalty case, no-maths case, `index.ts` up to date). Database tests `mine.test.sql` 65 checks on a scratch copy, all pass (pupils can't read the tables or call server functions, other schools' boards and bests hidden, hidden profiles and teachers off the board, unique seed, daily cap, claim once, inputs expiry). Screen tests for the server flow (21), data layer (15), teacher panel (4), every `LADDER` skill through `QuestionModal` typed and tapped (70). Looked at in a real browser at 1366 × 640 and 844 × 390 with a pretend server: picker, board, question, wrong answer, finish line, offline notice. Fixed: board columns, button widths.

**Server cost, measured** (`npm run mine:sim`, the real function against a scratch database): a class of 30 flying mines 1 to 4 (a quarter of question doors wrong first, two pad tries a mine) made **627 function requests** (120 start, 387 answer, 120 finish), 21 a pupil, 5.2 a mine, all replies 200, 120 runs saved, about 8.7 KB of run text each. Plus about 300 database reads from the browsers (settings, times, boards). Weekly that is about 2,500 function calls a month, every school day about 12,500, against 500,000 free. Mines 5 and 6 have more doors and pads, so a little more each. Daily cap: 20 counted runs a pupil.

**Untested / for James:** nothing has run against the real database, a real sign-in or a real focus (only the scratch copy and the function's own tests); a real phone or Chromebook; the wording of the new screens; whether 6 tries at a door and 3 at a pad is right. New Season does not clear Mine Runner times until stage 5.

**Phone preview** republished to the same private link (still no server: trial maths, fake pupil).

**Go-live list so far (nothing done):** apply `supabase/migrations/20261021000100_mine.sql` (re-check the number first), then `npm run build:functions -- mine` and `npx supabase functions deploy mine --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`, then check from outside. Stage 5 still has to add: the game's own switch and the function refusing while it is off, `hub_games` row (points, achievements, New Season, last played), registry line, `TeacherPanels`, `FUNCTIONS` list, privacy note, How to play numbers, accessibility pass.

### Stage 5 results (21 Oct 2026): fitting into the hub. Nothing is live.

**James's feedback after Stage 4:** aiming into a narrow shaft was very hard, and turning speed 2 should be the default. Done: **aim assist on the reactor** (`aimOf` in `engine.ts`: within 40 m, in clear view and within about 20 degrees of the nose, a shot flies straight at the reactor; numbers `AIM_ASSIST_RANGE` and `AIM_ASSIST_COS` in `config.ts`), and turning speed 2 for everyone who hasn't saved their own. The pinned fingerprint `e3b847d2` didn't move (the busy workload never fires at the reactor in range); a test covers the assist, and Node, Chromium and WebKit are still identical.

**Built**
- **Migration `20261021000200_mine_hub.sql`** (next free number was `20261021000200`; re-check at go-live): `app_settings.mine_enabled` (OFF), `teacher_set_mine()`, and the `hub_games` row `mine` with all hooks (`mine_counts`, `mine_point_rules`, `mine_players`, `mine_season`, `mine_last_played`), four measures and six achievements. No shared function re-created. The stage 4 migration (not live yet, so edited in place) now also keeps each run's `medal` and says `'first'` for a pupil's first finish of a mine.
- **Points** (given by the server function through `add_game_points`, inside the hub's daily cap): **2** for the first finish of a mine, **1** for beating your own best (once a day for each mine), nothing for right answers. Achievements are checked after every saved run.
- **Achievements (6):** First dive, Mineshaft explorer (all six), Gold miner (a gold medal), Gold rush (3 golds), Brain power (10 doors or pads opened by answering), Hard hat (a hard mine finished). I dropped *Untouchable*, *Collector* and *Key master* from the plan: they need things the server doesn't keep (damage taken, pick-ups, keys). They can come later with a migration.
- **The function now refuses `start` while the teacher's switch is off** (`game-off`, plain words on the picker), and gives the medal back with each saved run.
- **Hub fit:** `GameDefinition` `mineRunner` (group `easy-maths`, my pick), teacher switch hook, Teacher page panel (the game on/off and the maths switch, one panel), registry line behind `mineOn()` (still **false**), `mine` added to `FUNCTIONS`, How to play now says what the board and points are, `docs/PRIVACY-SUMMARY.md` and `shared/README.md` updated. `docs/PLAN.md`'s migration note is for go-live.
- Shared tests updated for the new functions and achievements: `security.test.sql` (callable function list) and `progress_access.test.sql` (83 achievements, was 77). Other branches adding achievements will need to bump that number too.

**Tests:** `npm run typecheck`, `npm run build` and `npm run test:all` (224 files, 4,292 tests, 1 skipped as before) pass. Function tests 54. Database: `mine.test.sql` 65, new `mine_hub.test.sql` 31, `security.test.sql` and `progress_access.test.sql` pass on a scratch copy built with both new migrations. Four other database tests that already fail on a scratch copy (clans midnight job, focus results day) are unchanged. Re-run server cost simulation: 620 function requests for a class of 30 on mines 1 to 4, all replies 200.

**Not done / untested:** a real phone or Chromebook, the slow-Chromebook speed check, a real sign-in, the live database. The accessibility pass was done by eye at 1366 x 640 and 844 x 390 with a pretend server plus the existing CSS test. The aim assist's feel (20 degrees) needs James.

**Go-live list (nothing done):** re-check migration numbers; apply `20261021000100_mine.sql` then `20261021000200_mine_hub.sql`; `npm run build:functions -- mine` and `npx supabase functions deploy mine --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`; check from outside; add both numbers to the migration-repair note in `docs/PLAN.md`; merge to `main`; try as a teacher; turn on `ON` in `src/games/mine/switch.ts`; the teacher switch. Stage 6 writes `docs/prompts/mine-golive.md` from this.

## Went live (21 Oct 2026)

- **Applied** to the live database, in order, with `supabase db query`: `20261021000100_mine.sql` then `20261021000200_mine_hub.sql`. No errors. Checked: `mine_runs` has 0 rows, 6 `mine` achievements, one `hub_games` row `mine`, `scored_games` unchanged at 427. The migration-repair note in `docs/PLAN.md` has both numbers.
- **Deployed** the `mine` function. Called with no sign-in it answers 401 "Please sign in again."
- **Checked from outside** by reading the database's permission lists: signed-out visitors can call no `mine_*` function and read no `mine_*` table; a signed-in pupil can call only `my_mine`, `mine_board` and the two `teacher_set_mine*` functions (which check for a teacher themselves); the tables are closed to everyone but the server. Not yet tried by actually signing in as a pupil.
- **Merged** to `main` as pull request #6 (code switch `ON = true`). "Test and publish" went green.
- **Switched on** for all classes by James's word, the same day: `app_settings.mine_enabled` set to true on all 4 class rows (by SQL, before the teacher trial in step 6).
- **Still to do:** the teacher trial (question doors right and wrong, a pad, finish a mine, boards and "Your best", Practice, hard mode, the maths switch, points and achievements on the progress page, James's phone), and watching the function logs and request count in the first lesson.
- To turn it off: Teacher page, Mine Runner panel, Switch Mine Runner off.
