# Building a new game for School Games Hub

*A practical guide for a Claude session building one game on its own, alongside other sessions building other games, and getting it live without clashing or breaking the live site. Written 20 October 2026 from the code on `main` (c33f69b) and the branches `marble`, `bond-match`, `dragon-maths`, `clans` and `maths-focus`. Everything here was checked in the code. Anything marked **PROPOSED** does not exist yet. Tidied 21 October 2026: Marble Rush and the section 10 fixes are now on `main`. Brought up to date 1 November 2026 (main `c040682`): new folder paths, `docs/TESTING.md`, home page card art, painted game art, the teacher contract's newer parts, and what Kingdom Keeper's and Star Trader's go-lives taught.*

---

## 0. Quick start (read this first)

1. **Who you work for.** James, a Year 4–6 teacher at Douglas Park School. Reply to him in plain, simple words: no jargon, file paths or commit hashes unless he asks. He decides every live step.
2. **Your own branch and worktree.** Never work in `/Users/jriley/Games Hub` (the main checkout, moved there from `~/projects/school-games-hub`, which no longer exists; older prompts still name the old path) and never commit to `main`. Set up as in [section 6](#6-branch-and-worktree).
3. **Stay in your folders.** Your game lives in its own folders ([section 2](#2-folder-layout-and-what-you-may-touch)). The shared files have one-line edits only, made at the end ([section 3](#3-where-sessions-clash-and-the-rule-for-each)).
4. **Never touch these from a game branch:** `shared/maths/`, `src/maths/`, `src/styles.css`, other games' folders, other games' server functions, or old migrations. If your game needs one of them changed, stop and tell James. It becomes its own small branch.
5. **Maths questions come from the shared focus system only** ([section 4](#4-maths-questions-the-one-approved-way)). Never work out a student's focus yourself, never write your own times-table or ladder questions, and never trust the browser's marking.
6. **The server is in charge.** Anything that counts (a score, a best time, an answer, a reward) is checked or replayed by your server function before it is saved.
7. **Nothing live without James's words in this session:** applying a migration, deploying a function, merging to `main`, switching the game on. Each one is separate. Approval for one is not approval for the next ([section 8](#8-going-live-one-step-at-a-time)).
8. **Never** `supabase db reset` (other sessions share the local database), and never a bare `git push` from a worktree whose upstream might be `origin/main`. Push your branch by name: `git push origin <branch>`.
9. **Write it down as you go.** Keep a plan in `docs/<GAME>-PLAN.md` with a "Stage X results" section after each stage (what you built, decisions you made, tests, what is untested, the go-live list). The next session starts from it.
10. **Stop after each stage** and tell James what's ready and what he needs to decide.
11. **Settle the design first.** Your plan answers the questions in [section 1a](#1a-design-decisions-to-settle-in-the-plan-before-building): the big goal, seasons, moves a day, progress bars, achievements, card art and a built-in guide for new players.
12. **Keep tests few.** Read [docs/TESTING.md](TESTING.md) before writing any: a new game gets **at most 8 tests** in all ([section 7](#7-running-and-testing-the-game-on-its-own)).

The best example to copy is **Marble Rush** (on `main`). The newest games built from this guide, **Kingdom Keeper** (`docs/KINGDOM-PLAN.md`) and **Star Trader** (`docs/TRADER-PLAN.md`, with its "Went live" section), are good, up-to-date examples of the whole route from plan to live. It is almost entirely in its own folders, gets its maths from the focus system, and has the server make and mark every question. **Clan Quest** and **Dragon Maths** are good for go-live routines, How to play screens and accessibility tests. Dragon Maths' maths and Clan Quest's quest and shop maths are the older year-band kind, so don't copy that part (Clan Quest's Battle Cry is way A, like Marble).

---

## 1. How the existing games were built (what worked)

Each game that went smoothly followed the same shape:

| Piece | Where | Examples |
|---|---|---|
| Rules, as pure functions (same seed + same inputs = same result), shared by the browser and the server | `shared/<game>/` | `shared/lord/`, `shared/clans/`, `shared/marble/` |
| Screens | `src/games/<game>/` with its own CSS file | `src/games/clans/clans.css` (`.cq-` classes) |
| Talking to the server | `src/data/<game>.ts` | `src/data/lord.ts` |
| Server function | `supabase/functions/<name>/` with `handler.ts` (logic, testable), `entry.ts` (database plumbing), `index.ts` (generated, deployed) | `lord`, `clans`, `marble` |
| Database | its own tables, prefixed with the game's name, in one or more new migrations | `lord_heroes`, `clan_fights`, `marble_runs` |
| Teacher settings | new columns on `app_settings` plus `teacher_set_<game>()` functions, and the game's row and Settings on the teacher's Games table, named in the game's definition (`teacher`) | `src/games/marble/teacher.ts`, `TeacherMarble.tsx` |
| On/off switches | a **code switch** (is the card in the build at all?) and a **teacher switch** (is it on for this class?) | `CLAN_QUEST_ON` plus `clans_enabled`; `marbleOn()` |
| A preview anyone can try without signing in | `preview/<game>/` + `vite.<game>-preview.config.ts`, a fake signed-in pupil and a trial backend that runs the same shared rules in the browser | `preview/lord/main.tsx` |
| A simulator for balance | `scripts/<game>-sim.mjs` | `npm run clans:sim` |
| How to play | `src/games/<game>/HowToPlay.tsx`, numbers read from the game's config, so changing a number changes the page | Clan Quest, Maths Monsters |
| Go-live prompt | `docs/prompts/<game>-golive.md`, step by step | `clans-golive.md`, `lord-golive.md` |
| Painted art (optional, often a later stage) | `src/games/<game>/art/`, made by `scripts/<game>-art.py` from James's paintings, with drawn art as the fallback | Star Trader, Dragon Maths, Clan Quest ([section 2](#painted-art)) |
| A painted home page card | `src/assets/home/<id>.webp` + one line in `src/components/gameCardArt.ts` | all 14 games before Star Trader |

---

## 1a. Design decisions to settle in the plan (before building)

Write a short answer to each of these in `docs/<GAME>-PLAN.md` and give James a recommendation for each. They shape the database, the server function and the screens, so they are cheap to decide now and costly to change later. Say "not for this game, because …" where one doesn't fit.

**1. The big goal.** What is the one thing a pupil is working towards over weeks, not minutes? Dragon Maths: beat the dragon. Clan Quest: a full village, then the giant in the last week (`docs/CLANS-SEASON-GOALS-PLAN.md`). Say what "done" looks like, how long it should take a pupil who plays 3 to 4 days a week (check with the simulator), and what there is to do after reaching it. Short-run games (Marble Rush, Bond Match) can have a smaller goal instead: a best time, every course, a gold on each.

**2. Is it a season game?** Suits games where power or progress piles up, so late joiners or absent pupils would fall hopelessly behind without a fresh start. Doesn't suit games that are a fresh start every round (chess, Marble Rush runs); those reset only boards and best times on New Season. If it is a season game:
- **Use the school's season, don't make a new clock.** Seasons are 35 days back to back from one school date set by an admin, with a holiday pause (`docs/DRAGON-SCHOOL-SEASON.md`). Clan Quest shares Dragon Maths' date. Reading it needs a shared function, so ask James how.
- Say what resets each season and what is kept (gear, achievements, the Hall), in your `season_fn` hook and `keep_achievements` (section 5).
- The end of a season: a countdown in the last days, a celebration, and the winners kept for good in a Hall (Dragon Maths' Hall of Heroes, Clan Quest's Hall of Legends).
- A pupil who joins mid-season or misses a week must still be able to get somewhere this season.

**3. A set number of moves or actions a day?** Choose one, with reasons:
- **Yes, a daily allowance** (Dragon Maths' forest and arena fights, Clan Quest's mine fights and 2 builds a day, Maths Monsters' battles) when more play means more power, so a pupil playing at home every night would leave the class behind; when the game is meant to be a little each day across a season; or when it would cost too many server requests (section 5).
- **No limit on play** when it is practice, where more maths is simply good (Gem Keep, Bond Match, Marble Rush). Points already stop at 40 a day across the hub. A game that could be farmed can cap just the rewards (Bond Match: only 10 games a day earn points, `shared/bond-match/save.ts`) or ask for a break (`marble_runs`' `daily_limit`).
- If yes: the server counts and refuses, never the browser. Days roll over at New Zealand midnight (`nzDate` in `shared/lord/engine.ts`). Pick the number with the simulator so the big goal lands near the end of the season. Say kindly when they're used up ("All done for today. See you tomorrow!"), and make sure the maths still gets practised.
- **Show moves left on the home page card.** The card's "Left today" chips come from `my_moves_left()` (`src/data/movesLeft.ts`, `GameCard.tsx`). That is a shared function, not a hook (Maths Monsters added itself with `20261027000300_monsters_moves_left.sql`, an in-place edit), so plan it as its own small step and ask James.

**4. Progress bars.** Pupils should always see how far they've come and what's next:
- **In the game:** a bar or road towards the big goal (Clan Quest's village bar and season road, Dragon Maths' village road: `docs/CLANS-SEASON-TIMELINE-PLAN.md`, `docs/DRAGON-SEASON-TIMELINE-PLAN.md`), and a level bar if the game has levels. Reuse `LevelBar` from `src/components/Progress.tsx` where it fits.
- **On the home page:** the hub's own level bar and next achievements come for free from your points and achievements. Moves left: point 3. A season strip (Clan Quest's and Dragon Maths') is not a hook (section 3), so it needs James's OK and its own branch.
- A bar never shows a pupil's maths results to classmates, and never ranks by maths.

**5. Achievements: record them clearly.** List each one in the plan as a table: name, what it's for (in pupil words), the measure and number that earns it, roughly how many pupils should get it, and whether it survives New Season. Aim for a spread: one most pupils get on day one, a few for steady play, one for the big goal. Then build them through `hub_games` (section 5): `counts_fn`, `achievement_measures`, `achievement_types` with `game = '<id>'`, and a `rules_fn` line for each way to earn points. Show them in the game when earned (a small celebration), and the hub's achievement list picks them up by itself. Season winners also go in the game's Hall, kept for good.

**6. Home page card art.** Plan a card scene for James to paint, in the Marble Rush course-card style (`docs/HOME-ART-PLAN.md`: bright, flat storybook landscape, no text). Give him a one-line scene and a prompt. How to add it: section 2.

**7. A guide for new players, built in.** Every game should be easy for a 9-year-old opening it for the first time, without a teacher explaining it. A How to play page is not enough: pupils read it once and forget. Copy the shape of Star Trader's guide, Bolt the ship's robot (`docs/TRADER-HINTS-PLAN.md` on branch `trader-hints`; First Flight and the next-step line built 1 Nov 2026, not live yet), and Clan Quest's next-step line (`src/games/clans/nextStep.ts`):
- **First, walk through the game as a new pupil** and write a table in the plan: each moment, what the game does, why a child gets stuck, and what fixes it. Look for too much at once, unexplained words, greyed-out buttons with no reason, and a goal that isn't shown.
- **A guided first go** (2 to 3 minutes) where the pupil presses the real buttons in their real game, one lit-up thing at a time, and it ends in a first success to celebrate. It follows what the pupil does (if they skip ahead it catches up, so it can never get stuck), and every step can be skipped. Who gets it comes from the server's saved game (e.g. no turns played yet), so it follows the pupil to any Chromebook. Pick the first success so it can't fail (a pure function tested on many seeds, like Bolt's `starterTrade`).
- **A next-step line** that is always there: one sentence, one action, with real names and numbers ("Fly to Mars at (4, −2) and sell your Water"), worked out fresh from the game by a pure function, with a "Show me" button that lights up the button it means. If a button is greyed out, it says why.
- **First-time tips:** a short, closable bubble the first time something new happens (a new kind of event, shop or danger).
- **Help with real choices:** at a decision, show the numbers and an opinion with the working, so the pupil learns why. Never choose for them.
- **Help fades:** lots on day one, less as they get better, and a "Lots / Some / Off" choice plus "Replay the guide" any time.
- **Rules:** never block, never decide, and **never help with the maths questions themselves** (those stay the pupil's own work). Keep it all inside your game's folder, in your game's own words, with a simple guide character that suits the game. Moves on screen respect reduced motion.
- It is a stage of its own in the plan, before go-live if possible, and James tries the guided first go himself.

**Also worth deciding:**
- **Lesson fit.** One sitting should fit 10 to 15 minutes and save as it goes, so the bell never loses work. Say what a pupil does in their first 5 minutes.
- **Who plays with whom.** Solo, with classmates, or in clans; what happens with an odd number or someone away. Classmates only, never other schools.
- **Maths that nudges, not decides.** Where maths sits in the game and how much it helps, so a pupil weaker at maths can still enjoy it (Dragon Maths' riddles give "a small edge"). Never rank pupils by maths.
- **What the teacher needs.** Settings (keep them few), the class report, `hardest` and `alerts` for the teacher's Today page, and what a teacher can reset (section 3, Teacher page).
- **Rewards and coins.** Where coins come from and go, with the simulator checking nothing piles up unused (Clan Quest's gold after a full village).

---

## 2. Folder layout and what you may touch

**Yours (create and change freely):**

```
shared/<game>/                      rules, config (every tuning number in one file), sim, tests
src/games/<game>/                   screens, index.tsx (the GameDefinition), switch.ts, <game>.css, HowToPlay.tsx
src/data/<game>.ts                  calls to your server function and your database functions
src/pages/Teacher<Game>.tsx         your teacher panel (only if you need settings)
supabase/functions/<name>/          handler.ts, entry.ts, handler.test.ts, index.ts (generated)
supabase/migrations/<number>_<game>.sql      new files only
supabase/tests/database/<game>.test.sql
preview/<game>/ + vite.<game>-preview.config.ts
scripts/<game>-*.mjs
docs/<GAME>-PLAN.md, docs/<GAME>-RULES.md, docs/prompts/<game>-*.md
```

**Shared, a small edit at the end of your work (see section 3 for each):** `src/games/registry.ts` and `src/games/registry.test.ts` (it lists every game's id), `src/components/gameCardArt.ts` (your card picture, if James has painted one), `src/App.tsx` (only if you need extra routes), `scripts/build-functions.mjs` (the `FUNCTIONS` list), `package.json` (`scripts` only), `shared/README.md`, `docs/PRIVACY-SUMMARY.md`, `docs/PLAN.md` (the migration note), `.gitignore` (your preview's `dist-preview-<game>/`).

**Off limits from a game branch:** `shared/maths/`, `src/maths/`, `src/styles.css`, `src/components/`, `src/auth/`, `supabase/functions/_shared/`, other games' folders and functions, any migration already on `main`, `package-lock.json` / dependencies (ask James first; check the licence).

**Reuse, don't copy:**
- `useAuth()` from `src/auth/AuthContext` for the signed-in person (`profile.id`, `profile.display_name`, `profile.role`).
- `QuestionModal` (`src/maths/QuestionModal.tsx`) to show every maths question. It already handles typed answers, choices, the decimal key, fractions and screen-reader text.
- `readSettings()` (`src/data/classSettings.ts`) for your switches. It shares one remembered request with every other game.
- `fetchMyFocus()` (`src/data/focus.ts`), only if your browser needs the focus (section 4).
- `AvatarImage` (`src/avatar/`), `useSound()` / `playSound()` (`src/sound.tsx`, `src/games/sounds.ts`), `MuteButton`.
- `_shared/signIn.ts` (`userIdFromToken`), `_shared/recordAnswers.ts` (`recordMathsAnswers`), `_shared/stamp.ts`, `_shared/limits.ts`, `_shared/http.ts` in your server function, and `shared/maths/serverQuestions.ts` (`seededRandom`, `publicQuestion`).

### Looking like the hub

The site has a Douglas Park look (matching the Classroom Randomiser): school-red page, soft pink cards, navy buttons, system fonts only. It's all in `src/styles.css`. Your game should sit inside it, not restyle it:
- **Use the colour tokens** (`var(--ink)`, `var(--ink-soft)`, `var(--surface)`, `var(--card)`, `var(--line)`, `var(--brand)`, `var(--focus)`, `var(--won)`, `var(--lost)`, `var(--radius)`, `var(--shadow)`, `var(--display)` for headings) instead of new colours for text, panels and edges. Inside the play area itself (a board, a map, a track) your own art and colours are fine.
- **Use the shared buttons:** `button` with `button--primary`, `button--play`, `button--light`, `button--light-outline` or `button--danger`.
- **Prefix every class of your own** with a short game prefix (`.mr-`, like `.gk-`, `.cq-`, `.lord-`). Never style a bare element or a shared class (`.button`, `h2`, `.panel`) from your CSS file, because it would change every page.
- **Dashboard card:** `colours` in your `GameDefinition` is a two-stop gradient that must keep white text readable, and `Icon` is an SVG component (see the other games' `index.tsx`).
- **For Year 4–6 pupils:** buttons and targets at least 44 px, contrast at least 4.5:1, keyboard focus visible (the site's `:focus-visible` outline: don't remove it), move focus to each new screen's heading, respect `prefers-reduced-motion`, and test at 1366 × 640 (classroom Chromebook) and 844 × 390 (phone). Clan Quest's `Accessibility.test.tsx` reads its CSS and checks contrast, target size and reduced motion: copy it.
- **Words:** short, kind, plain. Never show a student's year level ("Year 3 skill") or anyone else's maths results.
- **Home page card picture:** each game's card has a painted scene in the Marble Rush course-card style (`docs/HOME-ART-PLAN.md`). A game without one shows a band of its `colours` and its `Icon`, so nothing breaks while you build. When James has painted yours, put `<id>.webp` (about 1600 px wide) and `<id>-small.webp` (about 800 px) in `src/assets/home/`, and add two imports and one `ART` line to `src/components/gameCardArt.ts` (optional `focus` for where the picture is cropped). Do it at the merge step: it is a shared file.

### Painted art

There is no shared art pipeline; each game copies the last one. The pattern that worked (Clan Quest, Dragon Maths, Kingdom Keeper, Gem Keep, Marble Rush, Star Trader: see `docs/TRADER-ART-PLAN.md`, the most recent):
1. Write `docs/<GAME>-ART-PLAN.md`: every picture needed, its size, and a prompt for each. Stage it so each screen can go live on its own.
2. James paints them on his gaming PC (ComfyUI), usually 2 to 6 tries each. Pictures go to an inbox (a folder outside the repo or an `*-art-inbox` branch), **never straight to `main`**.
3. Record the chosen try for each in a picks file (`docs/<game>-art/picks.json`).
4. Copy `scripts/trader-art.py` (or `clans-art.py`) to `scripts/<game>-art.py`: it resizes the picks to `.webp` in `src/games/<game>/art/` and cuts out sprites (it needs Pillow, numpy and rembg).
5. Add a `CREDITS.md` in the art folder and one `art.test.ts` that checks no picture is missing or spare.
6. **Keep the drawn (code) art as a fallback**, so a picture that hasn't downloaded, or a screen not painted yet, still works.
7. Screenshot each stage at laptop and phone width for James.

---

## 3. Where sessions clash, and the rule for each

| Clash point | What goes wrong | Rule |
|---|---|---|
| **Migration numbers** | Files are named `YYYYMMDD` + a running six-digit counter, and every branch takes "the next one". It went wrong twice: `bond-match` and `dragon-maths` both took numbers `main` already had (renamed on 20 Oct 2026 to `…19001000` and `…19001100`). Live migrations are pasted in by hand, so the live database doesn't care, but a fresh copy (CI's database checks, `supabase start`, `scratch-db.sh`) refuses two files with the same number. | **While building:** `git fetch`, then `node scripts/migration-numbers.mjs`. It prints the next free number across `main` and **every branch**, and any number already used twice. Write the number in your plan. A test (`scripts/migrations.test.ts`) fails if two files on one branch share a number. **At go-live:** check again, and rename your file to a free number after everything on `main` if anything has taken yours or arrived after it. Never rename a migration that is already on `main`. |
| **Shared database functions** (`progress_counts`, `progress_rules`, `rebuild_progress`, `my_progress`, `teacher_students`, `teacher_new_season`, `my_home_page`, `settings_of`) | Older games had to **re-create the whole function** to add points, achievements, a season reset or a teacher-list column. Two branches doing it at once means whichever is applied second silently wipes the other's lines. | **Never re-create them.** Points, achievements, the switch, How points work, New Season and the teacher's "last played" all go through `hub_games` hooks (section 5). If you truly need another change to one of them, edit it **in place** with exact text edits that must each match once (copy `20261019000600_faster_my_progress.sql` or `20261020000100_game_hooks.sql`), never a fresh copy, and ask James first. |
| **`app_settings`** (one row per class plus one default per school) | Fine to add to; dangerous to rebuild. | **Add columns only** (`alter table public.app_settings add column <game>_… not null default …`). Write `teacher_set_<game>(…, target_class uuid default null)` using `require_settings_target()`, as `teacher_set_marble_maths` does. Never re-create shared settings functions. |
| **`scripts/build-functions.mjs`** | `npm run build:functions` rebuilds **every** function. That churns other games' files. | **Build only your function:** `npm run build:functions -- <name>`. Add your name to the end of `FUNCTIONS` at the merge step (it's only the list for building everything). |
| **Shared code inside other functions** | Each function's `index.ts` bundles the `shared/` code it uses. Change anything in `shared/maths/` (or any shared file another function imports) and the other functions' `index.ts` go out of date, their "index.ts is up to date" tests fail, and they would need redeploying. | **Don't change shared code from a game branch.** If you need it, stop and ask James. It becomes its own branch with its own go-live (the `maths-focus` and `gem-keep-marking` branches worked this way). |
| **The games list** (`src/games/registry.ts`) | Everyone adds to the same `GAMES` line. | Add your import and **append** to the end of `GAMES`, behind your code switch: `...(myGameOn() ? [myGame] : [])`. Do this at the end, after merging `main`. **`src/games/registry.test.ts` lists every game's id and group**, so the PR that turns your code switch on must add your id there too (Star Trader's switch-on PR failed its first build on this). |
| **Routes** (`src/App.tsx`) | Every game in `GAMES` already gets `/#/<id>` automatically. | Only add a route if you need a second page (like `card-game/:id`). If your card can be switched off in code but teachers should still reach it, copy the `!CLAN_QUEST_ON && <Route …>` line. |
| **Dashboard** (`src/pages/Dashboard.tsx`) | Used to list game ids by hand. | **Don't edit it.** Your `GameDefinition` says where the card goes (`group: 'no-maths' \| 'easy-maths' \| 'complex-maths'`) and, if a teacher can switch the game on and off, `useTeacherSwitch` (a hook: copy `src/games/clans/switch.ts`, reading through `readSettings`). The card hides while it isn't `true`. The card's picture is one line in `src/components/gameCardArt.ts` (section 2). **Season strips** on the home page (Clan Quest's and Dragon Maths') are not a hook: they are written into `Dashboard.tsx`, `my_moves_left()` and `my_home_page()`. If your game needs one, stop and ask James; it would be its own small branch. |
| **Teacher page** (`src/pages/Teacher.tsx`, `src/teacher/`) | Used to list each game's panels by hand. | **Don't edit it.** Give your `GameDefinition` a `teacher` part (`TeacherContract` in `src/games/types.ts`): its `switch` or `maths` (each with an `about` line) or `useSummary` for the Games table row, lazy `Settings` and `StudentPanel`, and optionally `studentSummary(student)` (one line on the student's page), `hardest(classId)` (the Maths tab and Today's "Hardest right now") and `alerts(classId)` (Today's "Needs you"). `SeasonPanels` on the definition adds season resets to "Seasons and end of year". See `src/games/lord/index.tsx` and docs/TEACHER-VIEW-PLAN.md, stage 3, "How a game moves". Your files are yours. |
| **`package.json`** | Every game adds `<game>:sim` / `<game>:preview` scripts on neighbouring lines, so merges conflict. Dependencies change `package-lock.json`, which is painful to merge. | Add your scripts at the **end** of `scripts`. No new dependencies without James (check the licence, pin the version). Never run `npm install <x>` on a game branch without asking. |
| **`src/styles.css`, `src/maths/maths.css`** | Every page uses them. | Never edit from a game branch. Your own CSS file with a prefix (section 2). |
| **Shared tables** (`fact_answers` records, `scored_games`, `achievements`, `maths_focus_results`) | Other games and the teacher pages read them. | Only write to them **through the database functions made for it** (`record_fact_answers`, `add_maths_focus_results`, the points trigger pattern). Never alter their columns. |
| **The local database** (one Docker copy shared by every session) | One session's `db reset` or half-applied migration breaks the others. | Test migrations on a throw-away copy: `scripts/scratch-db.sh <yourname>` then `scripts/scratch-test.sh <yourname>`, and drop it after. Or use `begin; … rollback;` (see the Clan Quest go-live prompt). Never `supabase db reset`. |
| **`docs/PLAN.md`, `shared/README.md`, `docs/PRIVACY-SUMMARY.md`, CLAUDE.md** | Everyone appends. | Add your lines in the merge step only, at the end of the relevant section. CLAUDE.md: don't edit from a game branch. |

---

## 4. Maths questions: the one approved way

Maths is the most important shared system. A student has **one maths focus** at a time, decided by the server: a teacher focus for the student, then for their group, then for their class, then the student's own choice (if the class allows it), then **auto** (the ladder of 31 skills from bonds to 10 up to fractions, decimals and percentages). Plan: `docs/MATHS-FOCUS-PLAN.md`. Code: `shared/maths/`.

**Which games do it this way today:** Gem Keep (questions made in the browser, marked again on the server), Wormholes & Black Holes / Mission Control (both ways), the placement warm-up, and Marble Rush, Mine Runner, Archery Challenge, Kingdom Keeper and Star Trader (questions made and marked on the server, recorded with `recordMathsAnswers`). **Maths Monsters and Dragon Maths don't make their questions this way**, and nor do Clan Quest's quests and shop. They ask their own year-band questions (`shared/maths/banded.ts`, `practical.ts`), which don't follow the focus and don't move a student up the ladder. (Exception: Dragon Maths' bank interest question uses way A since 29 Oct 2026; see `bank` in `shared/lord/server.ts`.) Don't copy their maths. **Decided by James (20 Oct 2026): Monsters' and Dragon Maths' answers should count towards the ladder place and the focus results.** Monsters and Dragon Maths already save times tables, adding and division in the same records and keys the ladder reads; what they lacked is the two steps after saving. Monsters has had them since 1 Nov 2026 (#107: `syncPlace` once after new answers, `countForFocuses` for each batch the records took for the first time, in `monster/handler.ts`). **Dragon Maths still needs the same** (in `lord/entry.ts` and its handler; not done as of 1 Nov 2026). **Clan Quest's Battle Cry now uses way A and counts (James, 20 Oct 2026, replacing his earlier "stays out"; branch `clans-ladder`).** The server makes a ladder fight's 8 questions from `space_maths_context` when the fight starts (`makeRunQuestions`, now in `shared/maths/serverQuestions.ts` and shared with Marble), keeps them with the open fight (`clan_fights.questions` and `marks`), sends only `publicQuestion`s, marks each answer with a `cryCheck` action (one try per question) and records it with `recordMathsAnswers`. A browser asks for this with `fightStart { ladder: true }`, so an older page still open gets an old-style fight. Quest puzzles and the shop keep their practical questions and their own `clan-quest` records. **Basic facts training** keeps its own separate records (`training_answers`) on purpose. Don't copy that for a game either.

### 4.1 The rules

1. **Read the focus, never work it out.** On the server: `space_maths_context(player)` (server key only) returns `{ facts, settings, focus }`. In the browser: `fetchMyFocus()` (`my_maths_focus()`), or include `maths_focus_of(auth.uid())` in your own load function, as `my_gem_keep()` does. Always pass it through `parseFocus()`. Anything odd becomes auto. Keep the focus you have for the rest of a level or run, even if a new one could be read. A focus that ended mid-game takes effect next time (`currentFocus()` does the time check).
2. **Get questions from the pack.** `makeFocusPack(facts, focus, { enabledTables, division }, random)` from `shared/maths/focus.ts` gives a `SkillPack`, and `pack.nextQuestion(ctx)` gives one `Question`. This one function covers every case: auto off (the times-table campaign), auto on (the ladder from the student's place), a teacher or student focus. Pass a **seeded** `random` (`seededRandom(seed)` from `shared/maths/serverQuestions.ts`) so the server can make the same questions again.
3. **Asking for different kinds** goes in the `QuestionContext` you hand `nextQuestion`:
   - `multipleChoice: true` gives four choices to tap (follow the class switch: `settings.multipleChoice`).
   - `onlyFocus: true` asks only the focus skills, with no review or stretch (Gem Keep's Level Key).
   - `boxes: [0, 1]` gives only facts in those mastery boxes (easier: weakest first); `boxes: [3, 4]` gives confidence builders.
   - `missingFactor`, `division` follow the class's settings for times tables.
   - Easier or harder *within* the focus is the pack's job (60% focus, 30% review, 10% stretch). Don't pick skills yourself.
4. **Show every kind of question the ladder can make**, so a skill added later just works. Show it with `QuestionModal` (or pass a `ShownQuestion` to it), and never draw `parts` yourself. If you must build your own display (Marble's answer gates), handle **all** of these:
   - `parts`: text left to right with `'?'` as the blank; a part like `'3/4'` or `'?/8'` is a fraction; parts can be words (`'Round'`). Plus an optional `prompt` line above.
   - `choices` (numbers) with optional `choiceLabels` (`'2/3'`, `'0.25'`, `'25%'`). **When `choiceLabels` is set, the question can only be answered by picking**, whatever the multiple-choice switch says. There can be 2 or 4 choices.
   - `input: 'decimal'` means show a point key; `maxLength` is the longest answer (default 3).
   - `spoken`: what a screen reader says. Use it as the question's accessible name.
   A test should run every skill in `LADDER` through your display (Marble's `maths.test.ts` and F.6's browser check did this).
5. **The server marks, never the browser.** Two safe ways (section 4.2). Either way the right answer comes from a question the server made or rebuilt, never from what the browser says.
6. **Record every marked answer** so it counts towards the student's records, their place on the ladder, the teacher's skill map and the focus results:
   - **Use `recordMathsAnswers(rpc, player, answers, once, '<name>')`** from `_shared/recordAnswers.ts`. `once` is something unique to this save (the run's seed and the question's slot), so a save sent twice counts once. It does everything below, and never throws.
   - What it does, so you don't write it again: splits the answers by pack (`groupByPack`); calls `record_fact_answers` once per pack with that pack's quick time (`quickMsForPack`, **not** `QUICK_MS`: the `generated` pack's is 8 s), `FLUENT_DAYS` and `TOP_BOX`; and, for a batch the records took for the first time, adds them to the teacher's focus results (`countForFocuses`).
   - `answers` are `FactAnswer`s: `{ key, correct, ms, at }`, where `key` is the question's `factKey`. `recordMathsAnswers` keeps each time to at most two minutes (`keptMs`).
7. **No warm-up yet? Do nothing special.** A student who hasn't done the placement warm-up starts at the first skill and climbs from their own answers (changed 20 Oct 2026). The home page's path card already offers the warm-up. Your game doesn't need to ask or block.
8. **A maths switch for your game, if it has optional maths:** a column `<game>_maths text default 'choose' check (… in ('off','choose','on'))` and `parseMathsSwitch()` from `shared/space/mathsSwitch.ts` (Marble copies Mission Control here). If maths is the whole game, you don't need one.
9. **Teacher settings page:** only if your game needs settings of its own. Make `src/pages/Teacher<Game>.tsx` (copy `TeacherMarble.tsx`), name it as `teacher.Settings` in your definition (it is given the class as `classId`), build it from the shared controls in `src/teacher/Settings.tsx`, and save through `teacher_set_<game>()`. The focus itself is set on the shared **Set focus** page. Never add focus controls of your own.

### 4.2 Two ways to mark

**A. The server makes the questions (recommended; Marble Rush).** It's best for anything with a score, a time or a reward.
1. The browser asks your function to start (`{ type: 'start' }`).
2. The function reads `space_maths_context(player)`, makes the pack from a fresh seed, makes N questions, and **stores the whole questions** in a table pupils can't read (`<game>_questions`: RLS on, no policy, no grant; compare `marble_questions`).
3. It sends the browser only what to show: `publicQuestion()` (`shared/maths/serverQuestions.ts`) strips `answer`, `factKey` and `params`.
4. The browser shows each one with `QuestionModal` and sends `{ seed, slot, value, ms }`.
5. The function loads the stored question, marks `value === question.answer`, claims the slot **once** (`<game>_claim_answer` returns false if it was already answered), and records it (rule 6).

**B. The browser makes the questions (Gem Keep).** Use this only when the game must keep going offline.
1. The browser builds the pack itself from `my_<game>()` (facts + settings + focus) and wraps it in `showingPack()` (`shared/maths/claim.ts`), so every answer carries `key`, `params` (the numbers the question was made from), `parts` (what was shown) and the value given.
2. Your function marks each one with `solveClaim()`, which rebuilds the question from its key and numbers and checks the parts match exactly. Anything that doesn't hold up is refused and not recorded.

### 4.3 Worked example: a new game asks 5 questions from the focus and saves the answers

Server side (`supabase/functions/<name>/entry.ts`, way A, trimmed). Copy the real error handling and limits from Marble.

```ts
import { makeFocusPack, parseFocus } from '../../../shared/maths/focus';
import { publicQuestion, seededRandom } from '../../../shared/maths/serverQuestions';
import { recordMathsAnswers } from '../_shared/recordAnswers';
import { userIdFromToken } from '../_shared/signIn';

// start: make and keep 5 questions, send only what to show
const ctxRow = (await admin.rpc('space_maths_context', { player })).data;
const focus = parseFocus(ctxRow.focus);
const { enabledTables, division, multipleChoice } = ctxRow.settings;
const pack = makeFocusPack(ctxRow.facts, focus, { enabledTables, division }, seededRandom(seed));
const questions = [];
for (let i = 0; i < 5; i++) {
  const q = pack.nextQuestion({ multipleChoice, enabledTables, division });
  if (q) questions.push(q);
}
await admin.rpc('<game>_store_questions', { player, seed, questions });   // a table pupils can't read
return { seed, questions: questions.map((q, slot) => publicQuestion(q, slot)) };

// answer: mark it here, once, and record it
const stored = (await admin.rpc('<game>_load_questions', { player, seed })).data;
const q = stored.questions[slot];
const correct = value === q.answer;
if (!(await admin.rpc('<game>_claim_answer', { player, seed, slot, value, right_answer: correct })).data) return { already: true };
const answers = [{ key: q.factKey, correct, ms: Math.min(ms, 120_000), at: Date.now() }];
await recordMathsAnswers((n, a) => admin.rpc(n, a), player, answers, `${seed}:${slot}`, '<name>');
return { correct, answer: q.answer };   // the browser shows "7 × 8 = 56" after a wrong answer
```

Browser side (trimmed):

```tsx
const { seed, questions } = await startRound();          // src/data/<game>.ts → your function
<QuestionModal
  question={questions[i]}                                  // no answer in it: the server keeps it
  title="Bridge gate"
  onSubmit={async (value, ms) => {
    const r = await sendAnswer(seed, questions[i].slot, value, ms);
    return { correct: r.correct, fact: …, boxBefore: 0, boxAfter: 0, answer: r.answer };
  }}
  onDone={() => setI(i + 1)}
/>
```

Tests to copy: Marble's `handler.test.ts` (right, wrong, sent twice, a slot that doesn't exist, another student's seed) and `maths.test.ts` (every ladder skill comes through and shows).

---

## 5. The signed-in pupil, saving, scores and progress

- **Who is playing.** Browser: `useAuth().profile` (the `RequireAuth` route already makes sure someone is signed in). Server: send the session token (`supabase.auth.getSession()` → `Authorization: Bearer <token>`, plus `apikey: SUPABASE_PUBLISHABLE_KEY`, as in `src/data/lord.ts`). The function reads it with `userIdFromToken(admin.auth)` from `_shared/signIn.ts` and is deployed with `--no-verify-jwt` (server-load S.5).
- **The school check.** Every database function that shows or changes another person's data uses `my_school()` (or `my_students()` / `require_teacher_of()` for teachers) so schools never see each other (`20261018002500` migration). Boards are own-school only, with teachers and hidden profiles left out (`marble_board()`).
- **Saving.** Your own tables, prefixed with your game. RLS on. Pupils read their own rows through a `my_<game>()` function, not the table. Saving is done by your server function with the server key, through a `record_<game>_…()` function that the server key alone may run. At the end of each migration, revoke every new function from `public, anon` and grant only what's needed (see the "lock new functions" block at the end of `20261018002500`). A save that's sent twice must count once (a seed or request id with a unique index).
- **Daily limits and cost.** The project is on Supabase's free size, and a whole class at once is the danger (`docs/SERVER-LOAD-PLAN.md`). Ask the server as few times as possible: one request per level, run or turn, not per tap. Add a daily cap if a game could be farmed (`marble_runs` asks for a break after `daily_limit`). Estimate requests per class per week in your plan (101's plan did: about 30,000 a month against 500,000).
- **Points and achievements (through `hub_games`, from migration `20261020000100`).** A new game never adds a column to `scored_games` or re-creates a shared function. In its own migration it:
  1. registers itself: `insert into public.hub_games (id, switch_column, counts_fn, rules_fn, players_fn, season_fn, last_played_fn, keep_achievements) values (...)`. Every hook is optional, and a trigger refuses a hook with the wrong shape:
     - `switch_column`: its `app_settings` true/false column. While it's off, its achievements and points rules are hidden.
     - `counts_fn(who uuid) returns jsonb`: `{ "<measure>": n }` for its achievements.
     - `rules_fn() returns jsonb`: `{ "lines": ["Finish a course: 3 points.", …] }`, shown on How points work under the game's name.
     - `players_fn() returns setof uuid`: players whose achievements come from progress outside points (a rebuild re-awards them).
     - `season_fn(players uuid[]) returns void`: what else a New Season clears. Its points always go.
     - `last_played_fn(player uuid) returns timestamptz`: for the teacher's list.
     - `keep_achievements`: achievements stay through a New Season.
  2. adds its measures (`insert into public.achievement_measures`) and achievements (`insert into public.achievement_types`, `game = '<id>'`).
  3. gives points from its server function with `add_game_points(player, '<id>', points, once)` (server key only; `once` unique per save, so a retry earns once; at most 100 at a time). They're scored as a solo game inside the shared 40-points-a-day cap, and achievements are checked straight away. When its counts change without points, it calls `game_progress_changed(player, '<id>')`.
  The test `supabase/tests/database/game_hooks.test.sql` shows a whole pretend game doing all of this: copy it for yours. Points are never ranked against maths. Older games keep their own lines in the shared functions; don't copy those.
- **New season.** Your game's points are cleared by New Season automatically. Anything else per-season (boards, best times) goes in your `season_fn` hook. Never edit `teacher_new_season()` itself.
- **Privacy.** Add what you store and who can see it to `docs/PRIVACY-SUMMARY.md`. Never show a pupil's maths results to classmates. Store display names only (real names stay with teachers).

---

## 6. Branch and worktree

```bash
git -C "/Users/jriley/Games Hub" fetch origin
git -C "/Users/jriley/Games Hub" worktree add -b <game> ~/games-hub-<game> origin/main
cd ~/games-hub-<game>
git branch --unset-upstream          # so a bare `git push` can never go to main
npm ci
git push -u origin <game>            # first push sets the upstream to origin/<game>
```

- Worktrees live beside the main checkout as `~/games-hub-<name>` (`git worktree list` shows the current ones). If the Claude app made a worktree for your session (a `claude/…` branch), that is fine to use instead: the same rules apply.
- Commit after each stage with a clear message. Push with `git push origin <game>`.
- **Merge `origin/main` into your branch** (don't rebase a pushed branch) at the start of each stage and before go-live. Then re-check migration numbers and the shared functions (section 3).
- Other sessions may share the stash: never bare `git stash` / `git stash pop`. Use a WIP commit.

---

## 7. Running and testing the game on its own

- **How many tests:** follow [docs/TESTING.md](TESTING.md). A new game gets **at most 8** across its rules, screens and server function (Kingdom Keeper: 3 rule, 3 server, 2 screen), aimed first at the server protecting pupils (wrong is wrong, sent twice counts once, another pupil's seed refused), then maths a pupil sees, then the main rule. No tests of wording, colours or tuning numbers, and no slow tests: play-to-the-end runs go in `scripts/<game>-sim.mjs`. The database test file and the "index.ts is up to date" check are separate (below).
- **Your tests:** `npx vitest run shared/<game> src/games/<game> src/data/<game>.test.ts supabase/functions/<name>` while you work. Before saying a stage is done: `npm run check` (typecheck, `test:all` and build in one; `test:all` takes a few minutes; a few busy-computer timeouts pass when run alone with `--testTimeout=30000`: say so, don't hide it).
- **Tests that depend on the date or time** (a "Today" label, weekends, midnight) must pin the clock. Two failed CI runs this way in late October (#105, #117).
- **Database:** write `supabase/tests/database/<game>.test.sql` (pgTAP). Check: pupils can't read the server-only tables (42501), can't call the server-only functions, see only their school, and a save sent twice counts once. Run it on a throw-away copy: `scripts/scratch-db.sh <game>` then `scripts/scratch-test.sh <game> supabase/tests/database/<game>.test.sql`, then drop the copy. CI's "Database checks" runs every file on a fresh copy on every PR and when `main` is pushed, so a duplicate migration number fails there.
- **Server function:** keep logic in `handler.ts` with the database passed in, so `handler.test.ts` runs without Deno or a database (every function does this). Rebuild only your `index.ts` (section 3) and keep the "index.ts is up to date" test.
- **In the real site, locally:** `npm run dev` with your code switch on only on your computer: `const ON = false; export const myGameOn = () => ON || import.meta.env.VITE_<GAME>_ON === 'true'` (copy `src/training/switch.ts`), and put `VITE_<GAME>_ON=true` in `.env.local`. It talks to the **live** project unless pointed at the local one, so don't save test data there without James's OK.
- **Preview for James (no sign-in):** `preview/<game>/main.tsx` with a fake signed-in pupil and a trial backend that runs your `shared/` rules in the browser (copy `preview/lord/main.tsx` and `src/games/lord/trialBackend.ts`), built with `npx vite build --config vite.<game>-preview.config.ts`. A preview must never call the live server (Marble's first preview did, by accident, for the maths focus). Give it a fixed fake focus and facts. James tries it on his phone; publishing it as a private Artifact has worked well.
- **Simulator:** for games with balance numbers, `scripts/<game>-sim.mjs` plays thousands of games using the shared rules.

---

## 8. Going live, one step at a time

Write `docs/prompts/<game>-golive.md` (copy `clans-golive.md`). James has pre-approved merging and going live. Still ask him on a card before anything destructive (dropping, deleting, removing pupils' data), and say exactly what will happen.

0. **Pre-flight (nothing live).** Merge `origin/main`. Re-check migration numbers (renumber yours if needed) and any shared database functions you re-create (section 3). Run typecheck, `test:all`, build, and your database tests on a scratch copy built from `main`'s migrations plus yours. Check the live database has what you depend on by querying for it (`select to_regclass('public.<table>')`), not by trusting docs. The live history (`supabase_migrations.schema_migrations`) is complete from 28 Oct 2026.
1. **Migrations and functions go live by themselves when your PR merges** (since 28 Oct 2026). "Test and publish" runs every check, then `scripts/apply-live-migrations.sh` applies every migration not yet in the live history (`supabase_migrations.schema_migrations`), then deploys each function whose `supabase/functions/<name>/index.ts` changed, then publishes the site. So: rebuild only your function (`npm run build:functions -- <name>`) and commit its `index.ts`. Nobody pastes SQL or runs deploy commands any more.
   - **Not ready to go live?** Put the migration's number in `supabase/migrations-on-hold.txt`; take it out in the PR that goes live.
   - **Destructive migration** (a line *starting* with `drop table`, `drop schema`, `truncate`, `delete from` or `alter table … drop column`): the job refuses it unless the file has the line `-- live-ok: destructive`. Add that only after James's yes on a card.
   - **Never apply a migration by hand** (SQL Editor, connector) without also adding its history row, or the job will apply it a second time: `insert into supabase_migrations.schema_migrations (version, name) values ('<number>', '<name>');`
   - To redeploy a function that didn't change: Actions → Test and publish → Run workflow, with its name (or `all`).
   - Database checks and site checks also run on every PR: don't merge a red PR.
2. **After the merge, check** the Test and publish run went green, your tables exist and are empty, switches start **off**, and an unsigned `curl -X POST …/functions/v1/<name>` answers a 401 message, not a crash or 404.
3. **Check from outside.** Signed out and as a pupil: server-only tables and functions refused (42501), pupils see only their own and their school's rows, older data untouched (e.g. `select count(*) from public.scored_games;` not smaller).
4. **Merge to `main`** (this is the step that goes live: see 1). Merge `origin/main` into your branch one last time, then either open a pull request for James (he has merged from his phone) or push `<game>:main` if he says so. Never push from the main checkout. "Test and publish" runs every test and publishes only if they pass. Watch it go green. (In the app's auto mode the safety check blocks `gh pr merge`. James either switches the session to Ask mode or allows `Bash(gh pr merge:*)` in `.claude/settings.local.json`; you can't add that rule yourself.)
5. **Try it live as a teacher** while the pupils' switch is off (teachers can open `/#/<id>`).
6. **Switch it on** for pupils (the code switch, then the teacher switch on the Teacher page). Only with James's OK. The code switch is its own small PR (`ON = true` in `src/games/<game>/switch.ts`, plus your id in `registry.test.ts`). For the teacher switch, James has sometimes asked for it to be set in every `app_settings` row at once with the Supabase connector (Star Trader, 1 Nov 2026); set only the columns `teacher_set_<game>()` would set.
7. **Write it down:** a "went live" note in your plan (what was applied, deployed and checked, when), and update the memory note. Then stop for James's feedback.

**Turning it off again (rollback), from gentlest to strongest:**
- **The teacher switch** on the Teacher page. Pupils see "not switched on", the data is kept, and the server refuses requests (make sure your function checks the switch itself).
- **The code switch** set to `false` and published: the card disappears.
- **Delete the function** in the Supabase dashboard: everything that needs the server stops.
- **Database:** don't drop tables. Write a new migration if something must change. (Note: the SQL in `clans-golive.md`'s rollback, `update … where id;`, no longer works now that `app_settings` has one row per class. Use the Teacher page.)

---

## 9. Ready to go live? (risk-based checklist)

**Must be true (stop if not):**
- [ ] Nothing that counts is decided by the browser: the server replays or marks it, and a save sent twice counts once.
- [ ] Maths comes only from `makeFocusPack` with the server's focus. It's marked on the server and recorded with `record_fact_answers` (per pack, `quickMsForPack`) and `countForFocuses`.
- [ ] Every new table has RLS on. Server-only tables have no policy and no grant. Every new function is locked to the right role. Pupils only ever see their own school.
- [ ] Your migration number is free across `main` and every branch, and comes after everything it builds on. Any shared function you re-create starts from `main`'s newest version.
- [ ] Merged with the latest `origin/main`; typecheck, `test:all`, build and your database tests pass (or every failure is explained to James).
- [ ] The game's switches start **off**, and the server refuses requests while it's off.
- [ ] No other game's function or `index.ts` changed (or James knows which and why).

**Should be true:**
- [ ] Every kind of ladder question shows and can be answered (typed, choices, decimal key, fractions), with readable spoken text.
- [ ] 44 px targets, 4.5:1 contrast, focus moved on each new screen, reduced motion respected; checked at 1366 × 640 and 844 × 390.
- [ ] Requests per class per lesson estimated and acceptable; daily cap if it could be farmed.
- [ ] How to play reads its numbers from the config.
- [ ] The plan answers section 1a (big goal, seasons, moves a day, progress bars, achievements table, card art, new-player guide), and what was built matches it.
- [ ] A new pupil can get through their first go with no adult help: the guided first go works, can be skipped and replayed, and the next-step line always has something useful to say.
- [ ] No more than 8 tests of your own (`docs/TESTING.md`), plus the database test file.
- [ ] Your id is in `src/games/registry.test.ts` in the PR that turns the code switch on; a card picture in `gameCardArt.ts` if James has painted one.
- [ ] `docs/PRIVACY-SUMMARY.md`, `shared/README.md` and your plan are updated.
- [ ] James has tried the preview, and ideally some pupils have too.

---

## 10. Fixes for parallel development (20 October 2026)

All were asked for by James on 20 Oct 2026. Where each one is:

1. **Duplicate migration numbers: renamed.** `bond-match`'s migration is now `20261019001000_bond_match.sql` (it is already applied live under its old name; renaming changes nothing live, so don't apply it again). `dragon-maths`' topics migration is now `20261019001100_lord_topics.sql`. Both are committed on their branches.
2. **Duplicate-number test and the next-number script: done**, on `main` (`scripts/migrations.test.ts`, `scripts/migration-numbers.mjs`).
3. **`build:functions` takes names: done**, on `main` (`npm run build:functions -- lord clans`). `monster/index.ts` was rebuilt and its test turned back on by `monsters-marking` (31 Oct 2026).
4. **Shared maths helpers: done**, on `main`: `_shared/recordAnswers.ts` (`recordMathsAnswers`) and `shared/maths/serverQuestions.ts` (`seededRandom`, which gives exactly Marble's numbers, and `publicQuestion`). Marble Rush, Mine Runner, Archery, Kingdom Keeper, Star Trader and Clan Quest's Battle Cry use `recordMathsAnswers`; `lord` uses `quickMsForPack`. `clans` (its own `clan-quest` records) and `monster` still use the 5-second `QUICK_MS` for every pack. Moving them over changes how quick answers count in live games, so it waits for James.
5. **Games describe themselves: done**, on `main`. `GameDefinition` has `group`, `useTeacherSwitch`, `TeacherPanels` and `StudentPanel`, and the dashboard and Teacher page read them. (`TeacherPanels` and `StudentPanel` were replaced by `teacher` on 28 Oct 2026: docs/TEACHER-VIEW-PLAN.md, stage 3.) Nothing a pupil or teacher sees changes. A new game now touches only `registry.ts` of the shared screens.
6. **Points and achievements without re-creating shared functions: done**, on `main`. Migration `20261020000100_game_hooks.sql` adds `hub_games`, `achievement_measures` and `game_points`, and edits the six shared progress functions **in place** to call the hooks. Existing games are untouched. Tested on throw-away copies with and without Bond Match's live tables: every database test file passes (apart from the three that never pass on a copy), plus the new `game_hooks.test.sql` (38 checks). **Applied live on 20 Oct 2026** (James's yes; one transaction; afterwards 10 games and 45 measures listed, the 404 scores and 259 achievements unchanged, Bond Match's and Marble Rush's New Season lines kept, pupils unable to give points). New games may now add points this way. Undo steps: `docs/prompts/game-hooks-golive.md`.

**Marble Rush** (live since 20 Oct 2026): its function now checks sign-in with `_shared/signIn.ts` and saves answers with `recordMathsAnswers` (its own batch ids kept), so it has each pack's quick time and counts for focus results. Deployed 20 Oct 2026. Its definition has `group` and `teacher`. Still to do some time: take `seededRandom` / `publicQuestion` from `shared/maths/serverQuestions.ts` instead of its own copies (same numbers).
