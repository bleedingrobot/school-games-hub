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

**Went live 22 Oct 2026 (James: "Go").** Migration applied to the live database with `db query --linked`; checked: `question_log` empty with row security on, students can't read it, signed-out callers refused on `log_questions` and the table (42501), cron `tidy-question-log` scheduled. PLAN.md repair note now includes 900. Site published by merging the PR.

## 4. Stage S.2 results (22 Oct 2026, branch `question-skips-2`, NOT live)

- **Mission Control:** `MATHS_CHARGE_STEPS` 1 → 2 (`shared/space/engine.ts`); every "+1" about the charge now reads the constant
  (cards, log line, How to play). The Roll button says "Roll without the +2" while the card is open and unanswered (solo and
  classmates). Sim, Nebula cosmic, 1,000 games each:

  | | +1 | +2 |
  |---|---|---|
  | 4 rockets, student always right: wins | 29% | 37% |
  | 4 rockets, student never answers: wins | 15% | 11% |
  | 2 rockets, always right / never | 55% / 33% | 60% / 28% |
  | 4 rockets, rounds (always right) | 12.6 | 10.8 |

  Bots get +2 too, so games are about 12% shorter. Needs `save-bot-game` and `space-game` redeployed (one constant).
- **Dragon Maths:** a right Size it up also pays 20% more gold for a win (`SIZE_IT_UP_GOLD`, rounded up), added to the hero on
  the server; the button says "Size it up: a right answer = first hit ×1.5 and +20% gold". Needs `lord` redeployed.
- **Marble Rush:** Skip buttons say "Skip (no time off)" / "Skip (no time back)".
- **Every game:** the question box cheers "🔥 3 in a row!" from 3 right answers in a row (any game, this page visit); a wrong
  answer or a skip starts again. Website only.
- **Not changed, on purpose:** Mine Runner's wrong-answer cost (James set −20 shield on 20 Oct, and saved runs replay with
  the engine, so a change could break old runs; Mine Runner had 1 saved run); Gem Keep's Mana Well (a wrong answer only loses
  a 5-mana streak bonus).

**Tests:** test:all 4,767 pass, typecheck and build clean; new tests for the Roll button, the gold (server + unit), the
streak, Marble labels.

**Go-live (James's yes):** merge `origin/main`, redeploy `save-bot-game`, `space-game`, `lord`
(`--no-verify-jwt --use-api`), check each answers 401 signed out, merge the PR. No database change. Deploy the functions just
before merging: a game started on the old site and saved after the deploy is judged with +2 (a solo space game played with
+1 charges would be refused). Best done outside school hours.

**Went live 22 Oct 2026 evening (James: "go").** `save-bot-game`, `space-game` and `lord` deployed (each answers 401 JSON signed out); site published by merging the PR.

## 5. Stage S.3 results (22 Oct 2026, branch `question-skips-3`)

**Numbers first (step 0, read-only, 22 Oct afternoon).** Too early to judge S.2: `question_log` had only 20 notes, all one
person on the warm-up (looks like a test), because no class had played since S.1 went live. Dragon Maths "Size it up" over
the 3 days before S.2: 174 offered, 58 skipped (33%; section 1 said 43%). James said build S.3 anyway; suggestion: leave
every class On until a school day of numbers is in.

**James's decisions (22 Oct, "all yes" to every suggestion):**

| Where | With the switch Off |
|---|---|
| Mission Control charge card | Roll waits until the card is answered (button says "🎲 Answer first, then roll"; Space doesn't roll either). With "3 per game", rolling past the card uses a skip. |
| Dragon Maths | "Size it up" stays a choice. Its question boxes lose "Skip, just fight", "No thanks, pay full price", "Walk on", "Not today", "Skip this one", "Skip". |
| Gem Keep "Well done" / "Cancel" | Stay (opt-in rounds). |
| Maths Monsters "Back" | Stays (no turn passes). |
| Mine Runner "Not now" | Counts as a skip: hidden. |
| Clan Quest "Show me how" | Stays (it's for learning). Battle Cry's "No thanks" is a plain skip: hidden. |
| Timers (Mission Control wormholes and classmates card, Archery) | Still run out. |

**How it works.**
- Migration `20261022001100_question_skips_switch.sql`: `app_settings.question_skips text not null default 'on'`
  (`on` / `limited` / `off`) and `teacher_set_question_skips(mode, target_class)`, copied from `teacher_set_training_first`.
  Columns only; no shared function re-created.
- `src/maths/questionLog.ts`: the rule (`setSkipMode`, `resetSkips`, `spendSkip`, `skipRule`, `useSkipRule`,
  `SKIPS_PER_GAME = 3`). Nothing sets it in tests or previews, so the box behaves as before there.
- `src/data/questionSkips.ts`: `useSkipRuleSync()` (mounted once in `App`) reads `question_skips` from the shared settings
  row (`readSettings`, no extra request) for a student, never for a teacher, and resets the skips used on every new page
  address (so "per game" = per visit to a game page; a new Mission Control game is a new address). If the row can't be read,
  the rule stays as it was (On to start). `fetchSkipMode` / `saveSkipMode` for the teacher page.
- The box (`QuestionModal`, `PracticalAsk`): Off or 0 left = no skip button and no Escape. "3 per game" shows "Skips left: N"
  under the button ("No skips left in this game" at 0). New props `closeIsSkip={false}` / `noThanksIsSkip={false}` keep
  Gem Keep's, Monsters' and Clan Quest's buttons.
- Teacher page: the three-way "Skip button" choice at the top of the Skipped questions panel, for the picked class, in the
  Mission Control switch's `level-picker` look, with a line saying which buttons stay.
- **No server function changed.** Skipping was never scored, so there's nothing for a server to check. A student who
  edits the page could still skip; that only hides their own learning, and the skip record still shows it.

**Tests.** New: `src/maths/skipRule.test.tsx` (rule, box, PracticalAsk; 11), `src/data/questionSkips.test.tsx` (6), 2
panel tests, a Mission Control screen test (Roll waits with skips off). `question_skips_switch.test.sql` 14/14 on a scratch
copy; `security.test.sql` "who can call what" passes (its realtime check can't run on a copy, as before);
`training_first` and `question_log` tests still pass. `npm run test:all` 4,787 pass, typecheck and build clean.
**Not yet done:** a real browser run.

**Go-live (each step needs James's yes).** Recheck the migration number, apply `20261022001100_question_skips_switch.sql`
with `db query --linked`, check every row is `on` and signed-out callers are refused on `teacher_set_question_skips`, add
1100 to the repair note in `docs/PLAN.md`, open and merge the PR, watch "Test and publish" go green, check the live JS has
"Skips left". No functions to deploy. The site can safely go out before or after the migration: with no column, the
switch reads as On.

**Went live 22 Oct 2026 (James: "all yes, proceed").** Migration applied to the live database with `db query --linked`;
checked: all 4 settings rows `on`, `teacher_set_question_skips` refused signed out (42501; anon has no execute, signed-in
users do). PLAN.md repair note now includes 1100. Site published by merging the PR. No functions deployed.
