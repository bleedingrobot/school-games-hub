# Tests plan: after the audit

Written 19 Oct 2026, after the test audit on the `lean-tests` branch (worktree `~/projects/school-games-hub-lean-tests`).
Four steps, in this order. Each one stops and waits for James to say "go" in words before anything is pushed,
applied to a database, or changes how the game plays.

## Where things stand

- The audit made the tests faster and steadier, and split them into quick checks for while you work and the full set
  for before a push. Full run 5:19 → about 2:57; `npm test` 3:40 → about 2:13. Details are in the two commits on
  `lean-tests` (`b393b2a`, `2872953`).
- Nothing is merged or pushed. `main` on GitHub has not moved since the branch was made (80f3ea9).
- Three things were found and left alone, because each needs James's say-so: the Dragon Maths question box that can
  get stuck (step 2), the local database missing six changes (step 3), and the database tests not being part of the
  publish (step 4).

## Step 1: merge the test changes

**Why first:** the longer it waits, the more other branches change the same test files.

1. In the `lean-tests` worktree: `git fetch`, then merge `origin/main` into `lean-tests` if it has moved.
2. Run `npm run check` (type check, every test, build). It must pass, apart from the known Dragon Maths flake (step 2);
   if that one fails, run its file again on its own and say so.
3. The local `main` checkout is 2 commits ahead and 5 behind GitHub. Its 2 commits are a merge and a copy of the
   "Write it as a decimal" change that GitHub already has. Bring local `main` level with `origin/main` first (check
   the copy really is the same with `git diff origin/main main -- shared src`), then merge `lean-tests` into it.
4. Run `npm run check` again on `main`.
5. **Stop. Push only when James says so.** The publish runs the full set and only goes live if it passes.
6. Afterwards: the other branches touch only small parts of the same files. `bond-match` and `marble` change
   `package.json` (the scripts list) and `dragon-maths` changes `README.md`. When each is next merged, keep both sets of
   changes. Remove the old `~/projects/school-games-hub-faster-tests` worktree, which is already merged.

**Done when:** the change is live on GitHub, the publish shows a green tick, and `npm run test:changed` works on `main`.

## Step 2: the Dragon Maths question box that can get stuck

**What was seen:** the test "starts each question empty when questions follow straight on" (`src/games/lord/useAsk.test.tsx`)
fails about 1 run in 10 to 20, and did before the audit too (2 of 20 with the original test). When it fails, a master's
trial question either stays on screen for 10 seconds, or the next question's box can't be found by its title.

**Likely cause (not yet proven):** the question box takes its title's id from the question's own number
(`question-${question.id}-title` in `src/maths/QuestionModal.tsx`), and questions from two packs can have the same
number. That is the same cause as the bug fixed on 19 Oct (`12d322c`, "fresh question box for each question in a
row"), so that fix may not cover every case. For a pupil this would mean a trial question that seems frozen.

1. **Make it happen every time.** The test lets the game pick each question's pack at random (`Math.random`), which is
   why it only sometimes fails. Change the test to pick the packs itself, and find a pair of packs and numbers that
   fails every time. Test change only.
2. **Prove the cause** with that failing case: two boxes sharing an id, or a box that never closes.
3. **Stop and show James** what was found, in plain words, before changing the game.
4. **Fix it** (likely: give each box its own id, for example from React's `useId` or the box's own number in `useAsk`),
   keep the test that now fails every time as the guard, and run the test 30 times in a row: no failures allowed.
5. Check a real master's trial in the Dragon Maths test page (`npm run lord:preview`).
6. Run `npm run check`. Push only when James says so.

**Done when:** the test passes 30 runs out of 30 and James has seen a trial work in the browser.

## Step 3: bring the local database up to date

**Why:** the shared local copy is missing the six 19 Oct changes (`20261019000200` to `20261019000700`), so 7 database
test files fail there (`home_page`, `maths_auto`, `maths_fdp`, `maths_focus_results`, `maths_generated`,
`maths_teacher_views`, `security`). On a scratch copy with all the changes, all 35 files pass except two checks about
the nightly scheduler, which a scratch copy only fakes.

1. **Stop and ask James first:** other sessions use the same local copy, so do this when nothing else is running.
2. `npx supabase migration list --local` to see what is missing.
3. `npx supabase migration up --local` to apply only the missing ones. If it refuses because the copy has gaps (an older
   change missing while a newer one is in), look at which one before reaching for `--include-all`. Do **not** use
   `supabase db reset`, which wipes the copy.
4. Run `npm run test:db`: all 35 files must pass.

**Done when:** `npm run test:db` passes on the local copy.

## Step 4 (later, optional): database tests in the publish

**Why:** the 1,872 database checks keep each school's and each pupil's data apart, and at the moment nothing runs them
automatically. They only run when someone remembers `npm run test:db`.

1. In `.github/workflows/deploy.yml`, add a job that starts a throwaway Supabase copy with the Supabase setup action
   (`supabase/setup-cli`), runs `supabase db start` (which applies every migration), then
   `supabase test db supabase/tests/database`.
2. Make the publish job need it, so a failing database check stops the publish.
3. It adds a few minutes to each publish (mostly downloading the database). Show James the time on the first run.
4. **Stop. Push only when James says so.**

**Done when:** a publish shows the database job passing, and a deliberately broken check on a test branch stops it.

## The everyday commands (for reference)

| While working | Before a push |
|---|---|
| `npm run test:changed`: only the tests your changes affect (~40 s) | `npm run check`: type check, every test, build, the same as the publish (~3 min) |
| `npm run test:watch`: re-runs tests as you save | `npm run test:db`: the database rules (needs the local copy) |
| `npm run test:logic`: rules, maths and server only (~50 s) | |
