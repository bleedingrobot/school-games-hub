# Prompt: Mission Control maths, M.5 (teacher switch and finishing)

Paste this into a new chat to carry on.

---
You're carrying on a feature for James's School Games Hub (a website of games for his Year 4-6 class). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub, branch `space-maths` (pushed, NOT live). The live site is `main`.
- Read first: docs/SPACE-MATHS-PLAN.md (the approved plan; sections 10, 11 and 12 are what's been built) and the memory note school_games_hub.md (last paragraphs).
- Done on the branch: M.1 times-table records from each answer; M.2 game rules; M.3 maths in games against bots and pass-and-play; the after-turn question (replaced the Mission Boost: a question on a side card, right = +1 on your next roll; James tried it and likes it); M.4 games with classmates (server picks and marks every question, 20-second timer for wormhole/black hole questions, only good news shown).
- Private phone preview of the bot game: https://claude.ai/artifact/QLd7DZEh7DsJ2A18vXRqje (republish: `npm run space:preview`, then publish a tiny page plus the dist-preview/assets files to that same URL).
- Not live: students can't turn maths on yet. Today only a dev build with `?maths=choose` or `?maths=on` can (src/games/space/mathsMode.ts is the one place that gate lives, used by the bot game and the lobby).

## This step: M.5 (stop for James when done)

1. **Teacher switch** on the Teacher page: Off / Students choose / On for everyone, school-wide, like the emoji reactions switch (app_settings column + a teacher-only database function; new migration after 20261017001300). Replace the dev-only gate in mathsMode.ts with the real setting (students read it the way they read reactions_enabled). Default: Students choose (James approved).
2. **Server enforces the switch (important).** When it's Off, `space-game` (create) and `save-bot-game` (space start/save with maths on) must refuse maths. Today a hand-made request could ask for maths even when it's off. "On for everyone" should force maths on for the host's setup.
3. **Three achievements** (10 points each, like the other space ones): **Mission Control** (10 right answers in space games), **Wormhole booster** (power up a wormhole), **Great escape** (escape half a black hole with maths). They must work for bot games and classmates games, with no extra points for right answers otherwise. Follow how the existing space achievements and `scored_games.space` stats are built (migration 20261015000600_space_points and 0700).
4. **Pages:** the "How points work" page, the in-game "How to play" guide (src/games/space/Guide.tsx: explain the question after your turn, the wormhole and black hole questions, the 20 seconds with classmates), and one line in the privacy summary saying space games add to the times-table records. Docs: README, CLASS-LAUNCH and the plan doc.
5. **Accessibility check:** keyboard only, screen reader names, phone and Chromebook sizes (1366x640 is the real usable height). The side card, the question pop-up and the countdown are new. Axe is at ~/projects/maths-alignment-tool/node_modules/axe-core.
6. Update the plan doc and the memory note. Commit and push, with the attribution line the system gives you.

## Go live (only when James says yes)

Needs, in this order:
- Apply migrations 20261017001200, 20261017001300 and the M.5 one with `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f <file>` (none applied live yet).
- Deploy `save-bot-game`, `space-game` and `gem-keep` with `npx supabase functions deploy <name> --no-verify-jwt --use-api --project-ref zqzhetlzvtptnkmeiumi`. Deploy `gem-keep` and the 1200 migration together (Gem Keep already live only sends answers in the new format once both are in).
- Verify from outside (anon read of space_game_questions is refused, functions answer 401 JSON), then merge `space-maths` into `main` and push. Then check the Pages deploy. If James is in auto mode and the live commands get blocked, ask him to leave auto mode.
- Note the monsters branch (`monsters`, worktree ~/projects/school-games-hub-monsters) is built on top of space-maths, so merge space-maths first.

## Habits and gotchas

- Local Supabase is on (`npx supabase status`). Run `npx supabase functions serve --no-verify-jwt` and `npx vite --port 5173` from the repo; `.env.local` must point at the local database. After changing anything in a function's handler or shared code, run `npm run build:functions` (a test fails if index.ts is out of date).
- Tests: `npm run typecheck`, `npx vitest run`, `npm run test:db`. Known flaky under load: chess bot test, Gem Keep levels test, 101 save test, a few space tests. Re-run those alone before worrying.
- Real two-student run on the local copy: users via the Supabase admin API (email `e2e.<name>@douglaspark.school.nz`), password sign-in; delete the e2e users and test games afterwards or the profile tests count them. Answers faster than 250 ms are dropped by the server.
- Don't use `pkill -f` or `pgrep -f` with a pattern that appears in your own command (it kills your own shell).
- Never apply live changes or merge without James saying so.
