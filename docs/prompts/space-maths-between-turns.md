# Prompt: Mission Control maths, "between turns" question

Paste this into a new chat to carry on.

---

You're carrying on a feature for James's School Games Hub (a website of games for his Year 4-6 class). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

**Where things are**
- Code: `~/projects/school-games-hub`, branch `space-maths` (pushed, not live). Live site = `main`.
- Read first: `docs/SPACE-MATHS-PLAN.md` (the approved plan, results in section 10) and the memory note `school_games_hub.md` (last paragraphs).
- Done so far on the branch: M.1 (times-table records built from each answer), M.2 (game rules: wormhole question, black hole question, Mission Boost, bots answer at 60/75/90%), M.3 (maths in games against bots and pass-and-play: settings chip, question card, saving with server-checked answers). The Mission Boost starts charged. Not live: students can't turn maths on yet (the teacher switch is M.5; until then only a dev build with `?maths=choose` or `?maths=on` can).
- Private phone preview: https://claude.ai/artifact/QLd7DZEh7DsJ2A18vXRqje (republish with `npm run space:preview`, then publish a tiny page plus the `dist-preview/assets` files to that same artifact URL).

**The change James asked for (his idea, 17 Oct 2026)**
A question right after your turn ends, answered while other people are taking their turns. A right answer adds +1 to your next roll. Wrong or skipped does nothing. He approved my suggestion: **replace the Mission Boost button with this**, and keep the wormhole and black hole questions as they are. Details I proposed:
- The question is a small side card, not a pop-up over the board. No timer. It's optional and stays up until answered or until the student rolls.
- On the student's next turn it shows "+1 charged from your answer".
- Against classmates it fits the waiting time. Against bots the bots are quick, so the card stays until the student rolls.
- Expect about one question a turn (around 12 a game); games get about a tenth shorter.
- Wrong answers never hurt anyone and never show to others. With maths off the game must behave exactly as before.

**Suggested design (change it if you find something better)**
- Engine (`shared/space/engine.ts`): a new action `{ kind: 'charge', right: boolean }` the student sends at the start of their next turn, before rolling, once they've answered. Right gives +1 steps on that roll (a `maths-charge` change in `stepsFor`); wrong just records. Replace `boostTurns`, `canBoost`, `BOOST_CHARGE_TURNS`, the `boost` action and the boost parts of the bots, text, tests and simulator. Never live, so no old games to keep working.
- Saving (`shared/space/save.ts`): the answer for a `charge` action goes in the report's `answers` list in order, like the other questions, and the server checks it matches the right/wrong sent. Same records function (`record_fact_answers`).
- Screen (`src/games/space/SpaceSolo.tsx`): the card appears when the student's turn ends, uses the same question picking (`readyLevel`, the student's records, the teacher's tables settings), and sends the `charge` action automatically when their next turn starts. Pass-and-play: leave it out (shared device, nothing recorded).
- Re-run the simulator (`npm run space:sim -- --games 500 --board nebula --maths`) and put game length and fairness in the plan.

**Then the remaining plan steps (stop for James after each)**
- M.4 games with classmates: the server picks and marks questions (`space-game` function), the question card shows while waiting, only good news shown to others, the host's maths setting is used and shown in the waiting room. The wormhole/black hole questions there have a 20-second timer.
- M.5 teacher switch (Off / Students choose / On for everyone) in the Teacher page, achievements (Mission Control, Wormhole booster, Great escape), How points work, How to play guide, privacy summary line, accessibility check.
- Go live only when James says yes. It needs: migration `20261017001200_fact_answers.sql` (not yet applied live), plus whatever new migration M.4/M.5 add, applied with `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file>`; deploy `save-bot-game`, `space-game` and `gem-keep` (`npx supabase functions deploy <name> --no-verify-jwt --use-api --project-ref zqzhetlzvtptnkmeiumi`); verify from outside; merge `space-maths` into `main`. Gem Keep (already live) sends answers in the new format only after the gem-keep function and migration are deployed together, so deploy them together.

**Habits**
- Commit and push after each step with the attribution line the system gives you. Update the plan doc and the memory note.
- Local checks: local Supabase is on (`npx supabase status`), run `npx supabase functions serve --no-verify-jwt` and `npx vite --port 5173` from the repo, and make sure `.env.local` points at the local database. Browser checks use Playwright (`~/.npm/_npx/e41f203b7505f1fb`); recreate a script like the earlier `maths-space.mjs` if the old one is gone. Test answers must take at least 250 ms or the server drops them.
- Run `npm run typecheck`, `npx vitest run` and `npm run test:db`. One chess bot test is flaky and under load a few space tests time out; re-run alone before worrying.
- Don't use `pkill -f` or `pgrep -f` with a pattern that appears in your own command (it kills or matches your own shell).
