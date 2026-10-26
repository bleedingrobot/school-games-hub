Going live with the decimal and fraction bonds (branch `maths-bonds`, Bond Match M.5 part A). Read "Decimal and fraction bonds" at the end of `docs/MATHS-FOCUS-PLAN.md` first.

You are working for James, a Year 4–6 teacher. Reply in plain, simple words. **Each step only after James says yes to that step.**

What it changes for kids: two new steps on the maths ladder, "Fractions that make 1" and "Decimals that make 1 and 10". Classes with Auto on will see these questions in Gem Keep, Space, Marble Rush and the bot games when they reach them; teachers can pick them on Set focus; progress shows 33 skills. Bond Match never counts towards them.

0. **Pre-flight (nothing live):** `git fetch`, merge `origin/main`, rebuild only `npm run build:functions -- gem-keep space-game save-bot-game marble` (check `clans`, `lord` and `monster` are unchanged; `git checkout` monster's if it moved), `npm run typecheck`, `npm run test:all`, `npm run build`. No migration.
1. **Deploy the four functions** (one yes for all four, or one at a time if James prefers): `npx supabase functions deploy <name> --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api` for `gem-keep`, `space-game`, `save-bot-game`, `marble`. Check each answers 401 signed out. Deploy them before the website, so a new question the website asks can always be marked.
2. **Merge to `main`:** push `maths-bonds:main` (or a pull request) only on James's word. Watch "Test and publish" go green.
3. **Check:** as a teacher, Set focus lists both new skills; a test student with that focus gets the questions in Gem Keep and an answer is saved.
4. **Then Bond Match:** on branch `bond-match`, add `fraction-bonds` and `decimal-bonds` to `SKILL_BONDS` in `src/games/bond-match/suggest.ts` (decimal: To 1 (hundredths), then To 10 (tenths) once `bondd1:hundredths` is secure; fraction: Quarters, then Eighths once `bondf1:small` is secure), with tests.

Undo: redeploy the four functions from `main` before the merge, and revert the merge commit. Records saved under the new keys stay in the table and are simply not asked.
