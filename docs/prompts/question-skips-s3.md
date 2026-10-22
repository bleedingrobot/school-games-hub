# Question skips, Stage S.3: the teacher's "Skip button" switch

You're continuing work on School Games Hub for James, a Year 4–6 teacher at Douglas Park School. Reply to him in plain, simple words: no jargon, file paths or commit hashes unless he asks. He is often on his phone using remote control, so he can't always change Claude Code's permission mode. Ask him in words.

## Where things are

- Repo: `~/projects/school-games-hub` (the main checkout: **don't work there**; other sessions use it). Work in the worktree `~/projects/school-games-hub-skips` on branch **`question-skips-3`**. It was made from `main` after Stage 2 went live and holds only this prompt. Its `node_modules` is a symlink to `../school-games-hub-archery/node_modules`; if the symlink is missing, check that `package-lock.json` matches first, then recreate it.
- Read first: `CLAUDE.md` → `docs/GAME_DEVELOPMENT_GUIDE.md` (migration numbers, `app_settings`, scratch databases, go-live rules), then **`docs/QUESTION-SKIPS-PLAN.md`** (the whole story: live data, S.1 and S.2 results).
- Already live (22 Oct 2026):
  - **S.1.** Every question the shared question box shows is noted as answered or skipped. Code: `src/maths/questionLog.ts`, `src/maths/QuestionModal.tsx`, `src/maths/PracticalAsk.tsx`. Notes are sent by `src/data/questionLog.ts` to `log_questions()` and land in `question_log` (migration `20261022000900_question_log.sql`). The teacher page's "Skipped questions" panel is `src/pages/TeacherQuestionSkips.tsx`.
  - **S.2.** Answering pays more than skipping: Mission Control +2, Dragon Maths Size it up +20% gold, Marble skip labels, and a "3 in a row" cheer.

## Step 0: look at the real numbers first

Kids have now played with S.1 and S.2 live. Before building anything, read `question_log` on the live database (read-only):

`npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file>`

Report to James in a few plain lines:
- skips per game and per kind of question (`spot`)
- how many children skip a lot
- whether the S.2 changes seem to have helped. Mission Control's charge card is `spot` "Mission Control" in game `space`. Dragon's "Size it up" opt-in is in `lord_fights`: `options->>'sizeUp' = 'true'` and `result->>'sizeUp'` is null. Compare with section 1 of the plan.

If skipping has dropped a lot, ask James whether S.3 is still wanted before building.

## What S.3 is (James chose this on 22 Oct)

A per-class teacher switch, **"Skip button": On (default) / 3 per game / Off**.

- **Database:** a new migration with the next free number (`node scripts/migration-numbers.mjs` after `git fetch`).
  - Add `app_settings.question_skips text not null default 'on' check (question_skips in ('on','limited','off'))`. Add columns only.
  - Add `teacher_set_question_skips(mode text, target_class uuid default null)`, copying `teacher_set_training_first` in `20261022000300_training_first.sql`.
  - Add the function to the callable list in `supabase/tests/database/security.test.sql`.
  - Write a pgTAP test, run on a scratch copy (`scripts/scratch-db.sh` / `scripts/scratch-test.sh`). Never `supabase db reset`.
- **Reading it:** students read it through `readSettings()` (`src/data/classSettings.ts`, one shared remembered request). Hand the rule to the question box the way S.1 hands over the note sink: a small module-level setter in `src/maths/questionLog.ts`, set by the data layer. The box must not fetch it itself, and previews and tests keep today's behaviour. **Teachers are never limited** (same as the Training lock).
- **The box** (`QuestionModal`, `PracticalAsk`):
  - Off: no skip button, and Escape does nothing.
  - "3 per game": shows "Skips left: N". Count per visit to a game page; reset when the route changes. At 0 it behaves like Off.
  - Everything else stays the same.
- **Teacher page:** put the three-way choice at the top of the "Skipped questions" panel, using the class picker (`useTeacherClass`), with the same radio/`level-picker` look as the Mission Control maths switch in `src/pages/Teacher.tsx`.

## Decide with James before building (ask in one message, with your suggestion for each)

Some "skips" aren't the plain skip button. For each, say what Off should do and suggest:

1. **Mission Control charge card.** Rolling past it skips it. Should Off disable Roll until the card is answered? (Suggest yes. The card shows right after your turn, so it doesn't slow the game.)
2. **Dragon Maths "Size it up".** It's a choice next to "Fight!", not a skip button. Should Off make it compulsory when it's offered? Also, Dragon's other "No thanks / Walk on / Not today" buttons. Suggest: Off removes those "no thanks" buttons, but "Size it up" stays a choice.
3. **Gem Keep.** "Well done" ends a Mana Well round early, and Forge has "Cancel". Suggest these stay: they're opt-in rounds, not skips.
4. **Maths Monsters "Back"** (go back and choose another move). Suggest it stays: no turn passes.
5. **Mine Runner "Not now"** (the same question comes back later). Suggest it counts as a skip.
6. **Clan Quest "Show me how"** (shows the working). Suggest it stays: it's for learning.
7. **Classmates games with a timer** (Mission Control wormholes, Archery). Running out of time can't be stopped. Suggest the timers stay.

Then build only what James agrees.

## Rules

- Server functions: change none unless James's answers need it. The switch is mainly a website change. If you do change one, rebuild only that function (`npm run build:functions -- <name>`) and redeploy it at go-live.
- Tests: unit tests for the box, for the rule module and for the panel. Before saying it's done, run `npm run typecheck`, `npm run test:all` and `npm run build`.
- Write a "Stage S.3 results" section in `docs/QUESTION-SKIPS-PLAN.md`, commit, and push the branch by name (`git push origin question-skips-3`). Commit and PR messages end with the attribution lines your system reminder gives.
- **Stop after building**, tell James what's ready in plain words, and wait. Going live needs his yes:
  1. Apply the migration with `db query --linked`.
  2. Check that the column defaults to `on` everywhere and that signed-out callers are refused.
  3. Add the number to the repair note in `docs/PLAN.md`.
  4. Open a PR and merge it.
  5. Watch "Test and publish" go green.
  6. Check the live site's JS has the new text.
- Update the memory note `games_hub_question_skips.md` when done.
