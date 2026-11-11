<!-- PR body checklist for a game's go-live PR (docs/game-guide/8-going-live.md). Keep the attribution lines the session
     gives you at the top. Tick each box or say why it doesn't apply. -->
## What goes live
- Migration(s): `<number>_<id>.sql` (applied on merge; on hold: no)
- Function: `<id>` (`index.ts` rebuilt with `npm run build:functions -- <id>`)
- Switches: code switch <on/off>, teacher switch default <on/off>

## Must be true
- [ ] Nothing that counts is decided by the browser; the server marks or replays it; a save sent twice counts once.
- [ ] Older game: maths from `makeFocusPack` and the server's focus (way A). Junior game: rounds from early-facts records, taps replayed. Recorded with `recordMathsAnswers`.
- [ ] Every new table has RLS, server-only tables have no policy or grant, every new function is locked to the right role, pupils see only their school.
- [ ] Migration number free across `main` and every branch (`node scripts/migration-numbers.mjs`), after everything it builds on.
- [ ] Merged with the latest `origin/main`; `typecheck`, `test:changed`, `build` and the database test on a scratch copy pass; PR checks green.
- [ ] No other game's function or `index.ts` changed.
- [ ] The server refuses requests while the teacher switch is off.

## Should be true
- [ ] Every kind of question shows and can be answered (older games: every `LADDER` skill).
- [ ] Screens checked at 1366×640, 1024×768, 820×1180, 844×390 and 390×844; 44 px targets, 4.5:1 contrast, focus moved, reduced motion.
- [ ] A new pupil gets through the first go with no adult (guided first go, skip, replay, next-step line).
- [ ] Learning design: guessing doesn't win; a wrong answer shows why; help follows results; clock starts after the voice; scored 3+ on every line of `docs/reviews/maths-review/research-design.md`.
- [ ] Shows on the teacher's Progress tab (steps, stuck, nearly) or as an "Other games" column.
- [ ] Turns limited? In `UNLIMITED_GAMES` and `teacher_set_unlimited_today()`.
- [ ] Bella's clips for every line; voice-lines test passes.
- [ ] Tests within `docs/TESTING.md` "How many".
- [ ] `docs/PRIVACY-SUMMARY.md`, `shared/README.md`, the plan's Status line updated; id in `registry.test.ts` if the code switch turns on.
- [ ] The guide fixed in this PR if anything in it turned out wrong.
