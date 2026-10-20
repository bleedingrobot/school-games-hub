# Prompt: Mine Runner, Stage 2 (the screen and a phone preview)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-mine` (branch `mine`).

---

You are continuing **Mine Runner**, a Descent-style 3D mine-flying game for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then `docs/MINE-PLAN.md` (the plan, James's decisions at the top, and the "Stage 1 results"). Where they disagree, ask James.
2. You are already in the worktree for branch `mine`. Never commit to `main`, never `supabase db reset`, never a bare `git push` (use `git push origin mine`).
3. `git fetch`, then merge `origin/main` into `mine`. Run `node scripts/migration-numbers.mjs` and note the next free number (no migration is needed in this stage).
4. Read the Stage 1 code in `shared/mine/` (`config.ts`, `inputs.ts`, `level.ts`, `engine.ts`, `bot.ts`) so you use the real rules and don't invent new ones. Read Marble Rush's screen for the pattern to copy: branch `marble`, folder `~/projects/school-games-hub-marble` (`src/games/marble/renderer.ts`, `RunScreen.tsx`, `controls.ts`, `prefs.ts`, `marble.css`, `index.tsx`, `switch.ts`; `preview/marble/`; `vite.marble-preview.config.ts`).

## Stage 2: what to build
James's decisions: name **Mine Runner** (id `mine`, CSS prefix `.mn-`); New Zealand mines theme (levels and places are Stage 3, so use plain colours for now); Chromebooks **and** phones/tablets; classic-style shooting against robots (no people, no blood); key doors need keys, question doors need an answer.

Build the playable screen **with no server** and a **phone preview**:
- `src/games/mine/renderer.ts`: three.js (already in `package.json`; **no new dependency**). Perspective camera in the ship's nose. Flat-coloured low-poly look, no textures or outside art/audio. Build the mine's walls from the level's blocks (only the faces next to open space, merged into few meshes so a Chromebook keeps 30+ frames a second), coloured doors and keys, robots (three simple shapes), pickups, pads, reactor, exit, laser/missile shots, sparks when a robot is destroyed. Draw between steps (smooth the ship's position and view) while the rules run at their fixed 30 steps a second. Lazy-load three.js so the rest of the site doesn't get slower.
- `src/games/mine/MinePlay.tsx` (+ small screens): level picker (levels `l1`–`l6` from `RECIPES`), play screen with a heads-up display (shield, energy, missiles, keys held, clock, a "next goal" arrow that can be switched off), pause, restart, finish screen with the time. Use the real rules in `shared/mine/` (`makeLevel`, `makeWorld`, `newRun`, `stepRun`) and record the inputs with `packInput` / `pushInput`.
- Controls, all working and remembered per device: keyboard (WASD slide, R/F up-down, arrows turn, Q/E roll in free flight, Space laser, Shift/X missile), mouse (drag-to-look with optional pointer lock, click to fire), touch (two thumb sticks and big fire/missile buttons, left- and right-handed). Turn mouse movement into the whole-number turn per step and update aim about **10 times a second** so recorded runs stay small. Steady flight is on by default; free flight with roll is an option. A "less motion" setting (follows `prefers-reduced-motion`).
- A map (key M / button): the rooms visited so far as a simple see-through diagram.
- **Question doors and pads in this stage:** there is no server yet, so use a clearly-marked **trial maths** stand-in that makes simple questions in the browser **only inside the preview** (copy how Marble's preview does it, and show them with `QuestionModal` from `src/maths/QuestionModal.tsx`). A right answer sends `GRANT + n`, a wrong one `PENALTY`, exactly as the rules expect. Mark the stand-in so it can't be mistaken for the real server-made questions that come in Stage 4.
- Sounds: use only the existing `useSound` / `playSound` helpers if they fit; no new audio files.
- **Practice mode** (nothing saved; works with no server).
- A **phone preview for James**: `preview/mine/main.tsx` + `vite.mine-preview.config.ts` (copy Marble's), a fake signed-in pupil, **never calling the live server**. Build it with `npx vite build --config vite.mine-preview.config.ts` and publish it as a private claude.ai Artifact so James can open it on his phone (as was done for Marble and the other games). Add `mine:preview` to the **end** of `package.json` `scripts` and `dist-preview-mine/` to `.gitignore`.
- The game must stay off the site for now: add the code switch `src/games/mine/switch.ts` (`const ON = false; export const mineOn = () => ON || import.meta.env.VITE_MINE_ON === 'true'`) and **do not** add the game to `src/games/registry.ts` yet (that is Stage 5).

Own folders only: `src/games/mine/`, `preview/mine/`, `vite.mine-preview.config.ts`, `shared/mine/` (additions only; if you must change a rule, say so to James, update the pinned fingerprint in `determinism.test.ts`, and explain what changed). The shared edits allowed are the `package.json` script line and the `.gitignore` line above. Off limits: `shared/maths/`, `src/maths/`, `src/styles.css`, other games, `supabase/`.

## Quality rules
- Look like the hub: use the CSS colour tokens, the shared button classes, prefix every class with `.mn-`, and never style a bare element. Targets at least 44 px, contrast at least 4.5:1, visible keyboard focus, move focus to each new screen's heading, respect `prefers-reduced-motion`. Test at 1366 × 640 and 844 × 390. Copy Clan Quest's `Accessibility.test.tsx` approach (it reads the CSS).
- Flying in 3D can make people dizzy: keep the horizon steady, avoid camera shake by default, keep movement smooth.
- Words are short, kind and plain. Never show a pupil's year level.
- Tests as you go: the screen's logic (controls to inputs, the HUD, the map, picker), plus the accessibility test. Before saying the stage is done: `npm run typecheck`, `npm run test:all`, `npm run build`. Say plainly about any failure.
- Measure and report: frames per second on a throttled CPU if you can, and the size of the lazy-loaded three.js chunk.

## When you finish
Append a **"Stage 2 results"** section to `docs/MINE-PLAN.md` (built, decisions, tests, untested, go-live list), commit, `git push origin mine`, and **stop for James**. Nothing live (no migration, function deploy, merge to `main`, or switch on) unless James says so in words in this session, one step at a time.

Tell James in plain words: what's ready, the **preview link**, what to try (fly level 1, shoot a robot, open a door with a key, answer a question door right and wrong, try touch controls), and the questions you want him to answer (does flying feel good? dizzy? too fast or slow? too hard?).
