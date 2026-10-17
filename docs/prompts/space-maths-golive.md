# Prompt: Mission Control maths, go live

Paste this into a new chat to carry on.

---
You're carrying on a feature for James's School Games Hub (a website of games for his Year 4-6 class). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub, branch `space-maths` (pushed, NOT live, last commit 0b6eed2 "M.5"). The live site is `main`.
- Read first: docs/SPACE-MATHS-PLAN.md (sections 10-13) and the memory note school_games_hub.md (last paragraphs).
- All five build stages are done (M.1 records, M.2 rules, M.3 bot games, M.4 classmates games, M.5 teacher switch, achievements, guides, accessibility check). Tests passed (only known-flaky ones failed, and pass alone).
- The `monsters` branch (worktree ~/projects/school-games-hub-monsters) is built on top of `space-maths`. Merge `space-maths` first and don't touch monsters.

## This step: go live (ONLY when James says yes; ask first if he hasn't)

Before asking, tell him in plain words what changes for students: nothing at first. The Teacher page gets a new "Mission Control maths" switch that starts on "Students choose", so students will see a maths On/Off chip when they set up a space game.

Do, in this order, stopping if anything fails:
1. Apply the migrations that aren't live yet: `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/<file>` for 20261017001200_fact_answers.sql, 20261017001300_space_maths_live.sql and 20261017001400_space_maths_switch.sql, in that order. Check each first with a read-only query that it isn't applied.
2. Deploy `save-bot-game`, `space-game` and `gem-keep`: `npx supabase functions deploy <name> --no-verify-jwt --use-api --project-ref zqzhetlzvtptnkmeiumi`. Gem Keep goes out together with the 1200 migration (live Gem Keep only sends answers in the new format once both are in).
3. Verify from outside: an anon read of `space_game_questions` is refused; each function answers 401 JSON with no sign-in; `app_settings.space_maths` reads as `choose`.
4. Merge `space-maths` into `main` and push. Then check the GitHub Pages deploy finished and the live Teacher page shows the new switch.
5. Tell James what to check first: the Teacher page switch, then a short space game against a bot with maths on (the question after each turn, a wormhole question), then that the Gem Keep records grew.
6. Update the plan doc and the memory note (live date, commit).

If live commands get blocked in auto mode, ask James to leave auto mode. Never apply live changes or merge without him saying so.

## After go-live (offer, don't start)

- Watch for a week: any "maths switched off" refusals in the function logs, the Gem Keep grid filling from space games.
- Possible follow-ups: a classmates-screen browser check (not done in M.5), and anything James finds in class.

## Habits and gotchas

- Local Supabase is on (`npx supabase status`). After changing a function's handler or shared code, run `npm run build:functions` (a test fails if index.ts is out of date).
- Tests: `npm run typecheck`, `npx vitest run` (about 3 minutes; run it in the background), `npm run test:db`. Known flaky: chess bot test, 101 save stat test, an occasional save-bot-game seed test. Re-run those alone before worrying.
- Don't use `pkill -f`/`pgrep -f`/`pkill -x node` (it can hit other processes). Stop servers by port with `fuser -k <port>/tcp`.
