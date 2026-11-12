# 3. Files, branches and the shared parts other games use

Several threads build games at once. These rules stop them clashing or breaking the live site.

## Your branch

- **Cloud project thread (the usual case):** you already have a `claude/…` branch. Use it. GitHub goes through the GitHub MCP tools (`create_pull_request`, `merge_pull_request`); `gh` works only for search. Push with `git push -u origin <branch>`.
- **On James's Mac:** never work in `/Users/jriley/Games Hub`. Make a worktree:
  ```bash
  git -C "/Users/jriley/Games Hub" fetch origin
  git -C "/Users/jriley/Games Hub" worktree add -b <id> ~/games-hub-<id> origin/main
  cd ~/games-hub-<id> && git branch --unset-upstream && npm ci && git push -u origin <id>
  ```
- Never commit to `main`. Never a bare `git push` where the upstream might be `origin/main`.
- Merge `origin/main` into your branch (don't rebase a pushed branch) at the start of each stage and before the PR, then re-check migration numbers.
- Never bare `git stash`: use a WIP commit.

## Yours (create and change freely)

```
shared/<id>/                        rules, config (every tuning number), memoryServices, server, tests
src/games/<id>/                     screens, index.tsx (the GameDefinition), switch.ts, teacher.ts, <id>.css, art/, voiceLines.ts, words.ts
src/data/<id>.ts or src/games/<id>/backend.ts    calls to your server function
src/pages/Teacher<Game>.tsx         your teacher panel (only if you need settings)
supabase/functions/<id>/            handler.ts, entry.ts, handler.test.ts, index.ts (generated)
supabase/migrations/<number>_<id>.sql      new files only
supabase/tests/database/<id>.test.sql
preview/<id>/ + vite.<id>-preview.config.ts
scripts/<id>-sim.mjs
docs/<ID>-PLAN.md, docs/<ID>-ART-PLAN.md, docs/<id>-art/, docs/prompts/<id>-*.md
public/voice/<id>/
```

## Shared: one small edit each, at the end, after merging `main`

- `src/games/registry.ts`: import and **append** to the end of `GAMES` behind your code switch: `...(myGameOn() ? [myGame] : [])`. A Foundational game instead goes where its maths fits in the learning order (comment above `GAMES`), and also in `GAME_IDS` (`src/data/foundational.ts`).
- `src/games/registry.test.ts` lists every game's id and group: the PR that turns your code switch on adds your id.
- Your home card picture: two files dropped into `src/assets/home/`, found by name, no code ([6-art-voice-cards.md](6-art-voice-cards.md)).
- `scripts/build-functions.mjs`: add your name to the end of `FUNCTIONS`. While building, run only `npm run build:functions -- <id>`; the full build churns every function.
- `package.json`: your scripts at the end of `scripts`. No new dependencies without James (check the licence, pin the version).
- `src/App.tsx`: only for a second page; every game already gets `/#/<id>`.
- `shared/README.md`, `docs/PRIVACY-SUMMARY.md`, `docs/PLAN.md` (migration note), `.gitignore` (`dist-preview-<id>/`): your lines at the end of the right section.
- Add to the lists in `UNLIMITED_GAMES` and `teacher_set_unlimited_today()` if turns are limited ([1-design.md](1-design.md) question 3).

## Never change from a game branch

`shared/maths/`, `src/maths/`, `src/styles.css`, `src/maths/maths.css`, `src/components/`, `src/auth/`, `supabase/functions/_shared/`, `shared/kit/`, `src/kit/`, other games' folders and functions, any migration already on `main`, `package-lock.json`, `src/pages/Dashboard.tsx`, `src/pages/Teacher.tsx`, CLAUDE.md. If your game needs one changed, it becomes its own small PR first.
Why: each function's `index.ts` bundles the shared code it imports, so a shared change puts every other function out of date.

## Rules for the shared database

- **Migration numbers:** `YYYYMMDD` + a six-digit counter. Before your first migration and again before the PR: `git fetch`, then `node scripts/migration-numbers.mjs` (checks `main` and every branch). Write the number in your plan. If something took yours, rename yours to a free number after everything on `main`. Never rename a migration already on `main`. A fresh copy (CI, `scratch-db.sh`) refuses two files with one number.
- **Shared functions** (`progress_counts`, `progress_rules`, `rebuild_progress`, `my_progress`, `teacher_students`, `teacher_new_season`, `my_home_page`, `settings_of`): never re-create them. Points, achievements, switches, New Season and "last played" go through `hub_games` hooks ([5-server-and-saving.md](5-server-and-saving.md)). If one truly needs a change, edit it in place with exact text edits that each match once (copy `20261020000100_game_hooks.sql`), as its own PR.
- **Functions a game adds a block to** (`teacher_foundational_class`, `teacher_progress_other_games`): copy the **newest** body (`grep -l "function public.<name>" supabase/migrations/*.sql | tail -1`), add only your block, and check no open PR is changing the same function.
- **`app_settings`:** add columns only (`alter table public.app_settings add column <id>_… not null default …`). Write `teacher_set_<id>(…, target_class uuid default null)` with `require_settings_target()`, as `teacher_set_marble_maths` does. Every save names a class: a null class is refused ("Pick a class first."), and the browser save helper takes `classId: string`.
- **Shared tables** (`fact_answers`, `scored_games`, `achievements`, `maths_focus_results`): write only through their functions (`record_fact_answers` via `recordMathsAnswers`, `add_game_points`). Never alter their columns.
- **Local database:** never `supabase db reset`. Test on a throw-away copy: `scripts/scratch-db.sh <name>`, `scripts/scratch-test.sh <name> <file>`, then drop it.

## The game definition does the wiring

Don't edit the Dashboard or Teacher page. Your `GameDefinition` (`src/games/types.ts`) says:
- `group`: `'foundational'` for every early-years game (ages 5 to 7, James 4 Nov 2026), else `'no-maths' | 'easy-maths' | 'complex-maths'`.
- `teacherSwitch: true` when teachers can switch it off: the card shows only while the class's `<id>_enabled` column is `true` (the home page reads every switch in one request, `src/data/classSwitches.ts`; for another page use `useGameSwitch('<id>')`). No hook to copy. `src/games/<id>/switch.ts` keeps only the code switch (`myGameOn()`).
- `teacher` (`TeacherContract`): `switch` or `maths` (each with an `about` line) or `useSummary`, lazy `Settings` and `StudentPanel`, and optionally `studentSummary`, `hardest(classId)`, `alerts(classId)`, `progressColumns` ([2-steps-and-progress.md](2-steps-and-progress.md)). `SeasonPanels` adds season resets. Copy `src/games/toonflap/teacher.ts` or `src/games/weka/teacher.ts`.
- `colours` (a two-stop gradient that keeps white text readable) and `Icon` (an SVG component).
- A season strip on the home page is not a hook (it lives in `Dashboard.tsx`, `my_moves_left()`, `my_home_page()`): ask James, its own PR.

## The teacher switch

A game with an on/off switch for teachers adds exactly these. Nothing else needs editing by hand: the Games tab count and section buttons, game sets, the school's New class settings and the "Changed by" lines all read them.
- Column `<id>_enabled boolean not null default true` in the migration (new games start on for every class, James 11 Nov 2026; `school_defaults.test.sql` checks the default). Name it `<id with - as _>_enabled` so the change log finds it.
- `hub_games.switch_column = '<id>_enabled'` in the game's `hub_games` row ([5-server-and-saving.md](5-server-and-saving.md)). `teacher_set_games`, `admin_set_school_default` and game sets accept only these columns.
- One line in `GAME_SWITCH_COLUMNS` in `src/data/games.ts` (`Games.test.tsx` fails without it).
- `teacher.switch` in the GameDefinition with an `about` line, and the server check in the edge function (`settings_of`): refuse while it's off.
- Limited turns a day: also `UNLIMITED_GAMES` in `shared/unlimited.ts` and `teacher_set_unlimited_today()` (the Games tab's Unlimited today column follows `UNLIMITED_GAMES`).

## Reuse, don't copy

- `useAuth()` (`src/auth/AuthContext`): `profile.id`, `profile.display_name`, `profile.role`.
- `QuestionModal` (`src/maths/QuestionModal.tsx`) for every focus maths question: typed answers, choices, decimal key, fractions, screen-reader text.
- `readSettings()` (`src/data/classSettings.ts`) for switches; `fetchMyFocus()` (`src/data/focus.ts`) only if the browser needs the focus.
- `AvatarImage` (`src/avatar/`), `useSound()` / `playSound()` (`src/sound.tsx`, `src/games/sounds.ts`), `MuteButton`.
- `speak(text, clipFolder, onEnd)` (`src/speech.ts`): start the answer clock in `onEnd`. `JUNIOR_QUICK_MS` (`shared/juniorQuick.ts`) for ages 5 to 8.
- The game kit: `shared/kit/` and `src/kit/`, catalogue in [src/kit/README.md](../../src/kit/README.md). Copy a game only for what the kit lacks, and keep game words out of that logic.
- Server: `_shared/signIn.ts` (`userIdFromToken`), `_shared/recordAnswers.ts` (`recordMathsAnswers`), `_shared/stamp.ts`, `_shared/limits.ts`, `_shared/http.ts`, and `shared/maths/serverQuestions.ts` (`seededRandom`, `publicQuestion`).

## Looking like the hub

The site look lives in `src/styles.css` (school-red page, soft pink cards, navy buttons, system fonts). Sit inside it:
- Colour tokens for text, panels and edges: `var(--ink)`, `--ink-soft`, `--surface`, `--card`, `--line`, `--brand`, `--focus`, `--won`, `--lost`, `--radius`, `--shadow`, `--display`. Your own colours are fine inside the play area.
- Shared buttons: `button` with `button--primary`, `--play`, `--light`, `--light-outline` or `--danger`.
- Prefix every class of your own (`.tf-`, `.wk-`). Never style a bare element or shared class (`.button`, `h2`, `.panel`).
- Targets at least 44 px, contrast at least 4.5:1, visible `:focus-visible`, focus moved to each new screen's heading, `prefers-reduced-motion` respected.
- Words: short, kind, plain. Never show a pupil's year level ("Year 3 skill") or anyone else's maths results.
