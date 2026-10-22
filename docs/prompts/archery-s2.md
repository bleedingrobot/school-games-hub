# Prompt: Archery Challenge Stage 2 (the fight screen against a bot)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-archery`.

---

You are continuing **Archery Challenge** (short id `archery`) for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). It's Scorched Earth with archers instead of tanks, designed by James with one of his pupils. Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

Stage 1 (the rules-and-physics engine in `shared/archery/`) is done. **This session builds Stage 2: the fight screen against a bot, in all four worlds, with the worlds' twists and the three bots.** It runs in the browser only, in a preview James can play on his phone. No server, no database, no sign-in.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Read `docs/ARCHERY-PLAN.md` all the way through, especially "Decisions", sections 1, 2, 3 (the worlds), 6 (bots) and 10 (graphics), and **"Stage 1 results"** with James's answers. What matters most:
   - **No aiming help of any kind** (James, 21 Oct 2026). No aiming line, guide, dotted path or ghost of the last shot. A flying arrow's trail fades within half a second, and nothing stays on screen. Angle and power are plain numbers that stay where the player left them between turns.
   - **Hilly land like Scorched Earth**, already in the engine. Don't make it flatter.
   - **Graphics must be top-notch** (it's the hub's showpiece game), and **it must stay smooth on classroom Chromebooks**.
   - **The wind stays the same all round** (James, 21 Oct 2026).
3. Read the engine: everything in `shared/archery/`, especially `config.ts` (the top comment: only + − × ÷, square root and floor while a fight runs, never `Math.sin`/`cos`/`atan2`/`pow`/`hypot`/`random`), `fight.ts` and `determinism.ts`.
4. Look at the look-and-feel mock-up James approved: https://claude.ai/artifact/212Yqc7RhBHV5akkoraeY6 (read it with the Artifact tool). Its four worlds, cliffs and colours are the starting point for the art. The bot there is called "Bolt" (a placeholder name).
5. Work only in this worktree, on branch `archery`. Never commit to `main`, never `supabase db reset`, never a bare `git push` (push with `git push origin archery`).
6. Merge `origin/main` into the branch first (`git fetch`, then `git merge origin/main`).
7. Read how Mine Runner draws smoothly and stays fast: `src/games/mine/MineRun.tsx` (a fixed-step loop with drawing smoothed between steps, the canvas's pixel density capped, automatic simpler graphics when frames get slow), `src/games/mine/TouchControls.tsx`, `src/games/mine/Accessibility.test.tsx`, `preview/mine/main.tsx`. Read how the space game's bot thinks in a Web Worker: `src/games/space/botWorker.ts`.

## What to build

### 1. The worlds' twists, in the engine (`shared/archery/`)
Each world plays differently from the start (plan section 3). Every twist goes in the engine, so the server can replay it later, with its numbers in `config.ts`:
- **Forest:** trees stand on the land (a new cell kind) and stop arrows until they're blasted away. Calmer wind (a smaller wind range for this world).
- **Desert:** sand slides. After a blast, loose sand slumps sideways into slopes as well as falling straight down. Stronger wind.
- **Snow:** slippery. An archer who lands on a slope slides downhill. Ice blocks (a new cell kind) bounce an arrow once.
- **City:** buildings are tough blocks (a new cell kind). A blast only chips them, so archers can shelter behind them. Rooftop ledges to stand on. **Only chips** (James's answer).
- The world becomes part of a fight's setup, so `playFight(seed, setup, shots)` gives the same result for the same world everywhere.
- Keep Stage 1's land checks passing in every world: a real hill (or building) between the archers, and they can't see each other in a straight line. Run the 1,000-seed hilliness numbers per world.
- Update `determinism.ts` to cover all four worlds, re-pin the fingerprint, and run `scripts/archery-determinism.mjs` in Chromium and WebKit (`PLAYWRIGHT_DIR=/home/james/.npm/_npx/e41f203b7505f1fb/node_modules WEBKIT_PATH=~/.cache/ms-playwright/webkit-2370/pw_run.sh`). If Playwright won't run, say so plainly.

### 2. The bots (`shared/archery/bot.ts`, pure functions)
Three levels (plan section 6), using the fight's own seeded random numbers, never `Math.random`:
- **Easy:** a guess first, then walks towards you (too far: less power; too short: more), with big wobble (±8 power, ±5°), and ignores the wind.
- **Medium:** works out a good power for a 45–60° shot without wind, ±4 power wobble.
- **Hard:** as Medium, then simulates its shot once or twice **with** the wind and corrects, ±2 wobble.
- **Every bot misses on purpose some of the time**, so a 9-year-old can win. No bot simulates more than 3 shots a turn.
- Bots use **Plain and Steel only** in this stage (the other arrows' effects come in Stage 3), each level with a fixed small kit. A bot must **never** pick an arrow that isn't for sale: use `botArrows()`. **The pupil's Glass Arrow stays unsold and unused** until Stage 3 builds its shards. Keep that test.
- The bot's shots go into the shot list like a player's, so a later server replay gets the same fight.
- In the browser the bot thinks in a Web Worker (copy `src/games/space/botWorker.ts`), so the screen never freezes.
- A bot simulator `scripts/archery-sim.mjs` plays bots against each other many times. Report how often each level wins against each other level, and how many shots a round takes. Also check how often a land has no shot that can hurt the other archer at the start (Stage 1 found about 1 land in 150). If the bots get stuck on those lands, tell James and suggest a fix. Don't change the land rules without asking him.

### 3. The fight screen (`src/games/archery/`, CSS prefix `.ar-`)
Drawn on a 2D canvas with our own art made in code (plan section 10). No images copied from anywhere, no new libraries.
- **Worlds with depth:** 3–4 background layers per world that shift slightly as the camera moves, a sky that suits each world, and living touches (drifting clouds, falling leaves or snow, heat shimmer, lit windows).
- **Land that looks like the screenshot James sent:** big rocky cliffs with layered, cracked, shaded rock, and each world's own top (grass, sand, snow, rooftops). Draw the land once to an off-screen canvas and redraw only the cells that changed after a blast.
- **Archers with character:** drawn in parts (body, head, bow arm, string), so they can draw the bow, hold, release, wobble when hit, cheer, and pop with stars and a cartoon "poof". **No blood, ever.**
- **Shots worth watching:** a short arrow trail that fades within half a second (never a lasting path), the camera following the arrow, a burst for each blast (dust, sparks), dirt falling, a small screen shake.
- **The bottom bar:** angle and power as **plain numbers** ("Angle 52°", "Power 67"), changed with buttons, sliders and keys (arrows, space to shoot); the arrow picker with how many are left; the wind (an arrow plus a number); a **Shoot** button; health bars for both archers. **Touch aiming:** drag back from your archer like pulling a bowstring. It changes only the numbers and the archer's pose. **It must not draw any line, dotted path or landing guess.**
- **Turns, rounds and the fight:** whose turn it is, the bot "thinking" for a moment, round over (new land), best of 3, and a fight-over screen with Play again. The HUD boxes from the pupil's drawing: **Arrows** (left in your quiver), **Score** (damage done this fight), **Best** (kept on this device only for now; the server keeps it from Stage 4).
- **Fast on a Chromebook:** a fixed-step loop with drawing smoothed between steps, pixel density capped at 1.5, at most about 300 particles, **automatic simpler graphics** when frames get slow, and a "simpler graphics" switch in settings. Respect reduced motion (no shake, gentle effects).
- **Looks like the hub around the play area** (guide section 2): the hub's colour tokens and shared buttons outside the canvas, every class prefixed `.ar-`, buttons at least 44 px, contrast 4.5:1, visible keyboard focus, focus moved to each new screen's heading. Copy Mine Runner's `Accessibility.test.tsx` for the fight screen.
- Don't add the game to `src/games/registry.ts` yet (that's the merge step). Make `src/games/archery/switch.ts` (`archeryOn()`, off) now if it helps, copying `src/training/switch.ts`.

### 4. The preview James plays on his phone
Replace Stage 1's plain test page in `preview/archery/` with the real fight screen: pick a world (Forest, Desert, Snow, City), pick a bot (Easy, Medium, Hard), then fight. A fixed bag of starter gear (some Steel Arrows). **It must never call the server** (the guide's warning: Marble's first preview did by accident). Build it as one file and publish it to the **same** test-page Artifact so the link James has keeps working: https://claude.ai/artifact/NW2b62yAKr8HNxfKtqxtG3 (read it first, then publish with `url`). Check it at 1366 × 640 and 844 × 390 (and a 390 px-wide phone in portrait) with headless Chromium before sending the link.

**Not in this stage:** the other arrows' behaviours, shields, helpers, bows and the Glass Arrow's shards (Stage 3), the server, migrations, coins and points (Stage 4 onwards), the home screen, Armory and speed round screens (Stage 5), classmate fights (Stage 6).

## Going quickly
James wants this to move fast. Once the worlds' cell kinds and setup shape are in `types.ts`/`config.ts` and committed, you may use helper agents in parallel, each on its own files: for example one on the worlds' twists in the engine, one on the bots and the simulator, and one on the fight screen's art. Fit their work together and check it yourself (the determinism fingerprint must be re-pinned once, at the end, by you). Helpers must not touch files outside `shared/archery/`, `src/games/archery/`, `preview/archery/`, `scripts/archery-*` and `vite.archery-preview.config.ts`.

## Before you say it's done
- Run `npx vitest run shared/archery src/games/archery` while you work. Then run `npm run typecheck`, `npm run test:all` and `npm run build`. Say plainly if anything fails, with the output.
- Write "Stage 2 results" at the bottom of `docs/ARCHERY-PLAN.md`: what you built, the numbers you chose (and why), the hilliness per world, the bot simulator's numbers, frame times (and when simpler graphics switched on), the tests, what's untested, questions for James, and anything for the go-live list.
- Commit, run `git push origin archery`, and **stop for James**. Don't start Stage 3 until he says so.
- Nothing goes live: no migration, no function deploy, no merge to `main`, no switching on.

When you stop, tell James in plain words what's ready, give him the test page link, and say what he needs to decide.
