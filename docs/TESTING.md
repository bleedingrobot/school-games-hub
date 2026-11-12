# Testing: keep new tests few

This is a small school website run by one teacher. Every test has to be kept working by whoever changes the code next, so a
test costs time forever. The aim is **a few tests that would catch a real problem for a pupil or a teacher**, not proof that
every line works. On 11 Nov 2026 James chose to cut the suite to these budgets (PR #411 and its follow-up): about 6,700 tests became
about 570, and a full run on one machine went from 4.5 minutes to about 1. Keep it there: a PR that pushes an area over its
budget deletes a weaker test to make room.

## How many

- **An older-pupil game gets at most 8 tests** in total, across its rules, screens and server function (copy Kingdom
  Keeper: 3 rule tests, 3 server tests, 2 screen tests).
- **A junior (Foundational) game gets at most 8 rule and server tests, plus the voice-lines test (`voiceLinesSuite` from
  `src/kit`) and up to 4 screen tests**: the help ladder, the guided first go, the finish card and the show-why mistake
  screen, because those screens are where junior games break (copy Weka). James chose this on 11 Nov 2026.
- A change to an existing game normally adds **none** (change the tests that are there if behaviour changed), and at most 2.
- A bug fix may add **one** test, only if the bug could quietly come back and would hurt pupils (wrong marking, lost saves,
  someone seeing another school's data). Otherwise fix it and move on.
- **Site areas** (not games): `shared/maths` + `src/maths` 25, `src/pages` 29 (25, plus 4 for the profile page, 12 Nov 2026), `src/teacher` 25, `src/data` 20,
  `supabase/functions/_shared` 10, `src/components` (with theme, avatar, speech) 8, `src/App.test.tsx` 6.
- **Waiting in screen tests:** `findBy`/`waitFor` wait up to 5 seconds (`src/test-setup.ts`), so a lazy page loading on a
  busy machine doesn't fail. Don't lower it per test. A test that starts a background import must let it finish before it
  ends, or the file fails with "Vite module runner has been closed" (see `src/pages/LobbyNonMaths.test.tsx`).
- A screen test that waits on the game's own pauses (voice lines, a hand that appears later) uses `fastClock()` from
  `src/fastClock.ts` (copy `src/games/weka/wekaGuide.test.tsx`): the clock runs 20 times faster.
- No slow tests: every test should run in well under 2 seconds. Bot-against-bot or play-to-the-end runs belong in
  `scripts/<game>-sim.mjs`, run by hand when tuning. `vitest.slow.ts` lists slow files for `npm test` to skip; it is empty now, keep it so.

## What is worth a test (in this order)

1. **The server protecting pupils and fairness.** A wrong answer is marked wrong, a save sent twice counts once, another
   student's game or seed is refused, a pupil who isn't signed in gets nothing. One test can check several refusals.
2. **Maths a pupil would see.** Answers are right and questions make sense, checked across many seeds in one test.
3. **A game's main rule**, when a mistake would be invisible until a pupil complained (scoring, winning, legal moves).
4. **One test for a new screen**, only if the screen is complicated: it opens and the main button works.

## What is not worth a test

Wording and labels, colours and styling, tuning numbers, config restated in a test, every edge case of one function, simple
helpers, "renders without crashing" for simple screens, and anything a quick look in the browser shows. Check those by
looking, not with a test.

## Shared checks (don't duplicate them)

- `scripts/migrations.test.ts`: no two migrations share a number.
- Most server functions' `handler.test.ts` check its `index.ts` is up to date with the code. Rebuild with
  `npm run build:functions -- <name>`.
- The database checks in `supabase/tests/database/` (pgTAP, run by CI on a fresh copy) are the security checks for pupils'
  data. A new game writes one file checking the four things in the development guide (section 7), and no more.

## Before you finish

`npm run typecheck`, `npm run test:changed` (the test files your changes touch, slow ones included) and `npm run build`.
Leave the full run (`npm run test:all`, about a minute on one machine) to the pull request's "Site checks", which split it
across 4 machines. `npm run check` still runs everything locally if you need it. If a test fails because you changed behaviour on
purpose, change or delete the test. Don't add a second one beside it.
