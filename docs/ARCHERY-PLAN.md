# Archery Challenge: plan

A Scorched Earth–style game for the hub, with **archers instead of tanks**. Two archers stand on hills that blasts can carve apart. They take turns aiming (angle and power, with wind) and shoot over-the-top arrows at each other. Money comes **only** from a **maths speed round**, and it buys arrows, shields and bows in the **Armory**. Designed by James with one of his pupils, who drew the screens.

Written 21 October 2026 (Stage 0: plan only, **no code yet**). Branch `archery`, folder `~/projects/school-games-hub-archery`, short id `archery`, CSS prefix `.ar-`. Next free migration number when this was written: `20261021000300` (re-check before the first migration).

**Status: Stages 3, 4 and 5 built 22 Oct 2026 (James: "push on as far as you can", then "continue"), on the branch only. Nothing live: no migration applied, no function deployed, not in the games list. Waiting for James before Stage 6.**

**Decisions (James, 21 Oct 2026):**
- Archers, not tanks. Big, over-the-top weapons, mostly **special arrows** (like all of Scorched Earth's weapons). Shields and bows are smaller sections of the shop.
- **Money comes only from speed rounds.** Winning a fight earns no money. Money and gear are **saved** between games, and it should take several rounds to afford the best gear.
- **Fights are against bots or classmates.** Bots first, classmates straight after.
- **Speed round:** 10 s for the first question, then 9, 8 … 1, then the round stops (10 questions at most). **A wrong answer doesn't end the round.** Each right answer in time earns money.
- Speed rounds happen **between fights and from a home-screen button** (the pupil's "Times tables to get better" button, renamed to suit the focus).
- **No gear limit** in classmate fights: whoever did more maths brings better gear.
- **The four worlds play differently from the start.**
- **A few hub points.**
- **More Bows** = a bow shop: bows you buy and keep.
- **Graphics as good as we can make them**, while staying smooth on classroom Chromebooks.
- Also (section 13): 10 coins per right answer, 8 coin-earning rounds a day, **New Season wipes coins and gear**, best-of-3 fights, the plan's names kept, classmate challenges both in the game and from the hub Lobby, City buildings only chip.

## The short version

- **Our own game and our own art.** Scorched Earth belongs to Wendell Hicken, and the HTML5 copy we studied has no licence. We use ideas only: no code, art, sounds, terrain files or weapon names.
- **One rules-and-physics engine in `shared/archery/`**, pure TypeScript. The same seed and the same shots always give the same fight, on every device and on the server. It uses only + − × ÷ and square root (no `Math.sin`/`cos` while the game runs; aim directions come from a fixed table), as Mine Runner and Marble Rush do.
- **The server owns the money and the gear.** It makes and marks the speed-round questions, checks the shrinking timer, does all buying and selling, and checks every fight. Replaying a whole fight on the server is cheap (well under 100 ms), so it can count exactly which arrows were used.
- **Fights against bots** run in the browser, and the server replays them when they finish. **Fights against classmates** go through the server one shot at a time, with the server running the same engine (the Power Clash pattern).
- **Drawn on a 2D canvas** with our own art made in code: layered moving backgrounds per world, textured land, animated archers, arrow trails, bursts and stars. No new libraries.
- **Cost:** about 11 requests per speed round and 2 per bot fight. A class's lesson is roughly 1,500–2,000 requests (section 9), small against the free plan.

## 1. What pupils see (following the drawing)

**Home screen** (the pupil's layout): the title **Archery Challenge** at the top, the pupil's archer on a rock drawing a big bow, and a big **Play** button. Four world buttons, **Forest, Desert, Snow and City**, plus **Armory**, **More Bows** and the speed-round button. The pupil's button says "Times tables to get better". The focus decides the skill, so it needs a name that fits any maths: suggested **"Earn coins: speed round"**, with the pupil's wording kept as its little caption ("Times tables to get better" becomes "Maths to get better"). James and the pupil choose. The coin total sits top right.

**Play:** pick a world, then **Against a bot** (Easy, Medium, Hard) or **Against a classmate**. Then **Pack your quiver**: choose which arrows and shields to bring from what you own. Then the fight.

**The fight screen:** your archer on the left, the other archer on the right, each on blow-apart land in that world. The bottom bar has angle and power, shown as **plain numbers** (e.g. "Angle 52°", "Power 67") and changed with buttons, sliders or arrow keys. It also has the arrow picker (with how many you have left), the wind (an arrow plus a number, like "Wind 13" in Scorched Earth), and a **Shoot** button. Each archer has a health bar and a shield bar. The pupil's HUD boxes come back as **Arrows** (left in your quiver), **Score** (damage done this fight) and **Best** (your best fight score in that world). The settings icon opens sound and simpler-graphics options.

**No aiming help (James, 21 Oct 2026).** There's no aiming line, aim guide, dotted path or ghost of the last shot. Pupils **experiment** with angle and power to find the other archer, as in Scorched Earth. The numbers stay where you left them between turns, so "a bit more power" is a real choice, and that's the learning loop. A flying arrow has a short trail that fades within half a second, and nothing stays on screen.

**Between rounds of a fight** (a fight is best of 3 rounds; each round starts on fresh land with new wind): "Speed round for coins?" (optional), then a quick Armory stop before the next round.

**The target challenge** (the pupil's level screens: 10 arrows, targets at 5, 10, 20, 30 and 50 m, beat your high score) is a later stage (Stage 8). It reuses the same engine, worlds, arrows and bows.

## 2. The rules engine (`shared/archery/`, pure functions)

Everything that decides an outcome lives here, and the browser and the server both use it. All tuning numbers live in `shared/archery/config.ts`.

- **Field:** a logical 960 × 540 field (16:9), drawn scaled to the screen.
- **Land:** a **grid of 3 px cells** (320 × 180 = 57,600 cells, one byte each). It's small enough for the server to replay cheaply, and a grid (not a single hill line) allows tunnels, overhangs and dirt balls. It's made by midpoint displacement from the fight's seed: a random hilly line with each world's own roughness. **The land is properly hilly, like Scorched Earth (James, 21 Oct 2026, with a screenshot):** big jagged cliffs and mountains that fill most of the screen, peaks up to about 75% of the field's height, steep rock walls and deep, narrow valleys. Shots are mostly high lobs over rock. The start roughness is about 60–70% of the field's height, shrinking by about 0.58 each split (a little more than half keeps the edges jagged), with no smoothing pass. Some fights put an archer down in a valley and the other up on a ledge. The archers are placed in different dips or ledges, and a generator check makes sure **there's usually a real hill between them**, so a flat straight shot rarely works and angle and power both matter. A "flat-ish" check rejects land where the two archers can see each other in a straight line too often (the simulator measures this). Blasts clear cells in a circle, and some arrows add cells. **Loose dirt falls:** after each shot, any run of dirt with a gap under it drops until it lands. An archer with nothing under them falls. Fall damage is 1 per cell, capped at 25, and an Umbrella cancels it.
- **Shots:** an angle (whole degrees) and a power (whole numbers 0–100). The direction comes from a fixed table of unit vectors, one per degree, stored as numbers in the file, not worked out with trig. Gravity is about 300 px/s², and full power is about 600 px/s, so a full-power 45° shot goes about 1¼ screens: most good shots sit at 40–80 power. **Fixed time step 1/240 s.** Each step checks the arrow against the land cells and the archers' boxes. The wind is a whole number from −10 to +10 per round (about 6 px/s² per point, at most 20% of gravity), from the seeded random numbers. A "no wind" option can come later if it proves too hard.
- **Damage:** each arrow has its own peak damage, fading in a straight line to nothing at the blast's edge. A direct hit adds a small bonus: it's **never** an instant knock-out. A shield takes damage first, and anything left over hits health. Health is 100 per round. At 0 the archer **pops**: stars, a cartoon "poof", sits out the rest of the round. No blood, ever.
- **Turns:** players take turns. A round ends when one archer is left. A fight is best of 3 rounds.
- **Same in, same out:** a fight is a seed plus a list of shots `(angle, power, arrow, items used)`. `playFight(seed, setup, shots)` gives the whole result. A determinism check (copy of `scripts/mine-determinism.mjs`) proves Node, Chromium and WebKit agree.

**How we keep it fair without a gear limit** (James chose no limit): no arrow can knock out a full-health archer in one shot (the biggest hits about 60), shields soak but break, and good aim with plain arrows can still win. The balance simulator (`scripts/archery-sim.mjs`) checks this: a well-aimed archer with only starter arrows should still win a fair share against a richly equipped but average shooter. If they can't, the numbers change.

## 3. The four worlds (they play differently from the start)

Each world has one clear twist, shown on its button and in a one-line hint the first time:

| World | Look | Twist |
|---|---|---|
| **Forest** | layered hills, pine trees, sunbeams, falling leaves | **Trees** stand on the land and stop arrows until blasted away. Calmer wind (a good first world). |
| **Desert** | dunes, mesas, heat shimmer, a big sun | **Sand slides**: loose sand slumps sideways into slopes after a blast, not just straight down. Stronger, gustier wind. |
| **Snow** | snowy peaks, ice blocks, falling snow | **Slippery**: an archer who lands on a slope slides downhill. **Ice blocks** bounce arrows once. |
| **City** | skyline, rooftops, lit windows at dusk | **Buildings** are tough blocks: a blast only chips them, so archers can shelter behind them. Rooftop ledges to stand on. |

The twists are in the engine (so the server replays them too), and their numbers live in the config.

## 4. The Armory (our own names, mostly arrows)

Prices are in **coins**. A perfect speed round earns 100 (section 5). **Special arrows are scarce (James, 21 Oct 2026): most are sold one at a time, and a big one costs several perfect rounds.** Items unlock by **Armory level** (it goes up as you spend: levels 1–5) and sell back for half. You can carry at most 5 of each. The **Plain Arrow** is free and never runs out, so you can always fight. James kept these names (21 Oct 2026).

**Arrows** (the heart of the game):

| Arrow | What it does | Coins | Unlocks |
|---|---|---|---|
| Plain Arrow | small blast; unlimited | free | start |
| Steel Arrow | bigger blast | 50 for 2 | 1 |
| Rolling Log | lands, rolls downhill, bursts in a dip or at an archer | 60 each | 1 |
| Mole Arrow | digs a tunnel straight down (knock the ground out from under someone) | 40 each | 1 |
| Mud Ball | adds a ball of dirt: bury the other archer, or build a wall in front of you | 50 each | 1 |
| Arrow Rain | splits at the top of its flight into 5 small arrows | 150 each | 2 |
| Skipping Arrow | lands, then hops forward twice, with 3 growing blasts | 120 each | 2 |
| Sticky Goo Arrow | no crater; a goo puddle pools in dips and hurts anyone standing in it | 120 each | 3 |
| Earth Shaker | all floating dirt falls (drop someone off a ledge) | 100 each | 3 |
| Owl Arrow | gently steers toward an archer that's close to its path (you still have to get it close) | 250 each | 3 |
| Firework Arrow | 5 sparkly pops scattered around where it lands | 180 each | 4 |
| Sneaky Mole | tunnels toward the nearest archer and pops up under them | 220 each | 4 |
| Crossbow Bolt | a straight, fast shot with no drop, cuts through dirt, short range | 150 each | 4 |
| Giant Arrow | the big one: a huge blast with a shockwave of leaves and confetti | 400 each | 5 |

| **Glass Arrow** (the pupil's own arrow) | **The pupil's design (James, 21 Oct 2026, with a drawing):** "When it stabs them, shards keep hurting, like a poison effect. Should be the most powerful arrow in the game. Kills them next turn if they don't do anything in 1 turn." **James's answers (21 Oct 2026):** a direct stab **or a near miss** (inside its blast) leaves shards. The shards keep hurting, and the stabbed archer **pops at the end of their next turn unless they hit back** that turn (their shot damages whoever shot the Glass Arrow, which breaks the shards). In the code as id `glass`; not sold and never used by bots until its shards are built in Stage 3. | 500 each | 5 |

(The Feather Arrow, which left a dotted path to aim from, is gone: there's no aiming help.)

**Shields and helpers:** Wooden Shield (soaks 40, 100 coins), Wind Charm (soaks 30 and lifts arrows coming down on you, 150), Bubble Shield (soaks 60 and bounces the first arrow away, 250), Umbrella (no fall damage, 40 each), Apple (+15 health on your turn, 50 each).

**More Bows** (buy once, keep for good; the bow shows on your archer):

| Bow | What it changes | Coins |
|---|---|---|
| Starter Bow | the normal bow | free |
| Longbow | +10% top power (reach the far side in a strong headwind) | 300 |
| Recurve Bow | faster arrows that drift a little less in the wind | 400 |
| Hunter's Bow | shows what the wind will be next round (James, 21 Oct 2026: the wind stays the same all round) | 250 |
| Golden Bow | looks amazing; a little extra top power | 600 |

Bows change what you can see or reach, never how hard an arrow hits, and none of them gives an aiming line, so a well-aimed Starter Bow can always win. The bows and shields together cost about 20 perfect speed rounds. Special arrows get used up, so there's always something to save for. It's reachable within a season (New Season wipes coins and gear). The simulator and James's try-out will tune all of this.

**Gear and fights:** before a fight you **pack your quiver** from what you own. When the fight starts, the server takes the packed gear out of your store. When it finishes, the server replays the fight, counts what was actually used, and **gives back everything unused**. A fight abandoned part-way gives back unused gear too.

## 5. The speed round, in detail

- **Questions** come only from the shared maths focus: `makeFocusPack(facts, focus, settings, seededRandom(seed))` with the server's focus (`space_maths_context`). They're made and marked by the server (the guide's way A), and every answer is recorded with `recordMathsAnswers`. The round follows the class's multiple-choice switch. Each is shown with `QuestionModal`, with `secondsLeft` for the countdown, `scribble={false}`, a shorter feedback time (`timeScale`) and no close button.
- **Timer:** 10, 9, 8, 7, 6, 5, 4, 3, 2, 1 seconds, then the round ends. A wrong answer moves straight on to the next question.
- **Coins:** **10 coins per right answer in time**, so a perfect round earns 100. A round of 6 right earns 60.
- **One question per request.** The server sends question 1 and notes the moment it sent it (`served_at`). Each answer request carries `{seed, slot, value, ms}`, and its reply carries the mark **and the next question** (with its time limit). A round is 11 requests: start, then one per answer. Sending all 10 at the start would be cheaper, but then the server couldn't know when each question appeared, so it couldn't check the timer.
- **How the server checks the timer** (the 1-second question vs. school wi-fi): `ms` is the time the pupil's screen measured, from when the question appeared to the answer (QuestionModal measures it like this already). The server accepts an answer as **in time** when
  1. `ms` ≤ the limit (+ 0.2 s for a key tap), **and**
  2. its own clock agrees: (now − `served_at`) ≤ the limit + a network allowance (2.5 s).
  So slow wi-fi never costs a pupil a 1-second question, and a pupil can't cheat by sitting on a question. The only way to cheat is to fake the `ms` with developer tools, and even then they gain at most 2.5 s per question, for coins that only buy things in this game. Every answer's time is recorded as the smaller of `ms` and the server's own measure (Mission Control live does this).
- **A late answer only costs the coins.** An answer that's right but late is recorded as **right**, with its real time, for the maths records and the ladder. It just earns nothing. If the pupil's timer runs out without an answer, the browser sends `{timedOut: true}`: nothing is recorded, and the next question comes.
- **Harder questions:** a ladder question (fractions, percentages) at 2 seconds is out of reach for most pupils, and that's accepted: the round's later questions are the "bonus" ones. If that feels unfair in testing, an easy fix is to give questions from the harder packs +2 s (one number in the config).
- **Daily cap:** at most **8 coin-earning rounds a day** (the 54000 pattern from Marble and Mine). After that, the button offers a practice round: same questions, recorded for maths, no coins.
- **Money is not hub points.**

## 6. Bots

Three levels, all pure functions using the fight's seeded random numbers:
- **Easy:** aims like a beginner. Its first shot is a guess, then it walks toward you (too far → less power; too short → more), with big wobble (±8 power, ±5°), and ignores the wind.
- **Medium:** works out a good power for a 45–60° shot (no wind), with ±4 power wobble.
- **Hard:** as Medium, then **simulates its shot once or twice with the wind** and corrects, with ±2 wobble. It picks smarter arrows.
- **Every bot misses on purpose some of the time**, so a 9-year-old can win. A bot never simulates more than 3 shots per turn, so it's fast on a Chromebook.
- **Bots shop too:** each level gets a fixed, fair kit for its level (they don't have coins).
- The bot thinks in a Web Worker (copy `src/games/space/botWorker.ts`). Its chosen shots go into the shot list, so the server replays them; the server never runs bot thinking.

## 7. The server: tables, function, switches

**One server function `archery`** (`supabase/functions/archery/`: `handler.ts`, `entry.ts`, `handler.test.ts`, generated `index.ts`), deployed `--no-verify-jwt`, signing in with `_shared/signIn.ts`. Actions:

| Action | What it does |
|---|---|
| `load` | the pupil's coins, gear, bows, Armory level, best scores, rounds left today |
| `round-start` / `round-answer` | the speed round (section 5) |
| `buy` / `sell` | the Armory; one request each, safe if sent twice |
| `fight-start` | takes the packed gear, makes a seed and a stamped fight row; against a bot or a classmate |
| `fight-finish` (bots) | replays the shot list, checks it, gives unused gear back, saves the best score, gives points |
| `shot` / `times-up` / `leave` (classmates) | one shot at a time, checked and played by the server's engine |

**Tables** (all RLS on; pupils read only through `my_archery()`; written only by server-key functions):
- `archery_players`: one row per pupil: `coins` (≥ 0), `gear` jsonb (counts per item), `bows`, `armory_level`, `best` jsonb (per world), `version`.
- `archery_requests (player, request_id)` unique: a buy, sell or fight-start sent twice counts once (the Clan Quest pattern). Kept 2 days.
- `archery_rounds`: speed-round questions and `served_at` per slot (no policy, no grant: pupils can never read the answers; the `mine_questions` pattern), with a claim-once per slot.
- `archery_fights`: seed, stamp, players, world, packed gear, shot list, version, deadline, status. Bot fights are kept 2 days. Classmate fights are visible to their two players and added to the realtime publication (the Power Clash pattern).
- All coin changes go through one server-key-only function with `for update` and an expected version: `update … set coins = coins - price where coins >= price`. You can never spend money you haven't got, and a double tap can't spend twice.

**Switches:**
- **Code switch** `src/games/archery/switch.ts`: `archeryOn()` (off; `VITE_ARCHERY_ON=true` for local work).
- **Teacher switch**: `app_settings.archery_enabled boolean not null default false` + `teacher_set_archery(enabled, target_class)` (copy `20261021000200_mine_hub.sql`). The function refuses everything while it's off.
- **Teacher settings** (a small panel `TeacherArchery.tsx`): on/off, a **Classmate fights** on/off (default on), and **Reset coins** for a class (only if James wants it; see question 4).

**Classmate fights (Stage 6; the hub Lobby joins in Stage 6b):** the hub's Lobby, join codes and presence channels are shared files and functions (`lobby()`, `Lobby.tsx`, `is_player_in()`, `waiting_code_taken()`). To stay out of them, Archery has its own **"Challenge a classmate"** list inside the game: classmates who are in the game right now, from our own `archery_online(…)` function, same school and class only. Tap a name to send a challenge, and they see it pop up. Turns go through the server (`shot`), the server plays them with the shared engine, and both screens get the new state through realtime on the fight row, with the shared `useGameChecks` polling as a backup. Turn timer 45 s (a time-out uses up the turn), and 3 time-outs in a row ends the fight (unused gear returned, nobody earns anything). A tidy-up job ends idle fights. Joining from the hub's main Lobby (James wants both) comes in Stage 6b as its own small shared branch.

## 8. Points (through the `hub_games` hooks)

Registered in our own migration (the guide's section 5): `switch_column = 'archery_enabled'`, `counts_fn`, `rules_fn`, `season_fn`, `last_played_fn`. Points through `add_game_points(player, 'archery', n, once)`, inside the shared 40-a-day cap:
- **Finish a fight against a bot: 2 points (3 if you win).** Small, because a determined pupil could fake a bot fight (the same reason as `save-bot-game`).
- **Finish a fight against a classmate: 3 points (4 if you win).** The server ran every shot.
- **Speed round: 1 point for 5 or more right.**
- **Achievements:** first win in each world, win with only Plain Arrows, a perfect speed round, own every bow, and so on (about 10 achievements in all).

## 9. Server requests per lesson (class of 28)

| What | Per pupil | Class |
|---|---|---|
| Open the game (`load`) | 1–2 | ~50 |
| Speed rounds (11 requests each, about 3 a lesson) | ~33 | ~920 |
| Armory (buy/sell) | ~6 | ~170 |
| Bot fights (start + finish, about 3) | ~6 | ~170 |
| Classmate fights (1 per shot, ~30 shots each, about 1 fight per pair) | ~15 | ~420 |
| **Total** | | **~1,750** |

Five lessons a week is about 9,000 a week, or about 38,000 a month, against 500,000 free. The speed round is most of it. If that ever matters, the next step is to record the maths once per round at the end instead of per answer (fewer database calls inside each request, same number of requests).

## 10. Graphics (as good as we can make them)

- **2D canvas**, our own art drawn in code (paths, gradients, shapes): no images copied from anywhere, no new libraries.
- **Worlds with depth:** 3–4 background layers per world that move slightly as the camera moves, a sky that suits each world, and living touches (drifting clouds, falling leaves or snow, heat shimmer, lit windows).
- **Land that looks like land:** a textured fill with a coloured top edge (grass, sand, snow, paving), darker earth inside, and soft crater edges. It's drawn once to an off-screen canvas, and only the cells that changed are redrawn after a blast.
- **Archers with character:** drawn in parts (body, head, bow arm, string), so they can draw the bow, hold, release, wobble when hit, cheer, and pop with stars. Their bow and shield show.
- **Land like the screenshot James sent:** big rocky cliffs with layered, cracked, shaded rock, each world's own top (grass, sand, snow, rooftops).
- **Shots worth watching:** short arrow trails that fade within half a second (never a lasting path), the camera following the arrow, and a burst for each arrow (dust, sparks, confetti, goo, fireworks). A small screen shake and shields that ripple when hit.
- **Fast on a Chromebook:** a fixed-step loop with drawing smoothed between steps (copy `MineRun.tsx`), the canvas sized for the screen's pixel density (capped at 1.5), at most ~300 particles, and **automatic simpler graphics** if frames get slow (fewer layers and particles, lower pixel density; Mine Runner's trick). Respects reduced motion (no shake, gentle effects) and has a "simpler graphics" switch.
- **Tested at 1366 × 640 and 844 × 390**, with touch aiming (drag back from the archer like pulling a bowstring), sliders, and keyboard (arrows, space to shoot). Every button is at least 44 px.

## 11. Shared files it will touch (and when)

All at the very end (the merge step), each a small addition: `src/games/registry.ts` (append behind `archeryOn()`), `scripts/build-functions.mjs` (add `archery` to the end of `FUNCTIONS`), `package.json` (scripts at the end: `archery:sim`, `archery:preview`, `archery:single`, `archery:determinism`), `shared/README.md`, `docs/PRIVACY-SUMMARY.md`, `docs/PLAN.md` (the migration note), `.gitignore` (`dist-preview-archery/`). **Nothing else shared**: no Lobby, no `src/maths/`, no `styles.css`, no shared database functions.

## 12. Stages

Each stage is small and tested, ends with a "Stage N results" section here, a commit, `git push origin archery`, and a stop for James. Helpers can build parts of a stage at the same time where the parts don't overlap (for example, art and engine).

1. **The engine.** `shared/archery/`: seeded random numbers, the aim table, land made and carved, shots, damage, falling dirt and archers, turns and rounds, `playFight`. Tests and the determinism check. *Try it:* a plain test page to fire arrows.
2. **The fight screen against a bot.** Canvas drawing for all four worlds and their twists, archers, aiming by touch and keyboard, the three bots. Browser only, in a **preview** James can play on his phone (no sign-in, no server).
3. **The Armory's arrows.** Every arrow, shield, helper and bow working in the engine, with its own look. The balance simulator. *Try it:* in the preview, with a fake bag of coins.
4. **The server.** The migration (tables, switch, functions, points hooks), the `archery` function (load, speed round, buy/sell, bot fight start/finish), database tests on a scratch copy, and handler tests. Plus a trial backend in the preview so it all works there too.
5. **The rest of the screens.** Home (the pupil's layout), the speed round, Armory, More Bows, Pack your quiver, coins, How to play. *Try it:* the whole game in the preview against bots.
6. **Classmate fights.** Challenges, turns through the server, realtime, time-outs, tidy-up. A stand-in preview where two tabs play each other (copy `preview/power-clash/standIn.ts`).
   - **6b. The hub Lobby** (a separate small branch, `archery-lobby`): Archery fights listed in and joinable from the main Lobby and its code box. Only after James OKs the shared-file changes.
7. **Hub fit and polish.** Points and achievements, the teacher panel, accessibility tests (copy Clan Quest's), simpler-graphics mode, and a performance check on a slow machine.
8. **The target challenge** (the pupil's own level screens): 10 arrows, targets at 5–50 m, high scores.
9. **Go-live prompt** `docs/prompts/archery-golive.md`, then going live one step at a time, only on James's word.

## 13. Questions for James

**All answered on 21 Oct 2026:**
1. **Names:** keep the plan's names (Giant Arrow, Arrow Rain, Longbow …) and "coins".
2. **Coins:** 10 per right answer in time, with the prices in section 4.
3. **Daily cap:** 8 coin-earning rounds a day, then practice (maths recorded, no coins).
4. **New Season wipes coins and gear** (and Archery's points and best scores), so everyone starts equal each season. The `season_fn` hook resets `archery_players` to 0 coins, starter gear and the Starter Bow, and Armory level 1. Prices are tuned so the best gear is reachable well within a season.
5. **Fights are best of 3 rounds.**
6. **Classmate challenges: both.** The game's own "Challenge a classmate" list (Stage 6, on this branch) **and** joining from the hub's main Lobby. The Lobby part changes shared files and functions (`lobby()`, `Lobby.tsx`, `is_player_in()`, `waiting_code_taken()`), so, as the guide says, it's its own small branch with its own go-live, after Stage 6 (Stage 6b).
7. **Harder skills:** keep 10 → 1 s for everyone; add +2 s for harder skills only if it feels unfair when tried.
8. **City buildings only chip** when hit.

## Stage 0 results (21 Oct 2026)

- Built: this plan, and a look-and-feel mock-up (a private page for James to show the pupil). No game code.
- Research: the Scorched Earth HTML5 copy studied for ideas only (physics, land, weapon families, shop, bots), and the hub's own patterns (Mine and Marble for server questions, Power Clash for classmate turns, Dragon Maths and Clan Quest for saved coins, Mission Control live for timed answers).
- Next free migration number: `20261021000300`.
- Untested: everything (nothing built yet).
- Go-live list: none yet.

## Stage 1 results (21 Oct 2026)

**Built** (all in `shared/archery/`, pure TypeScript, no screens, server or database):
- `config.ts` (every number), `types.ts`, `random.ts` (seeded 32-bit integer random numbers), `aim.ts` (one direction per whole degree, written once by `scripts/archery-aim-table.mjs` and checked in), `land.ts`, `shot.ts`, `damage.ts`, `arrows.ts`, `fight.ts` (`playFight(seed, setup, shots)`), `determinism.ts`.
- Nothing uses `Math.sin`/`cos`/`atan2`/`pow`/`hypot`/`random` or a clock while a fight runs: only + − × ÷, square root and floor.
- A plain test page in `preview/archery/` (`vite.archery-preview.config.ts`): land as cells, archers as boxes, angle and power as numbers (buttons, sliders, keys), wind, Plain or Steel, Fire, New land, two players on one screen. No aiming line. It never calls a server (checked: 0 network requests). Built as one file with `ARCHERY_INLINE=1 npx vite build --config vite.archery-preview.config.ts && node scripts/inline-monsters-preview.mjs dist-preview-archery archery-test-page.html`, and published as a private Artifact for James: https://claude.ai/artifact/NW2b62yAKr8HNxfKtqxtG3

**Numbers chosen (and why):**
- Field 960 × 540, cells 3 px (320 × 180). Time step 1/240 s; a flight gives up after 20 s.
- Gravity 300 px/s², speed = power × 6 (full power 600 px/s), as the plan says. At full power an arrow moves 2.5 px a step, under one cell, so it can't skip through thin walls.
- Wind −10 to +10 per round, 6 px/s² a point.
- Archer box 12 × 24 px, arrow leaves 15 px above the feet. Health 100.
- Damage fades in a straight line to the blast's edge, measured to the nearest edge of the archer's box. Direct hit +10. **One shot can take at most 70** from one archer (shield, health and falling together), so no arrow is ever a one-shot knock-out.
- Falls: 1 per cell, capped at 25. Falls of 1–2 cells are free (stepping off a little lip).
- Rounds end when one archer pops (both at once is a draw), or after 60 shots, when more health wins. First to 2 round wins; draws can stretch a fight to at most 5 rounds. The first turn swaps each round.
- Loose dirt falls only in the columns a blast touched, so a tunnel elsewhere stays open (Earth Shaker's "all floating dirt falls" still means something).
- Arrows: Plain (blast 18 px, 25 damage), Steel (30 px, 40). Every other arrow has first-guess blast numbers and is marked "Stage 3"; until then it bursts like a plain arrow of its own size. The Giant Arrow is 75 px, 55 damage. The simulator (Stage 3) tunes all of them.
- Land: start roughness 0.65 of the height, shrinking × 0.58 each split, no smoothing. Peaks squeezed to at most 75% of the height; **land whose highest peak is under 65% is stretched up to 75%** (added after looking at the test page: some lands were too tame next to James's screenshot). Valley floors stay at least 8% up. Archers stand in the outer 6–30% of each side, half the time slid down into a dip. The land is remade from the next seed (up to 40 times) unless there's a hill at least 40 px above the higher archer's feet **and** the archers can't see each other.

**Hilliness over 1,000 seeds:** every land passed the checks (0 fell back), and the archers could see each other on **0**. On average the land rises and falls by **53% of the height** (half the lands 54% or more; 90% of them 37% or more). It takes 1.7 tries on average, and making 1,000 lands takes about 1.2 s (about 1 ms each).

**Can it be won?** With no wind, over 150 lands, a typical land has about 34 direct-hit angle and power pairs out of about 7,000, and about 68 that do some damage. So it really is "try and adjust", as James wanted. **1 land in 150 has no shot that can hurt the other archer at the start**: the hill has to be blasted away first. That's fair Scorched Earth play, so I left it, but a generator check could rule it out (it would cost about 15–30 ms per round). Stage 2's bots will show whether it matters.

**The pupil's Glass Arrow** arrived during this stage (James, 21 Oct 2026). It's in the table as `glass` with the pupil's description. It isn't sold, bots never pick it, and a fight refuses it (tested) until James answers the questions below. Its shards aren't in the engine yet (Stage 3). The drawing is kept privately with the pupil's other drawing, not in the repo.

**Tests** (`shared/archery/engine.test.ts`, `determinism.test.ts`; 26 tests): random numbers; the aim table matches `Math.cos`/`Math.sin` to within 1e-14; 1,000 seeds properly hilly with the archers almost never in sight of each other; a real hill between them; same seed same land; carving, dirt balls and dirt falling; archers falling with capped damage; flights the same every time, wind pushes both ways, a shot straight up comes back down on its own archer; damage fading, shields first, popping; **every arrow in the table fired as a direct hit on an archer on a thin ledge over a long drop never knocks out a full-health archer**; the Glass Arrow is never sold, never a bot's choice and refused in a fight; the shot checks (angle, power, unknown arrow, none left); turns, used-arrow counts, rounds with new land and wind, round endings, a whole fight to the end, paths only when asked.
- **Determinism:** pinned fingerprint `689ba069` (383 lines: 40 lands plus three long fights using every usable arrow). `node scripts/archery-determinism.mjs` with `PLAYWRIGHT_DIR` (and `WEBKIT_PATH=~/.cache/ms-playwright/webkit-2370/pw_run.sh`): **Node, Chromium and real WebKit give the identical report.**
- Test page checked in headless Chromium at 1366 × 640 and 390 × 844: no errors, no sideways scroll, no network requests.

**Untested:** the test page on a real phone or Chromebook (James's try-out); how hard the land feels to real pupils; every arrow except Plain and Steel (Stage 3); shields beyond "soak first" (Stage 3).

**James's answers (21 Oct 2026):**
1. **Glass Arrow, getting rid of the shards:** **hit back.** On their next turn the stabbed archer must damage whoever shot the Glass Arrow; that breaks the shards. Otherwise they pop at the end of that turn. (It breaks the "no knock-out arrow" rule on purpose, fairly, because there's always a turn to answer.)
2. **Near misses count too:** landing inside its blast leaves shards, not only a direct stab.
3. **500 coins, one at a time, Armory level 5.**
4. **Wind stays the same all round.** So the **Hunter's Bow shows next round's wind** (section 4 changed to match).
Stage 3 to settle: how much the shards hurt each turn before the pop (the "keeps hurting" part), and what happens if the Glass Arrow's shooter has already popped.

**Go-live list (so far):** at the merge step add `archery:determinism` and `archery:preview` / `archery:single` to the end of `package.json`'s scripts, and `dist-preview-archery/` to `.gitignore` (both left alone on this branch, as section 11 says).

## Stage 2 results (21 Oct 2026)

**Built** (branch `archery` only; nothing live, no server, no database):
- **The worlds' twists, in the engine** (`shared/archery/`, numbers in `config.ts`). The world is now part of a fight's setup (`FightSetup.world`), so `playFight(seed, setup, shots)` replays the same fight everywhere. New cell kinds `TREE`, `ICE`, `BUILDING`.
  - **Forest:** 5–8 pine-shaped trees stand on fairly level ground (never within 6 cells of an archer). They stop arrows; a blast clears tree cells 1.4× as far as dirt; an undermined tree falls like dirt. Calmer wind: up to 6.
  - **Desert:** after a blast, sand within 12 columns slides sideways off any column standing more than 2 cells above its neighbour, until it settles (never into an archer, at most 4,000 cells a shot). Smoother dunes; stronger wind: up to 14.
  - **Snow:** an archer left on a slope slides downhill a cell at a time (falling as they go, up to 40 cells) until level, in a dip, or against a wall; nobody slides on the flat spot they start on. 3–6 ice blocks; an arrow bounces off ice once (keeping 60% of its speed), and stops at the next ice. Wind up to 10.
  - **City:** a street of flat-roofed buildings (rooftops are ledges archers often stand on). A blast only chips a building (30% of its radius); buildings never fall. Wind up to 10.
  - `startFight` / `takeShot`: a fight played one shot at a time, exactly what `playFight` does (tested shot for shot), used by the screen and the bots.
- **The bots** (`shared/archery/bot.ts`, built by a helper and checked): Easy (a guess, then walks its power towards you, big wobble that settles a little, ignores wind), Medium (works out the power for a 45–60° shot that clears the hill, corrects from its own last arrow, ±4 → ±2), Hard (allows for the wind, then flies up to 3 practice shots on a copy and corrects, ±3). Every bot misses on purpose some of the time (15–25% of shots). Plain and Steel only, from fixed kits (Easy 1 Steel, Medium 2, Hard 3), only from `botArrows()`, so never the Glass Arrow (tested). Seeded from the fight itself, never `Math.random`. They think in a Web Worker (`botWorker.ts` / `botThread.ts`, the space game's pattern), falling back to the page (the one-file preview does this: about 2 ms a turn).
- **The fight screen** (`src/games/archery/`, `.ar-` classes): `FightScreen.tsx` (HUD, turns, rounds, fight over, keys, touch aiming, settings), `renderer.ts` + `art/` (the canvas art, built by a helper from the approved mock-up: layered backgrounds per world with parallax and weather, land drawn from the cells with smooth edges, layered cracked rock, each world's own top, trees, ice, buildings with lit windows, the archers in parts, arrow trails that fade within half a second, bursts, falling dirt, damage numbers, pops with stars, a windsock), `archery.css`, `prefs.ts` (simpler graphics, less motion, best scores on this device), `text.ts`, `switch.ts` (`archeryOn()`, off).
- **No aiming help**: angle and power are plain numbers that stay between turns; touch aiming (drag back from your archer) only changes the numbers and the archer's pose. A test checks the screen never hands the picture anything to draw a line or guess with.
- **The preview** (`preview/archery/`): pick a world, pick a bot, fight (best of 3, 4 Steel Arrows). It never calls a server (checked: 0 requests). Published to the same test page: https://claude.ai/artifact/NW2b62yAKr8HNxfKtqxtG3. Built with `ARCHERY_INLINE=1 npx vite build --config vite.archery-preview.config.ts && node scripts/inline-monsters-preview.mjs dist-preview-archery archery-test-page.html` (384 KB). The art helper's harness is `preview/archery/art.html`.

**Numbers chosen (and why):** world winds 6 / 14 / 10 / 10 (calm first world, the Desert's twist is wind); sand slides off steps over 2 cells (steep but loose); ice keeps 60% of the speed (a clear bounce that doesn't fly off the screen). City buildings 10–50 cells tall, and **buildings within 20 cells of an archer are cut down to 3 cells above their feet** (a low wall to shelter behind). The simulator found that without this, 45% of City lands gave the left archer no shot that could hurt at all (tall buildings walling them into a street); with it, about 1 in 40. This is a new City rule from this stage, not a change to the Stage 1 land rules. City ground made a bit higher (up to 50%) to keep it as hilly as the rest.

**Hilliness per world (1,000 seeds each, the Stage 1 test):** every world passes: at most 10 lands in 1,000 fall back or let the archers see each other, at least 900 in 1,000 rise and fall by 30% of the screen or more, average rise and fall over 40%. Every land has a hill (or building) at least 40 px above the higher archer between them.

**Bot simulator** (`node scripts/archery-sim.mjs 120`: 120 fights per pairing per world, seats swapped):

| Pairing | Forest | Desert | Snow | City | Overall |
|---|---|---|---|---|---|
| Hard beats Easy | 84% | 90% | 88% | 81% | 86% |
| Medium beats Easy | 82% | 58% | 60% | 61% | 65% |
| Hard beats Medium | 60% | 77% | 73% | 62% | 68% |
| Same level | about 50% each way everywhere | | | | |

- Shots per round (both archers): median 19 (Hard v Hard) to 32 (Easy v Easy); 6% of rounds reached the 60-shot cap (more health wins those), mostly Easy and Medium in the windy Desert and Snow.
- Lands with no Plain shot that can hurt the other archer at the start (150 per world, the round's real wind): Forest 13, Desert 2, Snow 8, City 2 (was 67 before the City fix). Bots still finish nearly all of those rounds (they blast the hill away).
- Bot thinking: 0.1 ms a turn on a running fight, about 2 ms with the replay; never more than 3 practice shots.

**Frame times** (headless Chromium without a graphics card, 1366 × 640 at 1.5× sharpness): 60 fps at full quality, about 1 ms of drawing a frame. With the processor at a quarter speed: about 30 fps at full quality, and **simpler graphics switched on by themselves during the first shot** (1× sharpness, fewer layers and sparks), then about 44 fps. At a sixth of the speed: about 30 fps in simpler mode. One frame per blast is slow (the land redraw). A real Chromebook still needs trying.

**Tests:** engine and worlds (`engine.test.ts` per world, `worlds.test.ts`: 20 tests on the twists), bots (`bot.test.ts`, 6), screen (`FightScreen.test.tsx` with a stand-in picture and bot: turns, keys, shooting, the bot's reply, Steel used up, settings remembered, no server calls), `Accessibility.test.tsx` (copied from Mine Runner: contrast, 44 px targets, movement only without reduced motion and never with Less motion, focus to each new heading, only `.ar-` selectors, shared buttons), `renderer.test.ts`. `npm run typecheck` clean, `npm run test:all` **4,487 passed** (240 files), `npm run build` fine.
- **Determinism:** re-pinned fingerprint **`c74ca8ad`** (758 lines: 15 lands in each world and five long fights across all four worlds). `scripts/archery-determinism.mjs`: **Node, Chromium and real WebKit identical.**
- Checked in headless Chromium at 1366 × 640, 844 × 390 (the bottom bar fits one row) and 390 × 844 (portrait shows a "turn your phone sideways" hint): no errors, no network requests, the one-file page plays on its own.

**Untested:** a real phone and a real Chromebook (James's try-out); touch aiming by a real finger; how long rounds feel to pupils; sound (the hub's beeps are wired in but not listened to).

**Questions for James:**
1. **Rounds are long-ish.** Even the Hard bot hurts with only about half its shots, because a Plain Arrow's blast is small (18 px) next to how far one power point moves the landing (about 15 px). A round takes about 20–30 shots between both archers. Would a slightly bigger Plain blast (about 24 px) or more damage be better for pupils? Easy to change (one number), but it changes every replay, so before Stage 4.
2. **The bot's name:** "Bolt" is still a placeholder (one name for all three levels, shown as "Bolt (Easy)").
3. **The City's low walls** beside archers (above): OK, or would you rather a generator check that throws out lands with no hurting shot (costs up to 50 ms a round)?
4. Starter bag in the preview: 4 Steel Arrows a fight. Bots get 1 / 2 / 3.

**Go-live list (so far):** as Stage 1 (scripts and `.gitignore` at the merge step), plus `archery:sim` in `package.json`.

## Stage 3 results (22 Oct 2026)

**James's answers first (21 Oct 2026):** a bigger Plain Arrow blast (18 → 24 px); Glass shards sting **12** a turn; if the Glass shooter has already popped, the shards just break; **a name per bot level: Pip (Easy), Robin (Medium), Hawk (Hard)**. Not asked, kept as they were: the City's low walls beside archers; the preview's starter bag.

**Built** (branch `archery` only; nothing live, no server, no database):
- **Every arrow works in the engine** (`shared/archery/effects.ts`, one small function each; numbers in `config.ts`), so the server can replay them in Stage 4:
  - **Steel**, **Giant**: bigger blasts. **Arrow Rain** splits at the top of its flight into 5 pieces spread sideways. **Rolling Log** lands, rolls along the land (speeding up downhill, climbing a cell at most), bursts at an archer, and if it runs out of speed on a slope it rolls back into the dip. **Skipping Arrow** hops twice: blasts of 16, 20 and 26 px. **Firework Arrow**: 5 pops around where it lands. **Owl Arrow** steers toward an archer it passes within 90 px of while coming down (the tests check it turns some near misses into hits). **Crossbow Bolt**: dead straight, no drop, no wind, cuts through up to 90 px of dirt, and pops at the end of its range (power sets the range: 60 + 3.2 × power px).
  - **Mole Arrow** digs a 96 px hole straight down (a direct hit digs from under that archer's feet, so they drop into it). **Sneaky Mole** tunnels from where it lands toward the other archer (at most 150 px) and pops up under them. **Mud Ball** drops a big ball of dirt that settles into a heap (it can bury an archer; a buried archer's next shot digs them out and never hurts them). **Sticky Goo** splashes without a crater, runs downhill into the dip and pools there; anyone standing in it loses 8 at the end of every shot for 4 shots (two turns each).
  - **Earth Shaker (changed from the plan):** the plan said "all floating dirt falls", but the engine already drops all loose dirt after every shot, so that would do nothing. Instead it **shakes the land 45 columns either side: cliffs crumble into slopes, and archers standing there tumble down** (the Snow's slipping, in any world). Same idea (drop someone off a ledge), and it works.
  - **The Glass Arrow (the pupil's):** a stab, or a near miss inside its blast, leaves shards. At the end of the stabbed archer's next turn: if their shot hurt the Glass shooter, the shards break with a sting of 12; if not, they **pop**; if the Glass shooter had already popped, the shards just break. Goo hurting the shooter doesn't count as hitting back. It's now **for sale** (500 coins, level 5). **Bots never use it** (its curse is for pupils to use, not for a bot to use on a pupil).
- **Shields:** Wooden (soaks 40), Wind Charm (soaks 30; while it holds, an arrow coming down within 70 px of the wearer is lifted and pushed away), Bubble (soaks 60; bounces away the first arrow that reaches it). **Changed after the simulator:** a shield now **lasts the whole fight and then breaks** (not full again every round). Refilled every round, a shield won 70–98% of otherwise even fights.
- **Helpers:** Apple (+15 health when eaten with a shot, never over 100), Umbrella (opens by itself on a fall that would hurt). Both are counted as used, like arrows, so the server can give back the rest.
- **Bows:** Longbow (+10% speed), Recurve (+5% speed, 70% wind drift), Hunter's (shows next round's wind on the screen), **Golden (changed: +10% speed and 85% drift, so it's never worse than the cheaper Longbow; the plan said "a little extra top power")**. None gives any aiming help.
- **Bots:** names per level (Pip, Robin, Hawk). Kits: Pip 1 Steel; Robin 2 Steel + 1 Arrow Rain; Hawk 3 Steel + 1 Firework. No shields. A bot shoots its strongest special arrow left when it decides to (only ones that fly like a Plain Arrow: Giant, Firework, Rain, Steel), never the Glass Arrow.
- **The fight screen:** your packed bag; an **arrow picker** (a button showing your arrow and how many are left, opening a list of what you packed, each with what it does); an **Apple** button (eat one with your next shot, when hurt); shield bars under the health bars; a loud **"Glass shards! Hit Robin this turn, or you pop."** warning; the Hunter's Bow's "Next:" wind; messages for goo, umbrellas, apples and shards. Fixed a Stage 2 slip: during your own shot the label said it was the bot's shot.
- **The picture:** a shot is now a little timeline (`ShotRecord.events`): several flights at once (Arrow Rain), hops, a rolling log, digging noses, pops one after another, a goo splash and puddles that wobble and bubble, an Earth Shaker rumble, "BOING!" off a bubble, glinting glass shards stuck in an archer, an umbrella opening on a fall, the Wooden Shield on their back, Wind Charm swirls, and each bow's own colours (the Golden Bow twinkles). Words: THUD!, SPLAT!, SPLOT!, POP!, KA-BOOM!, CRASH!, SHARDS!, SHATTER!, RUMBLE!
- **The preview:** after picking a world and a bot, **Pack your quiver** with **2,000 pretend coins** at the real prices (up to 5 of each; shield and bow too). It remembers your bag on that device. Still no server calls (checked: 0 requests).

**Balance simulator** (`node scripts/archery-sim.mjs 120`; `--balance` runs just the balance part):

| Bots | Forest | Desert | Snow | City | Overall (Stage 2) |
|---|---|---|---|---|---|
| Hard beats Easy | 87% | 92% | 95% | 84% | **89%** (86%) |
| Medium beats Easy | 77% | 68% | 64% | 63% | **68%** (65%) |
| Hard beats Medium | 77% | 76% | 73% | 75% | **75%** (68%) |

- Shots per round (median, both archers): Hard v Hard 16 (was 19), Medium v Medium 22, Easy v Easy 28 (was 32). The bigger Plain blast helped a little; 4.5% of rounds hit the 60-shot cap (was 6%).
- **Gear helps but aim still wins sometimes:** a good shot (Hard) with **only Plain Arrows** beats an average shot (Medium) carrying 5 each of Giant, Firework, Rain and Steel, a Bubble Shield and the Golden Bow **29%** of the time (8% before shields stopped refilling). An average shot with only Plain Arrows wins 16%.
- **Shields** (Medium with v without, everything else the same): Wooden 51%, Wind Charm 63%, Bubble 58%.
- **Each arrow** (Medium shooting it on every aimed shot, 5 of them, v Medium with Plain only): Giant 73%, Sneaky Mole 68% (was 73% before its range was cut from 260 to 150 px), Glass 63%, Owl 58%, Firework 57%, Log 56%, Mud 55%, Steel 53%, Rain 54%, Goo 54%, Skip 48%, Mole 43%, Shaker 43%. The last three are tricky arrows a bot uses badly; pupils who use them well should do better.
- Bot thinking still 0.1 ms a turn, never more than 3 practice shots.

**Tests:** `effects.test.ts` (29: every arrow, the Glass Arrow's four cases, shields, apples, umbrellas, bows, replays with everything), bot tests updated (kits, never Glass), screen tests (the picker, used-up arrows, the Apple button, the shield bar, the Hunter's Bow). `npm run typecheck` clean, **`npm run test:all` 4,517 passed** (241 files), `npm run build` fine.
- **Determinism:** re-pinned fingerprint **`4d54f767`** (706 lines; now with every shield, four bows, apples and umbrellas in the long fights). **Node, Chromium and real WebKit identical.**
- Played in headless Chromium at 1366 × 640, 844 × 390 and 390 × 844 with every arrow: no errors, no network requests.

**Untested:** a real phone and a real Chromebook; how the arrows feel to pupils (are Mole, Shaker and Skip worth buying?); whether the Wind Charm's push is noticeable enough (it's gentle: arrows land about 4 px further away on average, plus its 30 soak).

**Questions for James:**
1. **Earth Shaker** now crumbles cliffs and tumbles archers on ledges (the plan's "floating dirt falls" would have done nothing). OK?
2. **Shields last the whole fight, then break** (instead of full every round, which made them far too strong). OK?
3. **The Golden Bow** is +10% power and a little less wind drift (so it's never worse than the cheaper Longbow). OK?
4. **Bots never use the Glass Arrow.** OK, or should Hawk carry one?
5. Rounds are still about 16–28 shots. Shorter still (a bigger Plain blast again, or 80 health a round)?

**Go-live list (so far):** as Stage 2. Nothing new.

## Stage 4 results (22 Oct 2026)

James asked me to push on past Stage 3 overnight, so Stage 4 followed straight on. **Nothing is live:** the migration has only been run on a throw-away database copy, and the function hasn't been deployed.

**Built** (branch `archery` only):
- **Migration `20261021000300_archery.sql`** (the next free number, checked across `main` and every branch on 22 Oct 2026):
  - Tables, all with RLS on and no pupil access: `archery_players` (coins ≥ 0, gear, shields, bows, coins spent in all, best score per world), `archery_requests` (a purchase or fight start sent twice gets its first reply; kept 2 days), `archery_rounds` (a speed round's questions, when each was sent, the answers marked: pupils can never read it), `archery_fights` (seed, world, bot level, the packed quiver, how it ended).
  - Server-only functions, each doing its whole change in one go with the row locked: `archery_state`, `archery_shop` (buy or sell), `archery_round_start` / `_load` / `_answer` (a question is marked once, only after it was sent, and its coins go to the round and the pupil together), `archery_fight_start` (gives up any open fight first and gives its gear back, then takes the packed quiver out; refuses gear, a shield or a bow the pupil hasn't got), `archery_fight_load`, `archery_fight_end` (gives back what wasn't used, keeps a best score; a second end changes nothing).
  - Fights left open for over 2 hours (the page was closed) give **all** their packed gear back the next time the pupil opens the game (the shots weren't sent, so nothing can be counted as used).
  - The switch `app_settings.archery_enabled` (off to start) and `teacher_set_archery()`.
  - The hooks: How points work, **New Season wipes coins, gear, bests, rounds and fights** (James, 21 Oct 2026), last played. No achievements yet (Stage 7), so no counts hook yet.
- **Server function `archery`** (`supabase/functions/archery/`: `handler.ts`, `entry.ts`, `handler.test.ts`, built `index.ts`): `load`, `round-start`, `round-answer`, `buy`, `sell`, `fight-start`, `fight-finish` (with `left: true` for a fight given up part-way). Everything is refused while the teacher's switch is off.
  - **Speed round** (section 5, as planned): 10 questions from the pupil's maths focus (`makeFocusPack` through the space game's helpers, seeded), made and kept by the server and sent one at a time; 10 s, then 9 s … 1 s; the timer checked by the pupil's screen (+0.2 s for the tap) **and** the server's clock (+2.5 s for slow wi-fi); 10 coins per right answer in time; a late right answer is still recorded as right (just no coins); a timed-out question isn't recorded; every answer goes to the maths records with `recordMathsAnswers`; 8 coin-earning rounds a day, then practice.
  - **Armory:** prices and what one purchase gives come from the shop rules (`shared/archery/shop.ts`), never from the browser. **Armory levels by coins spent in all: 0, 200, 600, 1,200, 2,000** for levels 1–5 (a pupil doing 8 perfect rounds a day reaches level 5 in about 3 days). Carry at most 5 of each arrow or helper; sell one back for half.
  - **Fights:** the server replays every shot with the engine, **and works out every bot shot itself and checks it matches** (the plan said the server would never run the bots; it turned out to cost only about 0.1 ms a turn, and it means a made-up fight against a bot that always misses is refused). The pupil's own shots are the only thing the browser decides.
  - **Points** (through `add_game_points`, once each): finish a fight 2 (3 if you win); 5 or more right in a speed round 1.
- **`src/data/archery.ts`:** the browser's calls (the same requests for the real server and the trial one). A finished fight that can't be sent waits on the device and is sent later.
- **`src/games/archery/trialBackend.ts`:** the real handler running in the browser on a pretend database with the same rules as the SQL, for the preview (Stage 5's screens will use it) and for the function's tests.

**Tests:** database `supabase/tests/database/archery.test.sql` **53 checks pass** on a throw-away copy (pupils get 42501 on every table and server function; the switch; coins added once per answer; a question never sent can't be answered; purchases sent twice cost once; levels, carrying, owning; fights take and give back gear; a fight ends once; best per world; New Season wipes it all). `game_hooks.test.sql` (38) and `mine_hub.test.sql` (31) still pass on the same copy. Function tests 16 (sign-in, switch, both timer checks, slow wi-fi, sent twice, practice rounds after 8, prices from the shop, levels, gear checks, honest fights saved with points once, a faked bot shot refused, an unfinished fight refused, leaving part-way, the bundle up to date). Shop and speed-round tests 8, including **every skill on the maths ladder makes 10 questions the server can mark**. Data tests 3.
- `npm run typecheck` clean; `npm run test:all` **4,544 passed, 1 failed**: `MinePlay.test.tsx` "shows the time, the bests…" timed out with the computer busy; it passes run alone (twice). This branch doesn't touch Mine Runner. `npm run build` fine. Only `supabase/functions/archery/index.ts` was built (no other function changed).

**Untested:** the real function in Deno and against the real database (it needs deploying, which is James's call); how the speed round feels with 1-second questions on a Chromebook.

**Requests per lesson** are as section 9 said (a speed round is 11 requests; a bot fight 2).

**Questions for James:**
1. **Armory levels** at 0 / 200 / 600 / 1,200 / 2,000 coins spent: OK?
2. **The server checks every bot shot** (a small change from the plan, for fairness): OK?
3. A fight left open for 2 hours gives back all its packed gear. OK, or keep the gear (stricter, but a dropped Wi-Fi would lose arrows)?

**Go-live list (so far):** as Stage 3, plus: `archery` added to the end of `FUNCTIONS` in `scripts/build-functions.mjs`; re-check the migration number; apply `20261021000300_archery.sql`; deploy `archery` with `--no-verify-jwt`; the migration note in `docs/PLAN.md`; `docs/PRIVACY-SUMMARY.md` (coins, gear, best scores, speed-round answers kept 2 days, fights).

## Stage 5 results (22 Oct 2026)

**Built** (branch `archery` only; the whole game now plays in the preview against bots):
- **Home** (`HomeScreen.tsx`, `HomeScene.tsx`), in the pupil's layout: the **Archery Challenge** banner, coins top right (with a + that opens a speed round), the four world buttons, a big **Play**, and along the bottom **More Bows**, **Armory** and **"Earn coins: speed round"** with the pupil's words under it, "Maths to get better". Behind it, the world's own sky, mountains and hills from the fight art, with your archer on a rock drawing the bow and loosing an arrow into a target, over and over (a still picture with less motion). Picking a world goes straight to picking a fight.
- **Pick your fight** and **Pack your quiver** (`FightSetup.tsx`): the world, the bot (Pip, Robin or Hawk, with what each brings), then how many of each arrow and helper to bring (up to what you own, at most 5), your shield and your bow. It remembers the last fight and pack on the device. "Fight!" asks the server for the fight's seed and takes the packed gear out of the bag.
- **The fight** uses the server: its seed comes from the server; when it ends every shot is sent and the server replays it ("Saved: +3 points. Any arrows you didn't use are back in your bag."); Leave part-way sends the shots so far (unused gear comes back); Play again goes back to packing (the gear may be used up); between rounds there's a **"Speed round for coins"** button that opens a speed round over the fight. Best scores come from the server.
- **Speed round** (`SpeedRound.tsx`): rules first (10 questions, 10 s down to 1 s, 10 coins each, coin rounds left today), then each question in the hub's own **QuestionModal** with its countdown, no scribble pad and a shorter feedback pause; "+10 coins" under Correct!, or "Right, but just too slow for coins". When the time runs out: "Time's up! 7 × 8 = 56", then the next question. At the end: how many right, coins earned, the hub point. Practice rounds say so.
- **Armory** (`ArmoryScreen.tsx`): wooden shelves with tabs **Arrows** (in level groups), **Helpers**, **Shields**, **More Bows**; each item has its own little picture drawn with the game's art (`ItemIcon.tsx`), what it does, its price, how many you have, Buy and Sell (half back); locked items say which level opens them; the Armory level with a bar and "Spend N more coins to reach level 2". The + by the coins goes to a speed round and back.
- **How to play** (`HowToPlay.tsx`), every number read from the rules.
- **The hub's entry** (`index.tsx`, `ArcheryPlay.tsx`, `switch.ts` with `useArcheryEnabled`): the game card definition, the page talking to the real server, and the teacher's switch read through `readSettings`. **Not added to `src/games/registry.ts`** (that's the merge step), and the code switch stays off.
- **The preview** is now the whole game on the trial server (the real server function's logic in the browser), remembered on the device, with **Preview tools** (folded away bottom right): "+500 pretend coins" and "Start again". It never calls a server (checked: 0 requests).

**Checked in headless Chromium** at 1366 × 640, 844 × 390 and 390 × 844: a speed round answered 10 of 10 (100 coins, the point), buying a Steel Arrow, a Rolling Log and a Wooden Shield, More Bows, packing, starting a fight, shooting, leaving (coins and gear add up exactly): no errors, no network requests. The home screen needed a fix on a sideways phone (the archer was hidden behind Play) and now has room.

**Tests:** `ArcheryGame.test.tsx` (5: home buttons and focus, switched off, a speed round earning coins, Armory → pick → pack → fight from the server's seed → leave with gear back, How to play), `maths.test.tsx` (every built ladder skill, typed and tapped, shows in the speed round's question box and takes the right answer), the accessibility test widened to every new screen (shared buttons, focus to each heading, white words on every home button and paper words at least 4.5 : 1). `npm run typecheck` clean, **`npm run test:all` 4,619 passed** (246 files), `npm run build` fine.

**Not done yet (later stages, as planned):** classmate fights (Stage 6), the teacher panel with the switch, achievements, the simpler-graphics check on a slow machine (Stage 7), the target challenge (Stage 8). **Untested:** a real phone and Chromebook, real pupils.

**Questions for James:**
1. The speed-round button says **"Earn coins: speed round"** with "Maths to get better" under it (the plan's suggestion). OK, or the pupil's own words?
2. Home has no "target" button yet (the pupil's target challenge is Stage 8).
3. The preview's "+500 pretend coins" is only in the preview, never in the real game.

**Go-live list (so far):** as Stage 4, plus: `archeryChallenge` appended to `GAMES` in `src/games/registry.ts` behind `archeryOn()`; the teacher panel (Stage 7) so teachers can switch it on.
