# Prompt: Mine Runner, more maths going live (after stage 7)

Paste everything below the line into a new Claude session opened in `~/projects/school-games-hub-mine` (branch `mine`).

---
You are continuing **Mine Runner** in James's **School Games Hub**. Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks.

## Where things stand
- Mine Runner has been **live since 21 Oct 2026**. Stage 7 ("more maths") is built and tested on branch `mine` but **not deployed or merged**. Read "Stage 7 results" at the bottom of `docs/MINE-PLAN.md` first.
- What changes for pupils: more question doors, number gates (fly into the right answer), a reactor that needs 3 right answers before it can be shot, and pads that need 2 right answers.
- **No migration is needed.** Two live things must change together: the `mine` function (it now makes and checks the new questions) and the website (the new screens). The mines themselves change, so the **old best times must be cleared** (James chose "start the boards fresh").

## Rules
- Deploying, clearing the boards and merging all touch the live site. Only do each when James says so, in words, in this session. Approval for one is not approval for the next.
- Never a bare `git push` (use `git push origin mine`). Never push to `main` from this worktree. Build only your own function: `npm run build:functions -- mine`; if `supabase/functions/monster/index.ts` changes, `git checkout` it.
- Say plainly about any failure.

## Steps
1. **Pre-flight (nothing live).** `git fetch`, merge `origin/main` into `mine`, `npm run build:functions -- mine`, `npm run typecheck`, `npm run test:all`, `npm run build`. Run the browser check: `PLAYWRIGHT_DIR=<folder with playwright> WEBKIT_PATH=~/.cache/ms-playwright/webkit-2370/pw_run.sh npm run mine:determinism` (all three must show `384a26e9`).
2. **Ask James** when to do it. Best is outside lesson time: a pupil mid-mine when the function changes cannot finish that run (the reactor now needs its answers), so say so. Check the live database for runs in the last hour first: `select count(*) from public.mine_questions where created_at > now() - interval '1 hour';`.
3. **Deploy the function:** `npx supabase functions deploy mine --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`. Check: a call with no sign-in answers 401 "Please sign in again."
4. **Clear the old boards** (only after James says): `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi "delete from public.mine_bests; delete from public.mine_runs;"`. Leave `mine_questions` alone (it clears itself). Achievements already earned stay. Tell James what was removed (count the rows first).
5. **Merge to `main`** (only when James says): open a pull request from `mine`, or push `mine:main` only if he says so. Watch "Test and publish" go green. The site and function should go live close together; do steps 3 to 5 in one sitting.
6. **Try it live as a teacher:** fly Otago Diggings with maths on. Answer a question door by pop-up and a gate by flying into a number; get one wrong each time (20 shield and 6 seconds); fill a pad (two right answers); unlock the reactor (three right answers) and finish; check the time is on the board and the points arrive. Try Practice (no questions, reactor unlocked) and hard mode. Try James's phone.
7. **Write it down:** a "Stage 7 went live" note in `docs/MINE-PLAN.md`, update the memory note, and stop for James's feedback.

## How to turn it off again
- The teacher switch (Teacher page, Mine Runner panel) turns the whole game off; the maths switch set to Off removes the questions (question doors open, pads do nothing, the reactor is unlocked).
- To go back to the old maths, revert the merge and redeploy the previous function; the boards would need clearing again because the mines would change back.
