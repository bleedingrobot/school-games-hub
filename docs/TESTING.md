# Testing: keep new tests few

*Written 31 October 2026 from the guidance in PR #30 (branch `test-trim`, 26 Oct 2026). That PR also cut the existing tests
from about 5,000 to about 200 and capped the total. The cut was never merged: by 31 Oct it was 152 commits behind, so it was
closed and only this guidance kept. There is no hard cap on the total. Read this before writing any test.*

This is a small school website run by one teacher. Every test has to be kept working by whoever changes the code next, so a
test costs time forever. The aim is **a few tests that would catch a real problem for a pupil or a teacher**, not proof that
every line works.

## How many

- **A new game gets at most 8 tests** in total, across its rules, screens and server function (Kingdom Keeper: 3 rule tests,
  3 server tests, 2 screen tests).
- A change to an existing game normally adds **none** (change the tests that are there if behaviour changed), and at most 2.
- A bug fix may add **one** test, only if the bug could quietly come back and would hurt pupils (wrong marking, lost saves,
  someone seeing another school's data). Otherwise fix it and move on.
- No slow tests: every test should run in well under 2 seconds. Bot-against-bot or play-to-the-end runs belong in
  `scripts/<game>-sim.mjs`, run by hand when tuning. The few slow files already there are listed in `vitest.slow.ts` and
  skipped by `npm test`.

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

`npm run check` (type check, every test including the slow ones, build). If a test fails because you changed behaviour on
purpose, change or delete the test. Don't add a second one beside it.
