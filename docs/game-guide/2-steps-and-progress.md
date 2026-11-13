# 2. Steps and the teacher's Progress tab

Teachers see every pupil's step in every game on one page: the **Progress** tab beside Today (`src/teacher/progress/`), with
a table, a ladder board for one game, "who needs a look" pills, and a "Steps in each game" card on the pupil page. The plan is
[docs/plans/teacher-progress/HANDOVER.md](../plans/teacher-progress/HANDOVER.md). A new game must fit it from day one, so decide
these in your plan.

**Words (everywhere: in the game's teacher panel, alerts, How to play for teachers, and plans):**
- A game's ladder is made of **steps**: "Step 3 of 6: Give 6 to 10". Not level, stage, reached or sum.
- **Stage** means only the maths ladder's stages (Skill map) and Quick looks' stages.
- **Picture help** (with `pictureHelp()`), not "help level". **Points level**, not "Level", for the hub's points.
- Use `stepWords(game, saved)` and `stepOf(game, saved)` from `src/teacher/foundational/config.ts`; never write "Step N" by hand.

**A Foundational (early-years) game, so it shows on the Progress tab:**
1. Add your id to `GAME_IDS` (`src/data/foundational.ts`) and an entry to `GAMES` in `src/teacher/foundational/config.ts`:
   `levelWord: 'step'`, a name for every step in `levels`, `top`, and `order` (the saved values from lowest to highest step, in
   case they are not 1, 2, 3, as Hop's 10, 5, 2, 3, 4, 200 are).
2. Save on the progress row: the current step (`step`, or `reached`), `good_at_step` and `good_in_row` if the game moves up on
   good goes, `days_done` and the last day.
3. Save on each round everything in [5-server-and-saving.md](5-server-and-saving.md) "What to save per go" (the step it was played at, every tap with pick and ms, `mistakes`, `first_right`, `slips`).
4. Add your block to `teacher_foundational_class` in a new migration: copy the **newest** body (find it with
   `grep -l "function public.teacher_foundational_class" supabase/migrations/*.sql | tail -1`), add only your game, and
   send `daysDone`, `lastDay`, `level` (the saved step), `good`, `since` and `recent` exactly as the other step games do,
   with `f` (`first_right`) and `ms` (median tap time on rounds with no wrong taps) on each recent round
   (20261111000500 is the pattern). These give the teacher "% right first try · usually 3 s". Check no open branch is changing the same function; if one is, go after it.
   Also add your progress table to the step history (migration 20261111000700): an `after update` trigger on it,
   `create trigger <game>_step_changes after update on public.<game>_progress for each row when (old.<col> is distinct from new.<col>) execute function public.step_changes_log('<col>', '<game>')`,
   where `<col>` is the column that holds the saved step (`step` or `reached`). It records each move up or down in `step_changes`, and the same
   migration's `teacher_foundational_class` sends them as `moves` (add `'moves'` to your game's block as the other games have it; the
   teacher's pupil page shows "up to step 4 on 6 Nov" and a small timeline). Steps are kept with the progress through New Season, so there is no season hook.
5. "Nearly ready" (green ↑): add your game to `GOOD_TO_PASS` in `src/teacher/progress/state.ts` (games that move up on good
   goes, taking the number from your shared config), or to `STEP_KEYS` (games that move up when a step's facts are Secure).
6. The pupil's usual slip comes from the server: `teacher_<game>_student` returns `slip` with the kit's `topSlip` rule (commonest of the
   last 10 rounds, 3 or more, no tie), as Pigeon, Lizard and Swamp Hen do (20261111000300).
7. Test it in `src/teacher/progress/progress.test.tsx`: your game gets a column, the right step shows, and a pupil with good
   goes one short shows "nearly".

**Any other game with levels or a ladder (not a stepped lesson):** it gets a column in the Progress table's "Other games" group
with one number a pupil (the level passed, the hero level, the stars), "zz" when not played for the quiet window, and no stuck or
nearly rule. Add `progressColumns: { note: 'level passed', useCells }` to the game's `teacher` part (`TeacherContract` in
`src/games/types.ts`). Copy `src/games/diamond/teacher.ts` (`useDiamondCells`, with a top so a bar is drawn) or
`src/games/bond-match/teacher.ts` (no top, just the number) and the one line in the game's `index.tsx`. The column shows only while
the game's own teacher `switch` is on for the class. The number comes from `src/data/otherGames.ts`, which reads
`teacher_progress_other_games(class)` (migration 20261111000800): add your game as one more `union all` block in a new migration
(copy the newest body of that function) giving `{ student, game, value, at }`, and save when the pupil last played. Name levels as
steps where they are steps.

**Leaving the game (nothing to add):** the Progress tab's "Leaving the game" panel lists pupils who leave game pages a lot
(`src/data/pageAway.ts`, `teacher_page_away`, migration 20261114000400). It watches every page by its address, so a new game is
included without any code. Ask maths in the shared question box (`QuestionModal` or `PracticalAsk`) and a time away counts as
"during a question" too; a game with its own question screen can call `questionOpened(spot)` from `src/maths/questionLog.ts`.
A page that is not play (like `leaderboard`) goes in `NOT_PLAY` in `pageAway.ts`.

**Keep this file current.** A change to what a new game must save or add to show on the Progress tab updates this file in the same PR.
