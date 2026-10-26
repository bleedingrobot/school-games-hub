# Prompt: start a new game

Fill in the three lines in square brackets, then paste everything below the line into a new Claude session opened in `~/projects/school-games-hub`.

---

You are starting a new game for James's **School Games Hub** (games for his Year 4–6 class at Douglas Park School). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

**The game:** [name, e.g. "Marble Rush"], short id [e.g. `marble`]
**The idea:** [a few sentences: what pupils do, where the maths comes in, against bots / classmates / on their own]
**Anything James has already decided:** [e.g. "no points or achievements in the first version", "maths is optional"]

## Before anything else
1. Read `docs/GAME_DEVELOPMENT_GUIDE.md` all the way through, then follow it. Where this prompt and the guide disagree, ask James.
2. Set up your own branch and worktree as in the guide's section 6 (branch `[id]`, folder `~/projects/school-games-hub-[id]`). Work only there. Never commit to `main`, never `supabase db reset`, never a bare `git push`.
3. Run `git fetch`, then `node scripts/migration-numbers.mjs` (it checks `main` and every branch). Pick the next free number for your first migration and write it in your plan.
4. Read Marble Rush (on `main`: `docs/MARBLE-PLAN.md`, `shared/marble/`, `supabase/functions/marble/`). It's the closest example of a game built the approved way. If the game has classmates or turns, read 101 or Power Clash too.

## Stage 0: the plan (no code yet)
Write `docs/[ID]-PLAN.md`:
- what the game is, in plain words, and what pupils see first
- the rules as pure functions in `shared/[id]/` (same seed + same inputs = same result), and what the server checks
- where the maths comes in, using **only** the shared maths focus (`makeFocusPack`, marked on the server, recorded with `record_fact_answers` and `countForFocuses`), and how every kind of ladder question will be shown
- the tables, the server function, the switches (code switch + teacher switch), any teacher settings
- how many server requests a class makes per lesson
- every shared file it will touch (the guide's section 3) and when
- stages (small, each tested, each ending with a "results" section), then a go-live stage
- questions for James, with your recommended answer for each

Then **stop** and show James the short version. Don't start Stage 1 until he says so.

## Every stage after that
- Merge `origin/main` into your branch first.
- Build only in your own folders. Shared files get their one-line edits at the end, as the guide says.
- Tests: your own as you go; before saying a stage is done, `npm run typecheck`, `npm run test:all`, `npm run build`, and your database tests on a scratch copy (`scripts/scratch-db.sh`). Say plainly about any failure.
- Write the stage's results in the plan (built, decisions, tests, untested, go-live list), commit, `git push origin [id]`, and stop for James.
- Nothing live (migration, function deploy, merge to `main`, switch on) unless James says so in words in this session, one step at a time.

When you stop, tell James in plain words what's ready, what he can try (a preview link if there is one), and what he needs to decide.
