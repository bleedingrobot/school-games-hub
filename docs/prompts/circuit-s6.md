# Prompt: Circuit Racer Stage 6 (Volt's guided first go, voices, achievements, teacher column, switch on)

Paste everything below the line into a new Claude Code session opened in the Games Hub folder.

---

Build Stage 6 of **Circuit Racer** (game id `circuit`, CSS prefix `.cr-`) for School Games Hub (GitHub bleedingrobot/school-games-hub): **Volt's guided first go, voice clips, achievements, the teacher column, the home card, and switch it on for everyone**. Use your own git worktree from `origin/main`, on a branch named `circuit-s6`; commit and push early.

**Read first**
- Project memory (`C:\Users\Giant\.claude\projects\C--Users-Giant-Games-Hub\memory\MEMORY.md`, then james-preferences.md, circuit-roads-feedback.md, circuit-s4-pr.md, circuit-s5-pr.md, goblinstorm-storm-lands.md (voice-clip and achievement-count gotchas), live-means-published.md, games-hub-setup.md).
- `docs/CIRCUIT-PLAN.md`: the Decisions table (settled by James, don't re-ask), section 5 (5. Achievements, 7. Guide for new players, the Teacher line), and the "Stage 4 results" and "Stage 5 results" sections.
- `docs/game-guide/README.md`, then the parts on achievements, voice, teacher pages, 7-testing.md and 8-going-live.md.
- Star Trader's Bolt guide (the pattern Volt copies) and how other games add voice clips and achievements.
- What you build on: `src/games/circuit/` (`CircuitGame.tsx`, `RaceScreen.tsx`, `Volt.tsx` with the painted Volt, `audio.ts`, `teacher.ts`, `switch.ts`), `shared/circuit/`, `supabase/functions/circuit/`, and the circuit migrations (newest `20261123000400_circuit_racers.sql`).

**James's look rules (don't re-ask):** art first, big paintings, buttons in a slim row on top of the painting, no clutter; flashy, lively animation; keep the neon calm (bloom 0.5 / 0.35 / 0.72, softened on purpose, and #750's dark void under the track). This PC runs ComfyUI: paint anything missing as part of the work, unasked (`scripts/game_art.py circuit paint ...`, see `docs/CIRCUIT-ART-PLAN.md`).

**To do**
1. **Volt's guided first go** (plan 5.7 table): road 1 guided one key at a time (steer, then speed, then jump, the key lit on screen; no gaps until you've jumped once), Volt points at the first short-circuit tiles, "Find a blue port!" when the battery is low, the first-crash tip shown once and then gone, the first data gate explained. Save which tips are seen per pupil (on the server, or the shared "seen" store other games use). "Replay the guide" on the world map. The replay must still match: anything that changes the road for a guided go has to be known to the server's replay too.
2. **Voice clips (Bella)** for Volt's lines, the game guide's way (`WRITE_VOICE_LINES=1` with the voiceLines test, then the Kokoro `scripts/voice-clips.py`); remove clips for lines that change. Behind the sound switch.
3. **Achievements** from the plan table: First Boot, Clean Run, Overclocked, Gold Circuit, World Hopper, Cloud Rider, Core Complete, Golden Board, Firewall Free (from `hard_finishes`, which only counts on a road finished before). All kept at New Season. Wire them into the Achievement Hall and the earn moment (pop in the game and on the hub). Update the counts in `supabase/tests/database/progress_access.test.sql` (2 places).
4. **Teacher:** an "Other games" column "Roads finished", reset progress for a pupil (racer and seen tips too), and the switch and maths switch on Today with the others.
5. **Home card:** move `art/card/circuit.webp` and `circuit-small.webp` to `src/assets/home/` and add the hub card.
6. **Switch on:** code switch on, on for all classes (as Village Raids and Duels were). Keep "Unlimited today" working.

**Tests** (game budget 8, all used): fold into the existing ones rather than adding. Run `npx vitest run scripts/test-budget` before pushing. `npm run circuit:sim` must still pass.

**Check** at phone, iPad and laptop sizes in the preview (`vite.circuit-preview.config.ts`; `?open=all`, `?test=1`, `?maths=off`): a brand-new pupil's first go right through road 1 with Volt, the tips showing once, voices with sound on and silence with it off, an achievement pop, the teacher column, and the home card. Tip for reaching a finish in the preview: import `shared/circuit/bot.ts`, `physics.ts` and `inputs.ts` by their `/@fs/` URLs and patch `Controls.prototype.input` to step a copy of the race with the careful bot's log (the server replay accepts it). Then typecheck, test, build (on Windows the full build fails only on Glyph's Art.ts/art.ts clash; let CI do the full build), merge `origin/main` again, open the PR and **merge when green (pre-approved)**. After the merge: check the publish run, that the live files have the change, and that the function still answers 401 unsigned. Then update the plan's Status line and add a "Stage 6 results" section, update project memory, republish James's trial artifact (https://claude.ai/artifact/2BvwLFFFC5fR7h4gTVwW1y: read it first), and reply to James in short, plain words that Circuit Racer is on for everyone, with the demo link.
