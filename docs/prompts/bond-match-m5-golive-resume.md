Picking up the Bond Match M.5 go-live. Read `docs/prompts/bond-match-m5-golive.md` (on `bond-match`) and follow it from **step 2**. All its rules still apply. Reply to James in plain, simple words. **Each step needs James's yes in this session, in words. A yes for one step is not a yes for the next.** Before each step, tell him in one or two sentences what will change for the kids, then wait.

## Where things stand (20 Oct 2026, night)
- **Step 0 (pre-flight): done.** Both worktrees merged `origin/main` and were pushed: `bond-match` at 8c63dbf, `maths-bonds` at bc362ed. On `maths-bonds` the rebuild of gem-keep, space-game, save-bot-game and marble made no diff. Typecheck, `test:all` and build were green on both.
- **Step 1: LIVE.** `bond-match` was pushed to `main` (8970173), "Test and publish" went green and the site answers 200. Bond Match shows "Teacher's pick", "Your focus" and "Good for you now". Written up in `docs/BOND-MATCH-PLAN.md` under "Going live (M.5)".
- **Step 2: not started.** Waiting on James's yes. I offered to deploy all four functions on one yes.
- **Steps 3 and 4: not started.**
- **Open question to James:** live `app_settings.bond_match_enabled` is **on only for "Everyone"**. It is off for Riley, Teachers and the school default (`class_id` null). On 20 Oct he had asked for it to be on everywhere, but that update was blocked. Ask him again. Change it only on his yes, and re-read the rows first.
- James switched Claude Code to **manual mode**. Auto mode blocks live pushes and deploys.

## Before step 2
1. `git fetch` in both worktrees. If `origin/main` has moved past 8970173, merge it into `maths-bonds` and `bond-match`. Rebuild only the four functions (`npm run build:functions -- gem-keep space-game save-bot-game marble`). Re-run typecheck, `test:all` and build. If `shared/maths/` changed, say so.
2. Check that clans, lord and monster `index.ts` did not change. If `monster/index.ts` moved, `git checkout` it.
3. Then ask James about step 2 (or carry out the yes he has already given in this session).

## After each step
Write it in "Going live (M.5)" in `docs/BOND-MATCH-PLAN.md`. For steps 2–3, also add a line in `docs/MATHS-FOCUS-PLAN.md` on `maths-bonds`. Commit and push the branch by name. Update the memory note `bond-match-status.md`. Then tell James what's live and what the next step would change.
