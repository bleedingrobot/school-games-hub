# Prompt: Circuit Racer Stage 3 (maths: recharge ports and data gates)

Paste everything below the line into a new Claude Code session opened in the Games Hub folder.

---

Build Stage 3 of **Circuit Racer** (game id `circuit`, CSS prefix `.cr-`) for School Games Hub (GitHub bleedingrobot/school-games-hub): **the maths**, live but still **switched off** (code switch stays OFF until Stage 6). Use your own worktree from `origin/main`.

**Read first**
- `docs/CIRCUIT-PLAN.md` in full: the Decisions table (all settled by James, 22 Nov 2026, don't re-ask), sections 3, 5.7 to 5.8 and **7 (maths)**, and "Stage 1 results" and "Stage 2 results".
- `docs/game-guide/README.md`, then **4-maths.md** (way A, rules 1 to 9), 5-server-and-saving.md, 7-testing.md and 8-going-live.md.
- What you build on: `shared/circuit/` (`physics.ts`, `inputs.ts`, `road.ts`, `game.ts` with `judgeFinish`, `memoryServices.ts`), `supabase/functions/circuit/` (`handler.ts` load/start/finish), `src/games/circuit/` (`CircuitGame.tsx`, `RaceScreen.tsx`, `renderer.ts`), migration `20261122001300_circuit.sql`.
- Marble Rush is the pattern for questions in a race with a server replay: `shared/marble/maths.ts`, `shared/marble/questions.ts`, `supabase/functions/marble/handler.ts` (store the run's questions at start, `answer` marks pit stops one at a time, gates read from the replay), and `src/games/marble/questionOrder.ts` / `signs.ts` for signs on the track. Goblin Storm (`shared/goblinstorm/server.ts`) for `makeRunQuestions` / `publicQuestion` / `markQuestion`.

**What James already decided (don't re-ask)**
- Maths = **recharge ports + data gates**, made and marked on the server from the pupil's focus (way A). Maths helps, never decides; a wrong answer always shows the right one.
- **World 1 has recharge ports only** (from road 3); **data gates start in world 2** (Stage 4 builds world 2, so this stage makes gates work and tests them on a test road, not a world-1 road).
- Recharge port: the race **pauses** (the clock stops), `QuestionModal` shows one question. Right = full battery and signal; wrong = half, and the right answer shown with why.
- Data gate: 3 or 4 lanes signed with answers (`choices`/`choiceLabels`); right lane = overclock shortcut, wrong lane = the normal road, no harm, the right answer flashes. 4 seconds of slow motion before the split; the question stays on screen until the split; no red tiles near a gate.
- One question on screen at a time; at least 8 rows between questions (`QUESTION_GAP`). Maths off: ports just refill, gates are plain overclock lanes.

**Stage 3: what to build**
1. **Questions at start:** `start` reads `settings_of` (the maths switch) and `space_maths_context`, makes one question per port and per gate on that road from a fresh seed (`makeRunQuestions`), keeps them in `circuit_questions` (RLS, no pupil access; rows over 2 days go), and sends only `publicQuestion()`s plus which slot each port/gate is. If anything can't be read, the road goes ahead without maths.
2. **Ports:** a pause in the race (the physics doesn't step, so nothing to record: see `inputs.ts`). A new `answer` action marks a port answer against the stored question, claims the slot once, records it with `recordMathsAnswers(..., 'circuit')`, and replies right/wrong and the answer. The refill size (full or half) must be part of the replay: add it to the physics as a per-port value the server supplies from its marked answers (unanswered = half), so `judgeFinish` replays the same battery. Keep the old behaviour (full refill) when maths is off.
3. **Gates:** the `?` cells become lanes with signs (draw the answer text on the road in three.js, every ladder kind: parts, fractions, decimals, percentages, `choiceLabels`). The lane chosen is read from the replay (the lane the racer is in when it crosses the split row), marked at `finish`, claimed once and recorded (a gate answer's time: a fixed slow `GATE_MS`, as Marble). Right lane = an overclock shortcut that only opens if the server marked it right; build it so the replay knows which lane was right for this seed.
4. **Teacher maths switch:** `app_settings.circuit_maths text not null default 'on' check (circuit_maths in ('off','choose','on'))` read with `parseMathsSwitch()`, `teacher_set_circuit_maths(mode, target_class)`, `teacher.maths` in the GameDefinition with an `about` line (copy Marble's `useMarbleMaths` / `saveMarbleMaths`), and `circuit` in `LADDER_GAMES` (`src/pages/SkillMap.tsx`). Keep the on/off switch as it is.
5. **Preview:** the pretend database (`memoryServices.ts`) gets a fixed fake focus and facts (never the live server), and `?maths=off` / `?mc=1`. A test road with a port and a gate behind `?test=1` in the preview only.
6. **Migration:** check the number with `git fetch && node scripts/migration-numbers.mjs`. `circuit_questions`, `circuit_store_questions`, `circuit_load_questions`, `circuit_claim_answer` (service role only), the maths column and setter (granted to authenticated: add it to the allow-list in `security.test.sql`). Extend `supabase/tests/database/circuit.test.sql`.

**Tests** (game budget 8; 6 used: Stage 1's 3, Stage 2's 2 server + 1 screen): at most 2 more. One server test: a port answer is marked once and the replay refills by the marked answer, a wrong gate lane gets no shortcut, maths off asks nothing. One test that runs every skill in `LADDER` through the gate signs and the server marking (copy `shared/archery/server.test.ts`). Run `npx vitest run scripts/test-budget` before pushing and fold tests if needed.

**Check** at phone, iPad and laptop sizes: the question pop-up over the race, the gate signs readable at speed, nothing scrolls sideways. Then typecheck, test, build (on Windows the full build fails only on Glyph's Art.ts/art.ts clash; build the preview with its config and let CI do the full build), open the PR and **merge when green (pre-approved)**. After the merge: check the publish run, the function's 401 from outside, and that the new table refuses pupils. Update the plan's Status line, project memory, and write the copy-ready Stage 4 prompt (worlds 2 to 5: 24 more roads, checkpoints on roads over 60 s, hard mode with Auto-Pilot off, medals set from the simulator, worlds open at 4 of 6) in `docs/prompts/circuit-s4.md`.
