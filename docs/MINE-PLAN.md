# Mine game ("Deep Dive"): plan

A 3D "fly a ship through underground mine tunnels" game for the hub, in the spirit of the 1995 game *Descent*: full freedom of movement in all directions, robots to shoot, coloured keys and locked doors, a reactor to blow up, and a dash to the exit before it goes.
Written 20 October 2026 (Stage 0: plan only, **no code yet**). Branch `mine`, folder `~/projects/school-games-hub-mine`, short id `mine`, CSS prefix `.mn-`. Next free migration number when this was written: `20261020000400` (re-check before the first migration).

**Status: waiting for James to read this and answer section 12.**

## The short version

- **Our own game, our own name.** *Descent*, its levels, robots, art and music belong to someone else. We use the idea (fly in 3D tunnels, shoot, keys, reactor), not their things. "Deep Dive" is a working name; James picks.
- **One rules-and-physics engine in `shared/mine/`**, pure TypeScript, no outside physics library, only add / subtract / multiply / divide / square root. Same recorded inputs in = same run out, on every device. So the **server replays a run** to check the finish time before it goes on the board, exactly as Marble Rush does.
- **Drawn with three.js**, which is already in the project (`three@0.186.0`, used by Marble Rush), so **no new dependency**. Loaded only when someone opens the game.
- **Solo play** against robots, with **school-only best-time boards**.
- **Classic-style shooting** (lasers, missiles, hostile robots) but with the kindness rules we use everywhere: robots only (no people), no blood, and **no game over** (a wrecked ship is rebuilt a little way back, with a few seconds added to the clock).
- **Maths** has two jobs, both from the shared maths focus system only: **answer gates** (a locked door asks a question; right answer = it opens) and **power-up pads** (right answer = shield, missiles or ammo; wrong = nothing, never a penalty). The server makes and marks every question.
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
| **Answer gate** (a locked door) | A coloured door shows a panel. "Fly up to the door and press Use" opens one question (the ship hovers; the robots keep out of the way for the 10 seconds the question is open, so it's fair). | The door opens. | The door stays shut. Try again (a **new** question each time, each question answerable once) or go and shoot something. No penalty. |
| **Power-up pad** | A glowing pad (shield, missiles, energy). Fly onto it and press Use. | A big refill of that thing (and a small bonus: +5 s off the clock at most 3 times a level so the rewards can't be farmed for time). | Nothing is lost; the pad stays so the pupil can try a new question (limit 3 tries a pad per run). |

Gates are needed to progress; pads are optional. A pupil who can't or won't do a question can still use the **key** that matches the door (keys are still found by flying and shooting). Honest design point: doors open with **either** the right key **or** a right answer, so maths is a way through, not a wall. A teacher switch sets whether maths is Off / Students choose / On, like Marble (default "Students choose"). With maths Off the pads become plain pick-ups and gates are just doors opened by keys.

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
6. **Gates vs keys.** I'd have doors open with *either* the right key *or* a right answer, so maths never blocks a pupil. Or should some doors **only** open by answering (so maths is required)?
7. **Boards.** One board per level per maths mode (with / without maths), top 10 plus you, own school only, display names only. And a limit of 40 counted runs a day per pupil?
8. **Where it goes in the queue.** Starting now alongside other branches (it only uses its own folders until Stage 5). Stage 2 is the first time you'd need to try something (a phone preview link).

## Stage results

*(Stages 1–6 will add their results here.)*
