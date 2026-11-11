# P2: Progress tab: every game's steps for the class

**Size:** M · **Needs a migration:** no · **Waits for:** P1 (uses stepOf). James chose a new tab beside Today (11 Nov 2026)

**What's wrong:** No page shows the step for the whole class. A teacher opens each pupil, then each folded game line: about 430 clicks for 24 pupils in 6 games.

**What done looks like:** A new 'Progress' tab between Today and Students (route /teacher/:classId/progress). It shows one row per pupil (made-up name and real name, as on the Students tab) and one column per Foundational game that is switched on for the class, plus Quick looks. Each cell has a small step bar filled to the pupil's step, the step number, and a state mark: red 'Nd' when on the same step 5+ days, a blue star when the top step is done, grey 'zz' when not played for 10 school days, otherwise blue. 'not yet' when never played. The name column stays put when the table scrolls sideways. A 'Stuck first' button sorts pupils with the most red cells to the top. Tapping a cell opens the pupil page with that game's line open. Looks like mock-1 (laptop) and mock-4 (iPad landscape) in the project files folder teacher-progress/.

## The change

1. Data: reuse `foundationalClass(classId)` from `src/data/foundational.ts` (already cached and checked on the server). It gives each pupil's `level` (the saved step), `daysDone`, `lastDay` and the last 10 rounds. Quick looks comes from `quickLooks.finished` (0 to 7). Which games are on: the same `ENABLED` calls as `src/teacher/foundational/alerts.ts`.
2. New `src/teacher/progress/state.ts`: `cellState(game, progress, today)` -> 'moving' | 'stuck' | 'top' | 'quiet' | 'none'. Use the same rules and numbers as the flags (`FLAG_RULES.sameLevelDays`, `quietSchoolDays` in `src/teacher/foundational/config.ts`, and `shared/kit/teacherGrid.ts`), so the table and the flags never disagree. Days on the step: count back through `recent` while the round's level equals today's level (P4 makes this exact).
3. New `src/teacher/progress/ProgressTable.tsx` and `progress.css`. Keep it a plain table with `position: sticky` on the first column. Narrow screens (under 700px): one card per pupil listing their games, like the Games table does.
4. `src/teacher/TeacherShell.tsx`: add the 'Progress' tab. `src/App.tsx` `teacherRoutes()`: add `<Route path="progress" element={<Progress />} />` (lazy, like FoundationalSkills).
5. The pupil page: accept `?game=<id>` and open that game's folded line on load.

## Files

new src/teacher/progress/{Progress.tsx,ProgressTable.tsx,state.ts,progress.css,progress.test.tsx}; src/teacher/TeacherShell.tsx; src/App.tsx; src/teacher/StudentPage.tsx.

## Tests and checks

At most three: cellState gives stuck/top/quiet/moving for four made-up pupils; the table renders a row per pupil and a column only for games that are on; tapping a cell links to the pupil page with ?game=. Look at it in the dev preview at 1366x900 and 1180x820 and attach two screenshots to the PR.

## Session prompt (ready to paste)

```text
You are building card P2 of the teacher progress plan for the Games Hub: Progress tab: every game's steps for the class.

Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/TEACHER-PROGRESS-REVIEW.md and this card (docs/plans/teacher-progress/P2-progress-table.md) first. Create your own branch from origin/main named teacher-progress-p2. Reply to James in short, plain words. Run only the tests for files you touch while working, then npm run typecheck and the full npm test once before the PR. Open a PR to main, wait for green checks, then merge it (merging and going live are pre-approved for this project). Then tick this card in docs/plans/teacher-progress/HANDOVER.md (move it to 'Done and live' with the PR number) in the same PR or a tiny follow-up, and add the next card's prompt to the Games Hub Prompts board.

What done looks like: A new 'Progress' tab between Today and Students (route /teacher/:classId/progress). It shows one row per pupil (made-up name and real name, as on the Students tab) and one column per Foundational game that is switched on for the class, plus Quick looks. Each cell has a small step bar filled to the pupil's step, the step number, and a state mark: red 'Nd' when on the same step 5+ days, a blue star when the top step is done, grey 'zz' when not played for 10 school days, otherwise blue. 'not yet' when never played. The name column stays put when the table scrolls sideways. A 'Stuck first' button sorts pupils with the most red cells to the top. Tapping a cell opens the pupil page with that game's line open. Looks like mock-1 (laptop) and mock-4 (iPad landscape) in the project files folder teacher-progress/.

Steps:
1. Data: reuse `foundationalClass(classId)` from `src/data/foundational.ts` (already cached and checked on the server). It gives each pupil's `level` (the saved step), `daysDone`, `lastDay` and the last 10 rounds. Quick looks comes from `quickLooks.finished` (0 to 7). Which games are on: the same `ENABLED` calls as `src/teacher/foundational/alerts.ts`.
2. New `src/teacher/progress/state.ts`: `cellState(game, progress, today)` -> 'moving' | 'stuck' | 'top' | 'quiet' | 'none'. Use the same rules and numbers as the flags (`FLAG_RULES.sameLevelDays`, `quietSchoolDays` in `src/teacher/foundational/config.ts`, and `shared/kit/teacherGrid.ts`), so the table and the flags never disagree. Days on the step: count back through `recent` while the round's level equals today's level (P4 makes this exact).
3. New `src/teacher/progress/ProgressTable.tsx` and `progress.css`. Keep it a plain table with `position: sticky` on the first column. Narrow screens (under 700px): one card per pupil listing their games, like the Games table does.
4. `src/teacher/TeacherShell.tsx`: add the 'Progress' tab. `src/App.tsx` `teacherRoutes()`: add `<Route path="progress" element={<Progress />} />` (lazy, like FoundationalSkills).
5. The pupil page: accept `?game=<id>` and open that game's folded line on load.

Files: new src/teacher/progress/{Progress.tsx,ProgressTable.tsx,state.ts,progress.css,progress.test.tsx}; src/teacher/TeacherShell.tsx; src/App.tsx; src/teacher/StudentPage.tsx.

Tests and checks: At most three: cellState gives stuck/top/quiet/moving for four made-up pupils; the table renders a row per pupil and a column only for games that are on; tapping a cell links to the pupil page with ?game=. Look at it in the dev preview at 1366x900 and 1180x820 and attach two screenshots to the PR.

Don't change anything outside this card. If something in the card doesn't match the code, trust the code, do the closest sensible thing, and say what you changed in the PR.
```
