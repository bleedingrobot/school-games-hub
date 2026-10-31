Going live with Bond Match stage M.5: Bond Match suggests a bond from the maths focus or Auto (branch `bond-match`), and the two new ladder skills for decimal and fraction bonds (branch `maths-bonds`). Both were built, tested and pushed on 20 Oct 2026. Nothing is live.

You are working for James, a Year 4–6 teacher. Reply to him in plain, simple words: no jargon, file paths or commit hashes unless he asks. **Each numbered step below needs James's yes in this session, in words. A yes for one step is not a yes for the next.** Before each step, tell him in one or two sentences what will change for the kids, then wait.

## Read first
- `docs/BOND-MATCH-PLAN.md`: "Stage M.5 results" (on `bond-match`).
- `docs/MATHS-FOCUS-PLAN.md`: "Decimal and fraction bonds" (on `maths-bonds`), and `docs/prompts/maths-bonds-golive.md` (same branch).
- `docs/GAME_DEVELOPMENT_GUIDE.md` section 8 (going live one step at a time).

## The rule that must not break
**Bond Match is never evidence for the ladder** (James, 19 and 20 Oct 2026). It only reads the focus and ladder (`my_ladder()`). It never writes fact records, ladder places, focus results or Auto input. Keep `src/games/bond-match/suggest.test.ts` ("never evidence") and the server's "never touches fact records" test passing.

## Where things are
- `bond-match`: worktree `~/projects/school-games-hub-bond-match`. Part B lives in `src/games/bond-match/suggest.ts`, `BondPicker.tsx`, `BondMatchHub.tsx` and the tests. There is no server change and no migration.
- `maths-bonds`: worktree `~/projects/school-games-hub-maths-bonds`, upstream `origin/maths-bonds`. The new skills `fraction-bonds` and `decimal-bonds` live in `shared/maths/skillPacks/bondSkills.ts`, and the ladder is now 33 skills. No migration. The bundled `index.ts` of `gem-keep`, `space-game`, `save-bot-game` and `marble` were rebuilt.
- Never run a bare `git push`. Push by name. Never push from the main checkout. Never run `supabase db reset`.
- Supabase project ref: `zqzhetlzvtptnkmeiumi`.

## Step 0: pre-flight (nothing live, no yes needed)
1. In both worktrees, run `git fetch`, then merge `origin/main`. If `shared/maths/` changed on `main` since 20 Oct, re-run the maths tests on `maths-bonds` before anything else.
2. On `maths-bonds`, rebuild only `npm run build:functions -- gem-keep space-game save-bot-game marble`. `clans`, `lord` and `monster` must be unchanged. If `monster/index.ts` moved, `git checkout` it.
3. In both, run `npm run typecheck`, `npm run test:all` and `npm run build`. A few Space or 101 tests can time out under load. Re-run any failing file on its own before calling it a real failure.
4. Check whether Bond Match is switched on for James's classes. On 20 Oct he asked for it to be on everywhere, but the update was blocked. Read `select id, bond_match_enabled from public.app_settings;` with `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi`. Report what you find. Do not change it without his yes.
5. Tell James what pre-flight found, then ask about step 1.

## Step 1: Bond Match suggestions on the website (`bond-match` → `main`)
- **For the kids:** in Bond Match, the bond from their teacher's focus moves to the front of its shelf with a "Teacher's pick" badge. With Auto on and no focus, their bond is marked "Good for you now". Everything else is the same.
- **How:** after merging `origin/main` and a green full run, `git push origin bond-match:main` (fast-forward), or open a pull request if James prefers. Watch "Test and publish" go green.
- **Check:** the site answers 200. If James can, he opens Bond Match as a pupil in a class with a focus on Bonds to 100 and sees the badge.
- Nothing to deploy: the `bond-match` function did not change. Confirm `supabase/functions/bond-match/index.ts` is the same as on `main`.

## Step 2: four games ready for the new questions (deploy functions from `maths-bonds`)
- **For the kids:** nothing visible yet. The servers for Gem Keep, Space, Marble Rush and the bot games learn to make and mark the new bond questions. This must happen before step 3, so that any question the website asks can be marked.
- **How:** first merge `origin/main` into `maths-bonds` again (it now has step 1) and rebuild the four. Then deploy each with `npx supabase functions deploy <name> --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. Deploy all four on one yes, or one at a time if James prefers.
- **Check:** each answers 401 to an unsigned `curl -X POST https://zqzhetlzvtptnkmeiumi.supabase.co/functions/v1/<name>`, not a crash or a 404. Note the version numbers.

## Step 3: the new ladder steps on the website (`maths-bonds` → `main`)
- **For the kids:** the maths ladder gets "Fractions that make 1" and "Decimals that make 1 and 10" (33 steps instead of 31). Classes on Auto get these questions when they reach them. Teachers can pick them on Set focus. Progress percentages dip a little. Nobody is sent back.
- **How:** `git push origin maths-bonds:main`, or a pull request. Watch "Test and publish" go green.
- **Check:** as a teacher, Set focus lists both skills, and the skill map shows 33. If James agrees, a test pupil with a short focus on one of them plays Gem Keep, and an answer is saved under a `bondf1:` or `bondd1:` key. Read that record only. Don't change or delete anything.

## Step 4: Bond Match opens on the new bonds (build on `bond-match`, then a yes to merge)
1. Merge `origin/main` into `bond-match` (it now has the new skills).
2. In `SKILL_BONDS` (`src/games/bond-match/suggest.ts`), add:
   - `decimal-bonds`: To 1 (hundredths), moving on once `bondd1:hundredths` is secure, then To 10 (tenths).
   - `fraction-bonds`: Quarters, moving on once `bondf1:small` is secure, then Eighths.
3. Add tests: a focus on each skill opens the right bond, the move to the harder set works, and Auto at each skill marks it. Run typecheck, `test:all` and build. Rebuild the preview (`npx vite build --config vite.bond-match-preview.config.ts`) and republish James's private preview page (https://claude.ai/artifact/C9trZSY7R9RC1EfEmExaX3) with the new files. Remove the old asset files.
4. Ask James, then `git push origin bond-match:main` and watch it go green.

## After each step
- Write what was done, when and what was checked: a "Going live (M.5)" section in `docs/BOND-MATCH-PLAN.md`, and a line in `docs/MATHS-FOCUS-PLAN.md` for steps 2–3. Commit and push the branch by name.
- Update the memory note `bond-match-status.md`.
- Stop and tell James in plain words what's live now and what the next step would change.

## Undo, gentlest first
- **Step 1 or 4:** revert the merge commit on `main` (via a branch and pull request, or with James watching). The picker goes back to no badges. Nothing in the database changed.
- **Steps 2–3:** revert the `maths-bonds` merge, then redeploy the four functions from `main`. Records already saved under the new keys stay in the table and are simply not asked. Don't delete them.
