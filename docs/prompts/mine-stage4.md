# Prompt: Mine Runner, Stage 4 (the server)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-mine` (branch `mine`).

---

You are continuing **Mine Runner**, a Descent-style 3D mine-flying game for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then `docs/MINE-PLAN.md`: the decisions at the top, sections 7 (maths), 8 (saving, boards, fairness, server cost), 9 and 10, and the **Stage 1, Stage 2 and Stage 3 results** (including the "Start view fix" note). Where they disagree, ask James.
2. You are already in the worktree for branch `mine`. Never commit to `main`, never `supabase db reset`, never a bare `git push` (use `git push origin mine`).
3. `git fetch`, then merge `origin/main` into `mine`. Run `node scripts/migration-numbers.mjs` and use the next free number for your migration (the plan said `20261020000400` but re-check; another game may have taken it).
4. Read the code you will build on: `shared/mine/` (`engine.ts` `replay`, `inputs.ts` `encodeInputs` / `decodeInputs` / `grantsIn` and the `GRANT` / `PENALTY` codes, `level.ts` `recipeById` (it understands ids like `l3:hard`), `medals.ts`), and `src/games/mine/` (`MineRun.tsx`, `session.ts`, `trialMaths.ts`, `prefs.ts`).
5. Read **Marble Rush's server** as the pattern to copy: branch `marble`, folder `~/projects/school-games-hub-marble` (`supabase/functions/marble/` handler, entry and tests, its migration, `supabase/tests/database/marble*.test.sql`, `src/data/marble.ts`, its `maths.test.ts`, `TeacherMarble.tsx`, `scripts/marble-sim.mjs`). Copy the pattern; don't invent a new one.

## Stage 4: what to build
James's decisions (all in the plan): name **Mine Runner** (id `mine`); solo play against robots; **school-only best-time boards**; **20 counted runs a day**; key doors need keys, **question doors need a right answer, a wrong answer costs shield and time** (a `PENALTY` input); power-up pads give a refill for a right answer, nothing lost for a wrong one (3 tries a pad); maths comes only from the shared maths focus system and is **never worked out in the browser**.

Build the server side, and wire the screen to it. **Nothing goes live in this stage** (no applying the migration to the real database, no deploying the function, no merge to `main`, no switch on).

1. **Database migration** (`supabase/migrations/<next free>_mine.sql`), all tables `mine_`-prefixed with RLS on:
   - `mine_runs` (player, level id such as `l3` or `l3:hard`, mode, maths on/off, finish steps, inputs text, grants count, wrong answers, created; a **unique index on the seed** so saving twice counts once),
   - `mine_questions` (server-only: RLS on, no policy, no grant; the whole question list for a run),
   - `mine_bests` (one best per player per level per maths flag, with the best run's inputs),
   - a claim function so each question slot is answered once (copy `marble_claim_answer`),
   - `my_mine()` (a pupil's own bests), `mine_board(level, maths)` (top 10 and you, **own school only**, teachers and hidden profiles left out, display names and avatars only, never maths results), modelled on `marble_board()`,
   - the **maths switch**: `app_settings.mine_maths` (off / choose / on, default "choose"), `teacher_set_mine_maths()` using `require_settings_target()`.
   - Every new function revoked from `public, anon` and granted only to who needs it (guide section 5). **Do not** touch `hub_games`, points or achievements here (that is Stage 5), and never re-create the shared functions the guide lists.
2. **Edge function** `supabase/functions/mine/` (`handler.ts`, `entry.ts`, `handler.test.ts`, generated `index.ts`), deployed with `--no-verify-jwt` as the others are, checking the sign-in with `userIdFromToken`:
   - `start`: sign-in check, the daily cap (20 counted runs), a stamped seed (HMAC tied to player + level + mode, 6-hour life), and with maths on the question list built with `space_maths_context`, `makeFocusPack`, `parseFocus`, `seededRandom` and stored whole in `mine_questions`; returns only `publicQuestion(q, slot)`.
   - `answer`: loads the stored question, marks it, claims the slot once, records it with `recordMathsAnswers(rpc, player, answers, '<seed>:<slot>', 'mine')`, replies `{ correct, answer }`.
   - `finish`: **replays** the inputs with `shared/mine/` (`recipeById` + `makeWorld` + `replay`, steady or free as sent), works out the finish time itself, needs the exit reached, refuses a time faster than the real time since the seed was issued (plus slack), accepts only as many `GRANT`s as it marked right and as many `PENALTY`s as it marked wrong, then saves the run and updates the best. A made-up run must not be able to open a door it didn't earn or post an impossible time.
   - Refuse cleanly (a plain message the screen can show) when maths is off for the class.
   - Tests for every refusal and for a pretend pilot (`flyLevel`) whose recorded run is accepted, copying the Marble handler tests.
3. **The screen** (`src/data/mine.ts` plus changes to `MinePlay.tsx` / `MineRun.tsx`): replace the trial-maths stand-in with the real flow (the trial maths stays only in the phone preview). Show each question with **`QuestionModal`** (never draw `parts` yourself), show "7 × 8 = 56" after a wrong answer, send each answer to the server before a door opens or a pad gives its prize, and on finishing send the run. Show the board per level (and per maths on/off, and hard mode as its own board, using the ids already in the code) with the player's own place. **Offline:** if the server can't be reached at `start`, the mine can still be played as Practice and nothing counts; a finished run that couldn't be sent waits in a small queue and is sent later (copy Marble's queue). Show the medal from `medalFor` on the finish screen as now.
4. **Teacher maths panel** `src/pages/TeacherMine.tsx` (copy `TeacherMarble.tsx`): only the maths switch (the game's on/off switch comes in Stage 5). Keep it out of the shared teacher page until Stage 5; just build and test the component.
5. **A test that every maths skill works in the game's question display** (copy Marble's `maths.test.ts`: run every `LADDER` skill through `QuestionModal`).
6. **A simulation script** `scripts/mine-sim.mjs` (copy `marble-sim.mjs`) that plays a pretend class against a **scratch** database and prints the request count, to put a real number on the server cost.
7. **Database tests** `supabase/tests/database/mine.test.sql` (copy the Marble ones), run on a **scratch copy only**: `scripts/scratch-db.sh mine` then `scripts/scratch-test.sh`. Cover: a pupil can't read `mine_questions`, can't see other schools' boards, can't read another pupil's bests, the unique seed, the daily cap, the claim-once rule.

Own folders only: `supabase/functions/mine/`, `supabase/migrations/<next free>_mine.sql`, `supabase/tests/database/mine.test.sql`, `src/data/mine.ts`, `src/pages/TeacherMine.tsx`, `src/games/mine/`, `shared/mine/` (additions only; if you must change a rule, say so to James, update the pinned fingerprint in `determinism.test.ts`, re-run `npm run mine:determinism` and explain), `scripts/mine-sim.mjs`. **Off limits** (stop and tell James if one is needed): `shared/maths/`, `src/maths/`, `src/styles.css`, `src/components/`, `src/auth/`, `supabase/functions/_shared/`, other games, any migration already on `main`, dependencies. The shared-file edits (registry, `scripts/build-functions.mjs`, teacher page, privacy summary) are **Stage 5**, not now. The game stays out of `registry.ts`.

## Quality rules
- Privacy: the board shows display names and avatars only. Never show a pupil's year level, wrong answers or maths results to classmates. Say in the results what is stored and who can see it, so Stage 5 can write the privacy note.
- Words on screen are short, kind and plain. Same visual rules as before (`.mn-` classes, tokens, 44 px targets, focus moved to each new screen's heading, tested at 1366 × 640 and 844 × 390).
- Tests as you go. Before saying the stage is done: `npm run typecheck`, `npm run test:all`, `npm run build`, the database tests on the scratch copy, and the function tests. Say plainly about any failure.
- Measure and report the real server requests for a class lesson from the simulation.
- Update the phone preview so it still works with **no server** (trial maths, fake pupil, never calling the live server), and republish it to the existing private artifact link in `docs/MINE-PLAN.md`.

## When you finish
Append a **"Stage 4 results"** section to `docs/MINE-PLAN.md` (built, decisions, what is stored and who sees it, tests, the simulation's request numbers, untested, go-live list with the migration number and the function deploy command), commit, `git push origin mine`, and **stop for James**. Nothing live (no applying the migration, function deploy, merge to `main`, or switch on) unless James says so in words in this session, one step at a time.
