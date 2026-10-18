# Prompt: Clan Quest, stage C.6 part A (the class village, the news page and classmate raids)

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans. Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (sections 8, 9, 10, 13, and the bottom sections "Stage C.5, part A: design / results" and "Stage C.5, part B: design / results"), shared/README.md, docs/CLANS-TEACHER-GUIDE.md, the memory notes school_games_hub.md and clans_c5_part_b.md, then `shared/clans/actions.ts`, `empire.ts` (`raidRefusal`, `raidClassmate`, `raidNews`), `supabase/functions/clans/handler.ts`, and the migrations `20261018001800_clans.sql` and `20261018001900_clans_fights.sql`.
- **Already built (all on `clans`, written and tested but NOT applied, NOT deployed, NOT merged):** saving, the `clans` server function with every action including mine fights (the server replays each fight and pays once), the midnight database job (`clan_nightly`: rests clans nobody opened, writes news from a name-free fight log), the teacher's on/off switch, the teacher panel with each pupil's clan and a reset button, the hub card, and the whole game in the browser. Classmate raids exist only as a tested rule (`raidRefusal`, `raidClassmate`); there is no action and no screen. News is just a few "fights won" lines on the clan page. There are no points, achievements or scoreboard yet. The maths topics are the defaults (Year 5).
- **Ground rules:** a wrong maths answer never blocks; questions are made and marked by code, never an AI; every tuning number lives in `shared/clans/config.ts`; screens are display only; the server is the boss (the browser is never believed about gold, land, troops or who may raid whom). No student text anywhere: news is computer-written and never names a student (clan names come from word lists; the teacher can see real names). The original game's code is GPL-2: none of it may be copied.
- **Test page Artifact** (private, keep the link, read the live version first and don't print it; it is ~400 KB): https://claude.ai/artifact/HdLC12TafKW9ohqVnkAnAB. Keep the "What to try" box at the top (added by hand to the built file; rebuild with `npm run clans:preview` then `node scripts/inline-preview.mjs dist-preview-clans <out.html>`).
- **James's answers that matter here:** one village per class group, the teacher sets the groups; classmate raids stay in (steal land and gold; guard rails: 3 days' protection for a new clan, 1 raid a day, at most 10% loot, a 1-day shield after being raided, similar army sizes only); a teacher one-click switch for classmate raids; a new season keeps clans and resets fame.

## Step 0: quick feedback (1 minute)

Ask James whether the part B summary was clear and whether anything should change first. Ask whether he has applied and deployed the saving part yet (nothing is live until he says so, in words, for each step: apply the migrations, deploy the function, merge to main, switch the game on). If he has, ask what he saw when he tried it as a teacher, and fix that first.

## Step 1: Part A of the class village

C.6 is split in two. **This part:** the village, the news page and classmate raids. **Next part (C.6 part B):** points, achievements, the scoreboard, fame and the teacher page for maths topics and settings.

Write a design note first (add "Stage C.6, part A: design" to docs/CLANS-PLAN.md), then build:

1. **Village groups.** A teacher sets class groups (which pupils share a village). Decide where they are kept (a new table) and how a pupil with no group is handled (their own village of one, or a default group). Teacher page: make groups, move pupils.
2. **The village chest.** Every pupil in a group can put gold in from their clan purse; nobody can take it out or force anyone. Show a progress bar and the class goal ("Church level 2: 380 / 500 gold") as a gentle class-wide maths moment (progress, fractions of a goal, made and marked by code).
3. **Weekly votes and buildings.** Each week the class sees up to three buildings to choose from (Church, Training Hall, Smithy, and so on, each in levels). One vote each, from a button list, no typing. At the end of the week the winner is built if the chest has enough gold. The effects (cheaper training, more healing, a better shop) already exist as `clan.village` levels; the server must now set them from the group's village, not from the pupil's own clan. Finish the vote in the midnight job (`clan_nightly`) so it happens once, and write the news line.
4. **The news page.** A "Village news" screen with computer-written lines: fights won, bosses beaten, buildings built, raids ("A raider from the Red Banner clan took 40 gold"), using clan names only. Keep it to a few days. Check with a test that no line can contain a student's name or id.
5. **Classmate raids.** Server action and screen: pick a classmate's clan from a fair list (the rule says who is allowed: protection, shield, army size ratio, once a day), choose a plan, the server resolves it with the existing `raidClassmate` (the defender's saved empire fights as a copy played by the computer), moves gold and land between the two clans in one save so nothing is made or lost, and writes the news line. The defender sees what happened next time they open the game. Add the teacher's one-click switch for classmate raids (default off) and make the server refuse raids while it is off. Raiding is stage-gated by C.5's rules: no raids during an open fight.
6. **Tests.** Every guard rail refused by the server; gold and land only moving between the two clans; a raid sent twice paying once; two raiders at once on the same defender (the version check must make one redo); the vote counted once per pupil; the chest never negative; the midnight job closing a vote once; news with no names. Run the database rules in a transaction that is rolled back (do NOT `supabase db reset`: other sessions share the local database). Run the type check and tests before each commit (about four minutes, in the background; a few fight, gem-keep and 101 tests can time out under load and pass alone).
7. **Test page for James:** rebuild the single file and update the Artifact. The page has no server, so give it test buttons (a pretend village with a chest, a vote and a pretend classmate to raid) so he can see the screens.

## How to work

Small commits on the `clans` branch, with the attribution line the system gives you. Extend docs/CLANS-PLAN.md with a "Stage C.6, part A results" section; update shared/README.md, the teacher guide and the memory note.

Stop for James at the end with a plain-words summary: what works, what he can try, and what is still waiting for his go-ahead.

**Nothing goes live:** do not apply migrations, deploy functions or merge to `main` until James says so, in words, for each one.
