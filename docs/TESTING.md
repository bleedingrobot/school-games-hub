# Testing: keep it small

*Written 26 October 2026, when the tests were cut from about 5,000 (4½ minutes) to about 200. Read this before writing any test.*

This is a small school website run by one teacher. Every test has to be kept working by whoever changes the code next, so a
test costs time forever. Thousands of tests made every change slow and every session spend its time fixing tests instead of
games. The aim now is **a few tests that would catch a real problem for a pupil or a teacher**, not proof that every line works.

## The limit

- The whole site has a **test budget**: `scripts/test-budget.test.ts` fails if the number of tests (`it(` / `test(` lines)
  goes over `MAX_TESTS`. Don't raise it on your own. If you think a test is worth more than one already there, swap it
  in. Raising the limit needs James's yes, in that session.
- **A new game gets at most 8 tests** in total, across its rules, screens and server function. A change to an existing game
  normally adds **none** (change the tests that are there if behaviour changed), and at most 2.
- A bug fix may add **one** test, only if the bug could quietly come back and would hurt pupils (wrong marking, lost saves,
  someone seeing another school's data). Otherwise fix it and move on.
- No slow tests: every test must run in well under 2 seconds. No bot-against-bot or play-to-the-end simulations in the
  tests: those belong in `scripts/<game>-sim.mjs`, run by hand when tuning.

## What is worth a test (in this order)

1. **The server protecting pupils and fairness.** A wrong answer is marked wrong, a save sent twice counts once, another
   student's game or seed is refused, a pupil who isn't signed in gets nothing. One test can check several refusals.
2. **Maths a pupil would see.** Answers are right and questions make sense, checked across many seeds in one test.
3. **A game's main rule**, when a mistake would be invisible until a pupil complained (scoring, winning, legal moves).
4. **One smoke test for a new screen**, only if the screen is complicated: it opens and the main button works.

## What is not worth a test

Wording and labels, colours and styling, tuning numbers, config restated in a test, every edge case of one function, simple
helpers, "renders without crashing" for simple screens, and anything a quick look in the browser shows. Check those by
looking, not with a test.

## Always kept (shared checks, don't duplicate them)

- `scripts/functions-built.test.ts`: every server function's `index.ts` is up to date. Don't add per-function copies.
- `scripts/migrations.test.ts`: no two migrations share a number.
- `scripts/test-budget.test.ts`: the limit above.
- The database checks in `supabase/tests/database/` (pgTAP, run by CI on a fresh copy) are the security checks for pupils'
  data. They are not part of the budget: a new game writes one file checking the four things in the development guide
  (section 7), and no more.

## Before you finish

`npm run check` (type check, every test, build). If a test fails because you changed behaviour on purpose, change or delete
the test. Don't add a second one beside it.
