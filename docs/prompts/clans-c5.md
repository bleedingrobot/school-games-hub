# Prompt: Clan Quest, stage C.5 part A (saving and the server)

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans (`node_modules` there is a link to the main folder's). Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (section 10 "Saving, fairness and the teacher", section 12 stages, and the results sections at the bottom, especially "Stage C.4, part C"), docs/CLANS-RULES.md, shared/README.md, and the memory note school_games_hub.md. Then read how the other games save: the `gem-keep`, `space-game` and `save-bot-game` server functions in supabase/functions, the `_shared` folder, and the Gem Keep migration (supabase/migrations/20261017001100_gem_keep.sql), so Clan Quest follows the same habits (who may write, how answers are rebuilt and checked, how points are capped).
- **Already built (all on `clans`, nothing saved, nothing live):** the whole engine in `shared/clans/` (members, fights, market, training, Church, the empire, battles, quests) and every screen in `src/games/clans/` (creator, Mines, fight, Market, Training Hall, Church, clan page, Empire home, Land, Barracks and troops, Raid and Friendly War, Quest). `session.ts` is the in-browser clan, `places.ts` the plain functions the screens call, `Moment.tsx` the ask-then-show-working step. Test page: `preview/clans/`, `npm run clans:preview`, then `node scripts/inline-preview.mjs dist-preview-clans <out.html>`. Private Artifact to update (same file path, keep the link, and read the live version first): https://claude.ai/artifact/HdLC12TafKW9ohqVnkAnAB. The test page has a "What to try" box at the top (added by hand to the built file); keep one.
- Ground rules from before: a wrong maths answer **never blocks**; questions are made and marked by code, never by an AI; every tuning number lives in `shared/clans/config.ts`; screens are display only, no game rules in components.
- The original game's code is GPL-2 and **none of it may be copied**; our names, text, numbers and pictures only.
- Things to remember from Quests: the quest day is `session.day` (the browser's counter) and `clan.questDay` holds the day of the last quest, so the real daily reset must set the day properly. Puzzle numbers come from the clan's seed, the day, the quest and the choice (`puzzleFor`), so the server can rebuild and mark them.

## Step 0: quick feedback (1 minute)

Ask James how the Quests played and whether anything should change first (the ten stories, the charm choices, the prizes, the puzzles). If he has nothing, go on.

## Step 1: Plan before building (this stage is big, so split it)

C.5 in the plan is "migration, `clans` function, replay checks, daily reset job". That is too much for one go. Propose this split to James in plain words and start with part A once he agrees:

- **C.5 part A (this prompt): saving and the server, without fights.** Tables and a `clans` server function so a clan is kept between visits, and every non-fight action is done by the server.
- **C.5 part B (next prompt): fights, the daily reset and the class trial.** Starting a mine fight, the server replaying it from its seed and the recorded choices before it pays out, a half-finished fight kept on the server, the midnight NZ reset job (turns, computer clans' day, news), and everything needed for a first class trial.

## Step 2: Part A, saving and the server

1. **Design note first** (add to docs/CLANS-PLAN.md as "Stage C.5, part A: design"), short, covering: the tables (`clans`, `clan_members`, `clan_empires` and whatever else is truly needed now; leave votes, news and the village chest for C.6), which columns the server owns (gold, followers, levels, HP, land, troops, the quest day, the day number), how students are kept from writing to them directly, how a new clan is created (the creator's rolls must be repeatable from a seed so the server can check them), and what happens to a clan if the teacher resets it. Keep to the numbers in section 10 of the plan (about 30 requests per student a day).
2. **Migration** (write it, do **not** apply it): the tables and their access rules, written like the Gem Keep migration. Test it the way the other migrations are tested.
3. **Server function `clans`** (write it, do **not** deploy it), one request per action, each one running the same `shared/clans` code the browser uses: create the clan, load it, shop, train, wake at the Church, empire actions (develop, build, buy troops, draft, vault), raids and Friendly War (a seed given by the server, the result checked), and a quest (the server picks today's quest and puzzle numbers, marks the answer by rebuilding the question, and pays the prize). A wrong maths answer still never blocks. Doing the same request twice must not pay twice. It must refuse anything the rules refuse (not enough gold, one quest a day, one raid a day, the new-clan and fairness rules) even if the browser is changed.
4. **Browser side:** the screens keep working in the test page with no server (the in-browser `session`), and a thin layer that sends the same actions to the server when it is available. Do not break the test page.
5. **Tests:** every action refused when it should be, paid exactly once, replayed identically from its seed; a student cannot write to the tables; the migration's rules; the existing clan tests still pass. Run the type check and the tests for `src/`, `shared/` and the server functions before each commit (about four minutes; run in the background).
6. **Test page for James:** rebuild the single file and update the existing Artifact (it still plays in the browser only) with a short "what to try" list. Say plainly that the server part cannot be tried by James yet because it is not applied or deployed.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you.
- Extend docs/CLANS-PLAN.md with a "Stage C.5, part A" results section (what was built, what was checked, what's left); update shared/README.md and the memory note.
- **Stop for James at the end** with a plain-words summary. Don't start part B (fights on the server, the daily reset, the class trial) until he has read it and said go.
- **Nothing goes live:** do not apply migrations, deploy server functions, or merge to `main`. Applying and deploying wait for James to say so, in words, for each one.
- If something is wrong or too big, say so plainly and suggest splitting it further (for example tables and the load/create requests first, the other actions after).
