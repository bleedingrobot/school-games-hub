# Question skips plan

*James, 22 Oct 2026: "I get the feeling too many kids are skipping questions during the games." Branch `question-skips`
(worktree `~/projects/school-games-hub-skips`). Each stage stops for James. Nothing goes live without his yes.*

## 1. What the live data showed (22 Oct 2026, read-only)

Kids skip the **optional** questions; forced ones are almost always answered (Archery speed round: 99 of 101).

| Question | Shown | Answered | Skipped |
|---|---|---|---|
| Mission Control charge card (solo, maths on) | ~315 | 196 | ~38% |
| Mission Control charge card (classmates) | 51 | 19 | ~63% |
| Dragon Maths "Size it up" | 266 | 152 | 43% (28 of 43 kids skip more than a quarter) |
| Marble Rush pit stops (last 2 days) | ≤973 | 873 | ≤10% |
| Marble Rush rescues (last 2 days) | ≤118 | 63 | up to ~45% |

Skipping costs nothing anywhere; in Mine Runner (−20 shield) and Gem Keep's Mana Well (streak lost) a wrong guess costs
more than skipping. No game kept a record of skips, and Dragon Maths and Clan Quest stored skips as "wrong".

## 2. Stages

- **S.1 Record every skip** — done (below).
- **S.2 Make answering the better choice:** Mission Control charge card survives your own roll and maybe +2 (sim-checked,
  `npm run space:sim`); Dragon Maths size-up prize shown on the button; Marble rescue button shows the prize; wrong in Mine
  Runner / Mana Well costs no more than skipping; an answer-streak sparkle in the question box.
- **S.3 Teacher switch "Skip button": On / 3 per game / Off**, per class (`app_settings` column +
  `teacher_set_question_skips`, like `teacher_set_training_first`); the box hides the button (and Escape) when off, shows
  "Skips left" when limited; servers that mark answers check it.

## 3. Stage S.1 results (22 Oct 2026)

**How it works.** Every game shows its questions in the same box (`src/maths/QuestionModal.tsx`; Clan Quest uses
`src/maths/PracticalAsk.tsx`). The box now notes each question once: *answered* at the first try, or *skipped* if it closes
or moves to another question without an answer (skip button, Escape, timer ran out, the player rolled on). A box gone in
under 0.3 s isn't counted (React's double render, instant swaps). So every game is covered with no change to any game's
server function.

- `src/maths/questionLog.ts`: `noteQuestion`, `setQuestionSink`, `spotFromTitle` ("Power-up pad: Shield" → "Power-up pad").
  The box only notes; nothing is sent unless the site set a sink, so tests and previews send nothing.
- `src/data/questionLog.ts`: `startQuestionLog()` (called in `src/main.tsx`) keeps a per-student queue in this browser
  (`sgh-question-log:<id>`, max 500), sends batches of up to 100 to `log_questions` 30 s after a note, when the page hides,
  and at sign-in. The game comes from the page address (`#/space-game/…` → `space`).
- Explicit kinds where the title varies: Archery "Speed round", Dragon Maths the moment id (`size-it-up`, `shop`, …),
  Maths Monsters "Fight"/"Catch".
- Migration `20261022000900_question_log.sql`: `question_log` (no student rights, 60-day tidy cron `tidy-question-log`),
  `log_questions(items)` (school users; bad notes dropped silently; future times → now; >2 days old dropped; 3,000/day cap),
  `teacher_question_skips(target_class, days)`.
- Teacher page: **Skipped questions** panel (`src/pages/TeacherQuestionSkips.tsx`) for the picked class: Today / 7 / 30
  days, class total, each student (most skips first, real name, where they skip most), each kind of question; rows at 30%+
  skipped (of at least 5) are marked.

**Known limits.** A student could stop notes being sent (only hides their own skips). Stopping a Mana Well round early counts
as one skip. Questions answered on one device and sent later arrive late (up to 2 days).

**Tests.** 17 new unit tests (box notes, queue, panel), `question_log.test.sql` 24/24 on a scratch copy,
`security.test.sql` lists updated (its "who can call what" check passes; its realtime test can't run on a scratch copy).
`npm run test:all` 4,764 pass, typecheck and build clean. **Not yet done:** a real browser run against the local database.

**Go-live (each step needs James's yes).** Recheck the migration number (`node scripts/migration-numbers.mjs`), apply
`20261022000900_question_log.sql` with `db query --linked`, check `question_log` exists and is empty and `log_questions`
refuses signed-out callers, add 900 to the repair note in `docs/PLAN.md`, then merge the PR. No functions to deploy.
After a school day: open the panel, and compare with section 1.
