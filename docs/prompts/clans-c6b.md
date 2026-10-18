# Prompt: Clan Quest, stage C.6 part B (points, achievements, scoreboard and fame, the maths topics page)

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans. Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (sections 6, 10, 13, and the bottom sections "Stage C.5, part B results" and "Stage C.6, part A: design / results"), shared/README.md, docs/CLANS-TEACHER-GUIDE.md, the memory notes school_games_hub.md, clans_c5_part_b.md and clans_c6_part_a.md, then `shared/clans/actions.ts`, `village.ts`, `supabase/functions/clans/handler.ts`, the three migrations `20261018001800_clans.sql`, `20261018001900_clans_fights.sql`, `20261018002000_clans_village.sql`, and how the other games give points, achievements and leaderboards (the shared points cap of 40 a day, `points_total`, `leaderboard`, the achievement tables, and how Dragon Maths / Gem Keep / Maths Monsters did it). Also `src/pages/TeacherClans.tsx` and how Gem Keep's teacher page does its maths topics and year bands.
- **Already built (all on `clans`, written and tested but NOT applied, NOT deployed, NOT merged):** saving, the `clans` server function with every action (mine fights, village chest, weekly vote, classmate raids), the midnight database job, the teacher's on/off switch and raids switch, village groups, the teacher panel, the hub card, and the whole game in the browser. Clan Quest gives **no points, achievements or scoreboard yet**, and the maths topics are the Year 5 defaults (`DEFAULT_PRACTICAL_SETTINGS`). Maths answers are not stored yet.
- **Ground rules:** a wrong maths answer never blocks; questions are made and marked by code, never an AI; every tuning number lives in `shared/clans/config.ts`; screens are display only; the server is the boss (the browser is never believed about gold, points, fame or who may do what). No student text anywhere: news is computer-written and never names a student (clan names come from word lists; the teacher can see real names). Scoreboards never show maths scores. The original game's code is GPL-2: none of it may be copied.
- **Test page Artifact** (private, keep the link, read the live version first but do NOT print it: it is ~400 KB, so read it with the saved-file route and grep the file): https://claude.ai/artifact/HdLC12TafKW9ohqVnkAnAB. Keep the "What to try" box at the top (added by hand to the built file; rebuild with `npm run clans:preview` then `node scripts/inline-preview.mjs dist-preview-clans <out.html>`, then insert the box before `<div id="root">`).
- **James's answers that matter here:** a new season keeps clans and resets fame; the scoreboard is top 10 clans and you, by fame, like the other games (never maths scores); points sit inside the shared 40-a-day cap; Clan Quest is `ranked: false`.

## Step 0: quick feedback (1 minute)

Ask James whether the part A summary was clear and whether anything should change first. Ask whether he has applied and deployed anything yet (nothing is live until he says so, in words, for each step: apply the migrations, deploy the function, merge to main, switch the game on, make groups, switch raids on). If he has tried it, ask what he saw and fix that first. Also ask whether the village building costs felt right if he tried them.

## Step 1: Part B

Write a design note first (add "Stage C.6, part B: design" to docs/CLANS-PLAN.md), then build:

1. **Fame and the scoreboard.** Decide what fame is (my pick from the plan: earned from mine wins, bosses, village buildings and raids won, never from maths scores), where it is kept, and how a new season resets it while keeping clans. A "Scoreboard" screen: top 10 clans and your own, by fame, clan names only (never a student's name). Optionally limited to the pupil's village or the whole school; decide and say why.
2. **Points.** Inside the shared 40-a-day cap, the way the other games do it, and awarded only by the server. My pick from the plan: 1 point per 3 mine wins, 3 for a boss, 2 for a friendly war, 5 when the class completes a village building (check this against the other games' scale before building). Each award must happen once, even if a request is sent twice.
3. **Achievements** (about 8): first win, first boss, level 10, level 20, 5 buildings, first friendly war win, a village building, 50 Battle Cry answers. Use the shared achievement tables if they fit. Awarded by the server, shown on the clan page with a small celebration.
4. **Storing maths answers** the way Gem Keep does, for the teacher's "practising" view and the hardest facts. Keep it small and private (teacher only). Wrong answers are stored too and never block.
5. **The Teacher page for maths topics and settings.** Maths topics and year bands on/off (shared with the other games where sensible), mine fights per day, Practice Mode if the other games have it, and "start a new season" (resets fame, keeps clans). The server must read these settings (replace `DEFAULT_PRACTICAL_SETTINGS` in the handler) and send them with the clan, so the browser and the server always agree; a change must not alter a fight that is already open (the settings are already kept with each open fight).
6. **Tests.** Points and achievements each awarded once, even when a request is sent twice or two arrive at once; the daily cap respected; fame never negative and reset by a new season; the scoreboard showing only clan names and fame (a test that no student name or id can appear); the server using the teacher's settings; a changed setting not altering an open fight. Run the database rules in a transaction that is rolled back (do NOT `supabase db reset`: other sessions share the local database; recipe: pipe `begin;` plus the clan migrations plus the pgTAP file into `docker exec -i supabase_db_school-games-hub psql -U postgres`). If you add database functions, keep `supabase/tests/database/security.test.sql`'s function list in step. Run the type check and tests before each commit (about four minutes, in the background; a few fight, gem-keep and 101 tests can time out under load and pass alone).
7. **Test page for James:** rebuild the single file and update the Artifact. The page has no server, so give it test buttons (pretend fame and a pretend scoreboard of other clans, an award button, a new-season button) so he can see the screens.

## How to work

Small commits on the `clans` branch, with the attribution line the system gives you. Extend docs/CLANS-PLAN.md with a "Stage C.6, part B results" section; update shared/README.md, the teacher guide (remove "What is not in yet" items that are now in) and the memory note.

Stop for James at the end with a plain-words summary: what works, what he can try, and what is still waiting for his go-ahead. After this, the remaining stage is C.7 (How to play, accessibility pass, slow-Chromebook check, docs).

**Nothing goes live:** do not apply migrations, deploy functions or merge to `main` until James says so, in words, for each one.
