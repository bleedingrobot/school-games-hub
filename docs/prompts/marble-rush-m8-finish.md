# Prompt: Marble Rush, finish M.8 (docs, phone preview) and go live

Paste this into a new chat to continue. Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

---
You're finishing Marble Rush, a game for James's School Games Hub (Year 4-6, Douglas Park School). Stages M.1 to M.7 and most of M.8 are built and pushed.

## Where things are

- Code: worktree `~/projects/school-games-hub-marble`, branch `marble`, pushed to origin. Work only there. Other sessions use other worktrees: don't touch them, never use bare `git stash`, and never `pkill -f` with text that is also in your own command (it kills your shell).
- Read first: docs/MARBLE-PLAN.md (section 7 and the Results for M.4 to M.6), docs/prompts/marble-rush-m6-onwards.md (going-live steps, still correct), memory notes school_games_hub.md and maths_focus_plan.md.
- **Built, tested and pushed:**
  - M.6: answer gates in all six courses (open door = right answer; wrong tunnel = dead end), server question list from the focus system (`marble_questions`, students can't read it), pit stops (right answer = 2 s off via the `BONUS` input), Read time, teacher switches (`marble_maths` off/choose/on, `marble_rescue`), separate bests, ghosts and boards with and without maths, open doors kept with each saved run.
  - M.7: rescue questions (`REFUND`, one per 20 s of play), number gems on Glacier Run, Windy Welly and Alpine Crossing (right gems chosen from the seed like doors, 1 s off each, 5 max, never recorded; also kept with saved runs), guess your time (10% = star, never saved), `goldMaths` medal time. **No maths achievements or points were added: the plan postpones them, ask James before adding any.**
  - M.8 so far: How to play screen (`src/games/marble/HowToPlay.tsx`), accessibility pass (axe: no violations at 1366x640 and 768x1024; the picker now sits on a white card because the real page is school red), New Season clears Marble data (in the migration).
  - Also fixed: four courses had no checkpoints (corner pieces painted over them); now they do.
  - Migration is `supabase/migrations/20261019000200_marble.sql` (after main's `20261019000100`). Not applied live. The `marble` function is not deployed. `MARBLE_ON` in `src/games/marble/switch.ts` is false.
- **Known limits to mention in the docs:** open doors and right gems tell a determined student which answer is right (only gets a faster run; pit and rescue answers are marked on the server). Gold times differ by up to ~4 s between seeds on courses with 3-tunnel gates. Pauses stop the physics rather than being written as `HOLD` steps (nothing in the replay could tell the difference). The bot can't do "wrong tunnel first" on Geyser Valley, Glacier, Windy or Alpine, so silver is worked out from the perfect run plus 6.5 s per gate. Gems are not in the gold bot run.

## Still to do

1. **Docs.** Add to docs/MARBLE-PLAN.md a Results section for M.7 and M.8 (what's above), and update sections 7 and 10 where they differ (HOLD, gems chosen from the seed, rescue spacing, medals). Add Marble to docs/PRIVACY-SUMMARY.md (best times and replays are stored; boards show word-names only; gate, pit-stop and rescue answers go into the maths records; gems and guesses are not saved; New Season clears Marble times). Add a short Marble Rush section to README.md (near the Mission Control maths part; the "five functions" line is out of date, the `marble` function needs Verify JWT off) and a `marble/` entry in shared/README.md.
2. **Whole checks before anything live:** `npx tsc --noEmit`, `npm run build:functions`, the whole suite in the background (`npm test`, about 5 minutes; the TeacherClass "just names the class" test is flaky under load), `npm run marble:determinism` (see the CHROMIUM_PATH and PLAYWRIGHT_DIR notes in the M6 prompt), and the database tests on a scratch copy: `bash scripts/scratch-db.sh <name>`, then insert Douglas Park (`insert into public.schools (id, name) overriding system value values (1,'Douglas Park School'); insert into public.school_domains values ('douglaspark.school.nz',1)`) and run each `supabase/tests/database/*.test.sql` through psql. Four files fail on a scratch copy even without Marble (clans_fights, classes, maths_focus, training); marble and security must be clean. Drop the scratch copies afterwards.
3. **Phone preview for James** (still owed, he has not played it). `npm run marble:preview` builds a stand-alone page that makes and marks its own questions. Make a single-file version (see `npm run monsters:single`), publish it as a private claude.ai artifact and give him the link. Quote nothing as live.
4. **Going live** (only after James is happy, or if he again says to go all the way). Re-check the live state first and stop and ask if anything looks off:
   - Apply the migration: `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/20261019000200_marble.sql` (token at `~/.supabase/access-token`), then check other tables' counts are unchanged.
   - `npm run build:functions`, then `npx supabase functions deploy marble --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`; check it answers 401 signed out.
   - `git fetch`, merge `origin/main` into `marble`, re-run everything, fast-forward `main`, set `MARBLE_ON` to true, push, watch the Pages run go green.
   - Update docs and the memory note school_games_hub.md. If a later migration on main redefines `teacher_new_season`, it must keep the three marble delete lines.

## How to work

Small commits on `marble`, pushed, ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. If anything is wrong or too big, say so plainly and suggest a fix.
