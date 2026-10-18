# Prompt: Clan Quest, stage C.7 (How to play, accessibility pass, slow-Chromebook check, docs)

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans. Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (sections 11 and 12, then "Stage C.6, part B: design" and "Stage C.6, part B results"), shared/README.md, docs/CLANS-TEACHER-GUIDE.md, the memory note school_games_hub.md, then `src/games/clans/ClanQuest.tsx`, `clans.css`, `Fight.tsx`, `Scoreboard.tsx`, `Achievements.tsx` and how Dragon Maths and Maths Monsters did their "How to play" pages and accessibility checks.
- **Already built (all on `clans`, written and tested but NOT applied, NOT deployed, NOT merged):** saving, the `clans` server function with every action, mine fights, the class village, classmate raids, fame, the scoreboard, points, eight achievements, the teacher's maths settings, fame season and private maths records, and the whole game in the browser. Four migrations (`20261018001800` to `20261018002100`); Dragon Maths' `001600` and `001700` must be applied before them.
- **Ground rules:** a wrong maths answer never blocks; questions are made and marked by code, never an AI; every tuning number lives in `shared/clans/config.ts`; screens are display only; the server is the boss. No student text anywhere. Scoreboards never show maths scores. The original game's code is GPL-2: none of it may be copied.
- **Test page Artifact** (private): https://claude.ai/artifact/G1EuzE7Q3MuhDF5xN3cTaP. It is ~425 KB, so read it with the saved-file route and grep the file; never print it. Rebuild with `npm run clans:preview` then `node scripts/inline-preview.mjs dist-preview-clans <out.html>`, then put a "What to try" box before `<div id="root">` and publish to the same link. The server function is rebuilt with `node scripts/build-clans.mjs` (not `npm run build:functions`, which also rewrites a stale monster function that must be left alone).
- **Running the database checks:** the shared local database only has migrations up to `20261018001500`. Never `supabase db reset` (other sessions share it). Pipe `begin;`, then migrations `001600` to `002100`, then one pgTAP file into `docker exec -i supabase_db_school-games-hub psql -U postgres`, and the test file's own `rollback`.
- **James's answers that matter here:** the village reward goes to voters only (decided 18 Oct 2026); a new season keeps clans and resets fame; Clan Quest is `ranked: false`; nothing goes live until he says so in words.

## Step 0: quick feedback (1 minute)

Ask James whether he tried the test page and whether anything should change first (fame, the scoreboard, achievements and the celebration are the new parts). Ask whether he has applied or deployed anything (nothing is live until he says so for each step: apply the migrations, deploy the function, merge to main, switch the game on, make groups, switch raids on). If he has tried it live, ask what he saw and fix that first.

## Step 1: C.7

Write a short design note first (add "Stage C.7: design" to docs/CLANS-PLAN.md), then build:

1. **How to play.** A short, friendly "How to play" screen reachable from the clan page (and a link on the first screen of the creator), in words a 9-year-old reads easily: your clan, the Mines, Battle Cry, the shop, training, Church, empire, quests, the village, raids (and that the teacher can switch them off), fame and the scoreboard, achievements. Short sections, no walls of text. The numbers on it must come from `CONFIG`, never be typed in twice.
2. **Accessibility pass.** Keyboard only from start to finish (every screen, the fight, the question box, the scoreboard table, the celebration), visible focus, screen-reader names and live regions, colour contrast on the dark BBS look (check text and the yellow/cyan on dark), no information by colour alone, animations off for `prefers-reduced-motion`, touch targets at least 44px, and zoom to 200% without losing anything. Fix what you find, with tests where they can be tested.
3. **Slow-Chromebook check.** Fit and speed at 1366 x 640: nothing needs sideways scrolling, the fight screen fits without scrolling the page more than a little, the first load is quick (the game is lazy-loaded; check the size of what loads), and fights stay smooth with CPU slowed in the browser. Report real numbers. Reduce anything heavy.
4. **Docs.** Bring docs/CLANS-PLAN.md, shared/README.md and docs/CLANS-TEACHER-GUIDE.md up to date; write a one-page "go live" checklist (docs/prompts/clans-golive.md, like docs/prompts/lord-golive.md) with each step, the exact commands, and how to check each one worked; update the memory note.
5. **Tests.** Everything above that can be tested; run the type check and the whole suite before each commit (about four minutes, in the background; a few fight, gem-keep and 101 tests can time out under load and pass alone).
6. **Test page for James:** rebuild and update the Artifact so he can read How to play and see the changes.

## How to work

Small commits on the `clans` branch, with the attribution line the system gives you. Add a "Stage C.7 results" section to docs/CLANS-PLAN.md.

Stop for James at the end with a plain-words summary: what works, what he can try, and what is still waiting for his go-ahead. After this, the next thing is the go-live, one step at a time.

**Nothing goes live:** do not apply migrations, deploy functions or merge to `main` until James says so, in words, for each one.
