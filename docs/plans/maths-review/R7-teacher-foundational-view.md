# R7. Teacher view for Foundational skills (class grid, stuck flags, Today alerts)

Status: plan only, nothing built. Written 7 Nov 2026. Covers all seven Foundational activities: Kiwi's Beanstalk, Hop, Penguin Pairs (`korora`), Pipi, Tūī, Weka and Quick looks.

## 1. The problem

Pattern 4 in DECISIONS.md: "Teachers can't see who is stuck (all 7)."

What a teacher sees today:
- **Games tab:** one line per game ("Skip counting · N playing · N Golden Glow Jars") and a drawer with switches (`src/teacher/Games.tsx`, each game's `teacher.useSummary`/`Settings`). Beanstalk's Maths column always says "Bonds to 10 · N playing", although pupils are on the 10, 100 and 1000 beanstalks (`src/games/beanstalk/teacher.ts:17-24`, `useBeanstalkSummary`).
- **A student's page:** one line per game ("12 of 30 days done"), and for Penguin Pairs, Tūī and Weka the 3 hardest facts.
- **Today:** nothing from any Foundational game. `useClassAlerts` (`src/teacher/useClassAlerts.ts`) only merges `teacher.alerts` of games that define it (saves or requests turned down this week) plus "skipped 30% or more of their questions"; none of the seven define an alert. "Hardest right now" (`src/teacher/Hardest.tsx`) only merges games that define `teacher.hardest`; none of the seven do.
- **Quick looks:** nothing at all. It is a Training activity, not a game definition, and `teacher_training_student` (`supabase/migrations/20261018002600_clans_schools_and_classes.sql:875`) exists but nothing calls it (quick-looks.md, candidate 1).
- **What already exists and can be reused:** the Maths tab's skill map (`/teacher/:classId/maths/skills`, `src/pages/SkillMap.tsx`), a pupil × stage grid with Not started / Learning / Secure / Fluent (`LEVELS` in `shared/maths/skillMap.ts:46-70`), whose "Early number facts" stage already holds the foundational skills as ladder skills (`shared/maths/ladder.ts:91-102`: parts-5, parts-10, facts-10, dbl-half-10, ten-and, facts-20, dbl-half-20, skip-10/5/2, odd-even). Its data comes from one class function, `teacher_class_skill_map` (`supabase/migrations/20261019000400_maths_teacher_views.sql:15-52`), which returns every pupil's `gem_keep_facts`. So the facts are there; what is missing is a grid grouped by **idea and game**, **stuck flags**, Quick looks, and Today alerts.

The data is also thin because the games are 1 to 6 days old (DECISIONS.md live data). Accuracy sits at 80 to 95% right, so thresholds below are set to catch the clearly stuck, and live in one config file so they can be tuned in 3 or 4 weeks.

## 2. The research behind it

- `research-maths.md`, cross-cutting principle 7: "Record per-idea, per-level evidence. For a teacher to see who is stuck, per-child records need which idea and level, accuracy, hints used, and error types."
- research-design.md rubric criterion 7 (Progress recording): a 4 needs a teacher page that uses the per-fact data. Beanstalk, Hop and Pipi stay at 2 and Quick looks at 2 because no teacher page reads the data (DECISIONS.md calibration).
- Same files on good teacher feedback: counts of "needed help" and wrong picks distinguish a guesser from a fluent child (weka.md candidate 3).

## 3. The change

### 3.1 The "Foundational skills" class grid

A new tab under **Maths**: Skill map | Skips | Hardest questions | **Foundational skills**. (`/teacher/:classId/maths/foundational`.) One row per pupil (display name; real name only where the skill map already shows it), one column per idea, plus a "Flags" column.

| Column (idea) | Game | Made from (records) |
|---|---|---|
| Seeing amounts | Quick looks | Stages finished 0 to 7 from the Training student row (`typing.q.f`, `shared/subitising/saved.ts`) and the recent answers |
| Parts of numbers | Pipi | ladder skills `parts-5`, `parts-10` (keys `part<w>:<s>`) |
| Bonds to 10 | Beanstalk | `bond10:*` keys (skill `facts-10`'s bond part) |
| Bonds to 100 / 1000 | Beanstalk | generated skills `bonds-100`, `bonds-1000` (`ladder.ts:104,107`); two small cells in one column |
| Ten and some | Tūī | `ten-and` (`tenand:1..9`) |
| Make ten, add through ten | Weka | `facts-20` addition keys with a total of 11 to 18 |
| Doubles and halves | Penguin Pairs | `dbl-half-10`, `dbl-half-20`, `odd-even` |
| Counting in steps | Hop | `skip-10`, `skip-5`, `skip-2` |

Cell value (the same four words as the skill map so the two pages never disagree; the brief's "not tried" is the skill map's "Not started"):
- **Not started:** no fact of the idea asked yet.
- **Learning:** some asked, fewer than 70% of the idea's facts in box 2 or higher.
- **Secure:** 70% or more in box 2 or higher (the same 70% as `STEP_SECURE_SHARE`, `shared/maths/selector.ts:60`).
- **Fluent:** 70% or more in the top box (right and quick on two different days).
Each cell shows the mark (`''`, `L`, `S`, `F`) and a colour, so a colour is never the only clue (copy `LEVELS`). Quick looks' cell: Not started = no check done; Learning = 1 to 4 stages finished; Secure = 5 or 6 (up to the ten-frame to 10 and empty squares); Fluent = all 7 (a judgement; stage 5 is where "5 and some" gets used for part-whole, `research-maths.md` idea 1). Tapping a cell opens the facts behind it (reuse `FactGrid`, `src/pages/TeacherGemKeep.tsx`, as the skill map does) and, for the game, "days played, level, last played".

### 3.2 Stuck flags (a small "!" with the reason in words, never colour alone)

Computed by the new function `stuckFlags(pupil)` from one new server call (see section 5). Each flag has a reason line a teacher can read and a threshold in `src/teacher/foundational/config.ts`:

| Flag | Rule (first guess; tune in 3 to 4 weeks) | Reason line |
|---|---|---|
| Same level too long | 5 or more finished challenges at the same level or step (Hop `reached`, Penguin Pairs `reached`, Pipi `reached`, Weka `reached`, Tūī `step`) | "5 challenges on Counting in fives" |
| Looks like guessing | 10 or more wrong taps in 2 or more of the last 5 challenges (`mistakes`; live: 14% of Beanstalk rounds already have 10 or more) | "Many wrong taps in 2 of the last 5 days" |
| Low accuracy | 8 or more attempts in the idea's facts and under 60% right (`gem_keep_facts` attempts, correct) while the cell is Learning | "Bonds to 10: 5 of 12 right" |
| Needed the show-me | 5 or more "shown" goes (2 or more wrong taps on a go, counted from `taps`; exists once R5 is in) in the last 3 challenges | "Needed the explanation 6 times this week" |
| Quick looks struggling | 20 or more answers and under 60% right over the last 20 counted answers, or 3 or more sessions without a stage finishing (quick-looks.md candidate 1) | "Under 60% right on the last 20 pictures" |
| Gone quiet | At least 3 challenges done, none for 10 school days | "Not played for 10 school days" (grey flag, not a warning colour) |

Pupils with no flag show nothing. A flag never says "failing": the words are about what happened.

### 3.3 Today alerts ("Needs you")

One line per game at most, counts and made-up names only (Today may be on a projector; `src/teacher/alerts.ts` header), at most 5 foundational lines, the rest folded into "and 3 more". Each "See" goes to `maths/foundational`.
- "Hop: 2 pupils on the same step for 5 or more days (Speedy Otter 27, Calm Kiwi 4)"
- "Beanstalk: 1 pupil looks like guessing (Brave Weta 12)"
- "Quick looks: 3 pupils under 60% right on their last 20 pictures"
- "Tūī: 2 pupils on step 2 for 5 or more days"
Shown only for games the class has switched on, and only when the flag is new this week or still true (so the same alert does not appear forever once handled: a "Seen" is not needed in v1).
Also "Hardest right now": each of the six game definitions gets `teacher.hardest(classId)` from the same cached class data, returning the 3 weakest facts in words (`7 + ? = 10`, `Half of 14`, `10 + 6`), with attempts, correct and pupils (`HardestRow`, `src/games/types.ts:96-104`).

### 3.4 Smaller fixes that belong here

- Beanstalk's Maths column says what the class is on ("Bonds to 10, 100 and 1000 · N playing", or the one sum if all are on the same) (`useBeanstalkSummary`, `src/games/beanstalk/teacher.ts:17-24`), and the student line says the pupil's own sum (10, 100 or 1000) and "days on this beanstalk".
- A student's page gets a "Quick looks" panel (stage, finished stages, recent accuracy, "keeps the picture on screen" setting): one call to the existing `teacher_training_student`.
- Wording on the Games table uses the same four words.

## 4. Files affected

**Own files, no shared edit (Stage 1; no James OK needed):**
- New: `supabase/migrations/<number>_foundational_teacher_views.sql`, `supabase/tests/database/foundational_teacher.test.sql`
- New: `src/data/foundational.ts` (calls and caches the class data with `shortCache`)
- New: `src/teacher/foundational/config.ts`, `ideas.ts`, `flags.ts`, `FoundationalGrid.tsx`, `foundational.css`, and their tests
- Each game's own definition: `src/games/{beanstalk,hop,korora,pipi,tui,weka}/index.tsx` and `teacher.ts`: add `teacher.alerts` and `teacher.hardest` (and Beanstalk's Maths-column fix)
- `docs/TEACHER-VIEW-PLAN.md` gets a short section (docs only)

**Shared files, a small separate branch each time, James's OK first (Stage 2):**
- `src/teacher/TeacherShell.tsx` (the Maths sub-tab, `:206-228`) and `src/App.tsx` (the route beside `maths/skills`, around `:78`): to show the grid
- `src/teacher/useClassAlerts.ts` (add the Quick looks alert source, because Quick looks has no game definition): `GAME_DEVELOPMENT_GUIDE` section 3 says not to edit the teacher page from a game branch
- `src/teacher/StudentPage.tsx` (the Quick looks panel on a student's page)
- `shared/maths/skillMap.ts` is **not** touched: the grid reuses `LEVELS` and the 70% rule from there by import, and keeps its own idea groupings in the new `ideas.ts`.
Do Stage 1 first; the alerts and hardest rows then already appear on Today without any shared edit (they ride on the existing `teacher.alerts` and `teacher.hardest` contract). The grid itself, the Quick looks alert and the student panel wait for Stage 2.

## 5. Database / migration needs

One new migration (own functions; get the number from `node scripts/migration-numbers.mjs`; not destructive; revokes and grants as the guide's "lock new functions" block; applied automatically when the PR merges):
- `teacher_foundational_class(target uuid) returns jsonb`: guard exactly as `teacher_class_skill_map` (`require_teacher()`, then `teaches_class(target, is_school_admin())`, else 42501). For each pupil in the class: the six game progress rows (`hop_progress`: `reached`, `days_done`, `last_pad_day`; `korora_progress`: `reached`, `days_done`, `last_pebble_day`; `pipi_progress`: `reached`, `days_done`, `last_shell_day`; `tui_progress`: `step`, `level`, `days_done`, `last_flower_day`; `weka_progress`: `reached`, `days_done`, `last_stone_day`; `beanstalk_progress`: `child`, `days_done`, `last_leaf_day`), and for each game the last 5 finished rounds (`mistakes`, count of taps, `finished_at`) from `<game>_rounds` (rounds older than 30 days are deleted, which is fine for "last 5"). Column names above come from the migrations and must be checked again at build time. A pupil in none of the games returns an empty object.
- `teacher_quick_looks_class(target uuid) returns jsonb`: same guard. For each pupil: `training_students.typing->'q'` (placed, start stage, finished, guided), `sessions_done`, and from `training_answers` where `fact_key ~ '^(sub|gap)h?:'` the last 20 counted (non-helped) answers' correct share and the count of answers in the last 30 days. Only the newest `keep_per_fact` answers per fact are kept (`record_training_answers`), so "last 20" is always available.
- The facts for the grid are **not** a new call: reuse `fetchClassMap` / `teacher_class_skill_map` (it already returns every pupil's `gem_keep_facts`, `supabase/migrations/20261019000400_maths_teacher_views.sql:37-42`).
- No new tables, no new columns, no change to a shared function. Not applied by hand.
- Privacy (guide section 5): add one line to `docs/PRIVACY-SUMMARY.md` in the merge step: the teacher sees their own class's foundational progress; no classmate sees anything.

## 6. Test steps

Automated (about 8 in all, because this is not a game; keep them small):
1. `ideaLevel(keys, facts)`: Not started / Learning / Secure / Fluent at the 70% edges, same answers as the skill map for the same facts.
2. `stuckFlags`: each of the six rules fires at its threshold and not below; "gone quiet" is not a warning.
3. Alerts: text uses made-up names only, at most 5 lines, "and N more", and says nothing for a game the class has switched off.
4. `hardest`: returns the 3 weakest facts in words for each game, ignoring facts with fewer than 6 attempts.
5. Grid renders pupils and ideas, marks as letters as well as colours (React test like `TeacherClass.test.tsx`).
6. Database tests: a teacher of another class gets 42501 from both new functions; a student gets refused; a pupil with no rows returns empty.
7. Beanstalk's class line names the sums in use, and the student line the pupil's own (10, 100 or 1000).

By playing the preview and the teacher pages (`npm run dev`, a teacher account with a class of the preview's practice pupils): make a pupil stuck on purpose (5 finished challenges at one step, or many wrong taps) and check the flag and the Today line; check a class with the games switched off; check the narrow-screen layout of the grid; click a cell and read the facts; check Quick looks panel on a student that never used it.

## 7. Effort and impact

M, **High**: it answers the question James actually has ("who is stuck?") for all seven games and moves Progress recording from 2 to 3 for Beanstalk, Hop, Pipi and Quick looks (and to 4 where hint and wrong-pick counts are shown).

## 8. Session prompts (ready to paste)

Prompt 1 is the one in the JSON file. Prompt 2 waits for James's OK on the shared files.

### Prompt 1: Stage 1, own files and the migration

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r7-foundational-teacher. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md (especially sections 3 and 5), docs/plans/maths-review/R7-teacher-foundational-view.md, docs/TEACHER-VIEW-PLAN.md, src/games/types.ts (TeacherContract, HardestRow, TeacherAlert), src/teacher/useClassAlerts.ts, src/teacher/Hardest.tsx, src/pages/SkillMap.tsx, shared/maths/skillMap.ts, and supabase/migrations/20261019000400_maths_teacher_views.sql.

Build Stage 1 only (no shared files, see section 4 of the plan):
1. A new migration (number from node scripts/migration-numbers.mjs) with teacher_foundational_class(target uuid) and teacher_quick_looks_class(target uuid) as in section 5 of the plan, the same guard as teacher_class_skill_map, locked with revoke/grant, and a database test file (a teacher of another class is refused with 42501).
2. src/data/foundational.ts calling both and the existing fetchClassMap, cached with shortCache.
3. src/teacher/foundational/config.ts (thresholds in one place), ideas.ts (idea to keys, ideaLevel using LEVELS and the 70% rule from shared/maths), flags.ts (stuckFlags with reason lines), and the grid component FoundationalGrid.tsx with its css and test (not yet mounted anywhere: that is Stage 2).
4. teacher.alerts and teacher.hardest on the six game definitions (beanstalk, hop, korora, pipi, tui, weka) in their own index.tsx/teacher.ts, using made-up names only; fix Beanstalk's Maths column (class line) and the student line (the pupil's own sum).
5. At most 8 tests in all. Do not edit TeacherShell.tsx, App.tsx, useClassAlerts.ts, StudentPage.tsx, shared/maths, src/components or any other shared file. List in the PR exactly what Stage 2 needs.
Stop and tell James before any live step (the migration applies when the PR merges). Open a PR when done.
```

### Prompt 2: Stage 2, the shared files (only after James says OK)

```text
Work in /Users/jriley/games-hub-isles. Only start this after James has said OK to editing shared teacher files, and after the Stage 1 PR (r7-foundational-teacher) is merged. git fetch origin, make your own worktree and branch from origin/main named r7-foundational-teacher-shared. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md section 3, docs/plans/maths-review/R7-teacher-foundational-view.md and the Stage 1 code in src/teacher/foundational/.

Make three small edits and nothing else:
1. src/teacher/TeacherShell.tsx and src/App.tsx: a "Foundational skills" sub-tab and route maths/foundational that shows FoundationalGrid (copy how maths/skills and maths/hardest are routed).
2. src/teacher/useClassAlerts.ts: add the Quick looks alert (and the "and N more" folding for foundational lines) using src/data/foundational.ts; test it in useClassAlerts.test.tsx.
3. src/teacher/StudentPage.tsx: a "Quick looks" panel for the student (stage, finished stages, recent accuracy, keeps-the-picture setting) from the existing teacher_training_student.
At most 8 tests in all. Typecheck, npm run test:changed, and check the teacher pages in the preview with a stuck pupil. Stop and tell James before any live step. Open a PR when done.
```
