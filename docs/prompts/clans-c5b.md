# Prompt: Clan Quest, stage C.5 part B (fights, the daily reset and the class trial)

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans. Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (section 10, and the two sections at the bottom: "Stage C.5, part A: design" and "Stage C.5, part A results"), shared/README.md, the memory note school_games_hub.md, then `shared/clans/actions.ts`, `play.ts`, `supabase/functions/clans/handler.ts`, the migration `supabase/migrations/20261018001800_clans.sql` and `shared/clans/fight.ts` / `battleCry.ts` (`replayFight`).
- **Already built (all on `clans`, written and tested but NOT applied, NOT deployed, NOT merged):** the saving tables and the `clans` server function for every action except fights, a browser layer (`src/games/clans/remote.ts`, the `server` prop on `ClanQuest`), and the whole game in the browser. The Mines are locked when there is a server, with the note "Mine fights are not saved on the server yet".
- Ground rules: a wrong maths answer **never blocks**; questions are made and marked by code, never an AI; every tuning number lives in `shared/clans/config.ts`; screens are display only. Original game's code is GPL-2: **none of it may be copied**.
- The test page Artifact (private, keep the link, read the live version first and don't print it; it is ~400 KB): https://claude.ai/artifact/HdLC12TafKW9ohqVnkAnAB. It needs a "What to try" box at the top (added by hand to the built file).

## Step 0: quick feedback (1 minute)

Ask James whether he has read the part A summary and whether anything should change first. Remind him that the saving part cannot be tried by him until it is applied and deployed, and ask whether he wants to do that now, or after part B.

## Step 1: Part B

1. **Design note first** (add "Stage C.5, part B: design" to docs/CLANS-PLAN.md): starting a mine fight (the server takes one off today's count, picks the monsters from the clan's seed and fight number, sends them), the browser playing it, then sending the recorded orders and Battle Cry answers; the server replaying with `replayFight`, marking each answer by rebuilding the question, and only then paying out (gold, followers, experience, knocked-out members). A half-finished fight kept on the server (a refresh must not lose it or give a free retry). The same fight sent twice must not pay twice (use the part A request ids). Decide where fights are kept (a new column or table) and say so.
2. **Daily reset job** (a scheduled database job at midnight New Zealand time, like the other tidy jobs): reset fights and turns for clans nobody touched, run the computer clans' day, write the news lines. Part A already gives a clan its night's rest when it is next opened, so the job must agree with that and never rest a clan twice. News stays computer-written only (no student text).
3. **Class trial:** everything a first trial needs and nothing more: a way to switch Clan Quest on for the class, the teacher's reset button for a clan (`teacher_reset_clan` already exists), and a short teacher guide. Classmate raids, the village chest, votes and points are stage C.6, not here.
4. **Browser:** unlock the Mines when there is a server; the fight screen sends its recording at the end (the test page keeps playing in the browser with no server).
5. **Tests:** a fight that is replayed identically from its seed, a changed recording refused, a fight paid exactly once, a refresh in the middle of a fight, the reset job, the migration's rules (run them in a rolled-back transaction: do **not** `supabase db reset`, other sessions use the shared local database). Run type check and the tests before each commit (about four minutes, in the background; a few fight and gem-keep tests can time out under load and pass alone).
6. **Test page for James:** rebuild the single file and update the Artifact.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you. Extend docs/CLANS-PLAN.md with a "Stage C.5, part B" results section; update shared/README.md and the memory note.
- **Stop for James at the end** with a plain-words summary.
- **Nothing goes live:** do not apply migrations, deploy functions or merge to `main` until James says so, in words, for each one.
