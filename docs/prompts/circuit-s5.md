# Prompt: Circuit Racer Stage 5 (painted art wired in, sounds)

Paste everything below the line into a new Claude Code session opened in the Games Hub folder.

---

Build Stage 5 of **Circuit Racer** (game id `circuit`, CSS prefix `.cr-`) for School Games Hub (GitHub bleedingrobot/school-games-hub): **the painted art wired in everywhere, and the sounds**, live but still **switched off** (code switch stays OFF until Stage 6). Use your own git worktree from `origin/main`, on a branch named `circuit-s5`; commit and push early.

**Read first**
- Project memory (`C:\Users\Giant\.claude\projects\C--Users-Giant-Games-Hub\memory\MEMORY.md`, then james-preferences.md, circuit-roads-feedback.md, circuit-art-pr.md, circuit-s4-pr.md, live-means-published.md, games-hub-setup.md).
- `docs/CIRCUIT-PLAN.md`: the Decisions table (settled by James, don't re-ask), sections 3 to 6, and "Stage 4 results".
- `docs/CIRCUIT-ART-PLAN.md` in full, above all **"Wiring left for Stage 5 proper"** (Stage 4 already did the world map and the world backdrops as the race sky).
- `docs/game-guide/README.md`, then 6-art-and-sound.md, 7-testing.md and 8-going-live.md.
- What you build on: `src/games/circuit/` (`CircuitGame.tsx` world map and finish screen, `RaceScreen.tsx`, `renderer.ts` with `LOOKS` per world, `textures.ts`, `Volt.tsx`, `circuit.css`), `src/games/sounds.ts` (the shared `playSound` names), and the paintings in `src/games/circuit/art/paint/` (contact sheet: https://claude.ai/artifact/9EkJufZmi7HZ9CMfcw7MbJ).

**James's look rules (don't re-ask):** art first, big paintings, buttons in a slim row on top of the painting, no clutter; flashy, lively animation; he loves the neon look (keep the glow and bloom). This PC runs ComfyUI: paint anything missing as part of the work, unasked (`scripts/game_art.py circuit paint ...`, see the art plan).

**To do**
1. **Finish screen:** `finish/<world>.webp` (and `-800` on small screens) full window behind the time, medal, stars and 🔥, with a flashy arrival (medal drops in, sparks, the time counting up).
2. **Dashboard:** `dash/frame.webp` behind the speed, battery and signal gauges (line them up with its recesses), keeping the time, Auto-Pilot light and the hard-mode 🔥 clock readable on a phone.
3. **Tiles:** the six painted tiles mixed into the code-drawn tile materials, per world tinted by `LOOKS` / `BOARDS`; keep the neon rims and bloom, fall back to `textures.ts` if a picture is missing (overclock and recharge are not square: set the repeat by their own size).
4. **Racers:** a racer picker (Spark from the start, Pixel with the Graphics Card, Byte with Memory Lanes, Quark with The Cloud) using `racers/*.webp`, saved per pupil on the server (a small migration), and the 3D racer tinted to match. Volt points at locked ones.
5. **Volt:** swap the SVG in `Volt.tsx` for `volt/volt.webp` (keep the SVG as the fallback).
6. **Race sky:** the full-size world backdrops on big screens, a slow parallax as the racer moves, and a gentle drift on the world map.
7. **Sounds:** engine hum by speed, jump, land, boost on overclock, resistor drag, gel slide, recharge, data gate right / wrong, checkpoint chime, crash, finish fanfare, hard-mode clock ticks in the last 10 seconds; all behind the sound switch. Use the shared sounds where they fit and add new ones the game guide's way.
8. Leave the home card for Stage 6 (`art.test.ts` fails on a card for a switched-off game).

**Tests** (game budget 8, all 8 used): fold into the existing ones rather than adding. Run `npx vitest run scripts/test-budget` before pushing. `npm run circuit:sim` must still pass (no road changes are planned in this stage).

**Check** at phone, iPad and laptop sizes in the preview (`vite.circuit-preview.config.ts`; `?open=all`, `?test=1`, `?maths=off`): the world map, a race in each world, a checkpoint restart (the test road falls off at its second gate when driven straight), hard mode, and the finish screen per world. Then typecheck, test, build (on Windows the full build fails only on Glyph's Art.ts/art.ts clash; let CI do the full build), merge `origin/main` again, open the PR and **merge when green (pre-approved)**. After the merge: check the publish run and that the function still answers 401 unsigned. Update the plan's Status line and a "Stage 5 results" section, project memory, republish James's trial artifact (https://claude.ai/artifact/2BvwLFFFC5fR7h4gTVwW1y: read it first, then publish `dist-preview-circuit/index.html` with that url and the new asset files, removing old ones), and write the copy-ready Stage 6 prompt (Volt's guided first go, voice clips, achievements including Firewall Free from the hard finishes, teacher column, **switch on**) in `docs/prompts/circuit-s6.md`. Reply to James in short plain words with the demo link.
