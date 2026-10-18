# Prompt: Clan Quest, stage C.4 (the empire), with James's feedback on part 2 first

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans (`node_modules` there is a link to the main folder's). Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (the approved plan: sections 6, 8, 12 and 13, and "Stage C.3 results" at the bottom, which says what exists and the choices made), docs/CLANS-RULES.md (the empire numbers are still marked "To set in C.1": land cost is unset), shared/README.md, and the memory note school_games_hub.md.
- **Already built (C.0 to C.3):** the engine in `shared/clans/` (members, fights, market, training, Church; **no empire yet**), the maths moments in `shared/clans/moments.ts` (**the empire ones already exist**: `landPlot` (area and fence), `barracksNeeded`, `troopBill`, `energyLeft`, `draftJoin`, `fameChange`, `troopRatio`), and the screens in `src/games/clans/` (creator, Mines, fight, Market, Training Hall, Church, clan page). `Moment.tsx` is the ask-then-show-working step; `places.ts` holds the plain functions the places use; `session.ts` is the in-browser clan; `PracticalAsk.tsx` is the question box. Test page: `preview/clans/`, `npm run clans:preview`, then `node scripts/inline-preview.mjs dist-preview-clans <out.html>` makes the single file. The existing private Artifact is https://claude.ai/artifact/G1EuzE7Q3MuhDF5xN3cTaP (update it, keep the link).
- Ground rules from before: a wrong maths answer **never blocks** (show the working, charge or give the right amount); questions are made and marked by code; every tuning number lives in `shared/clans/config.ts`; the screens are display only, no game rules in components; no saving and no server in this stage (a refresh starts again).
- The original game's code is GPL-2 and **none of it may be copied**; our names, text, numbers and pictures only. Kenney's 1-Bit Pack (CC0) for pictures: check its licence at the start and say what you found.

## Step 0: James's feedback on part 2 (ask first, 2 minutes)

James has the test page with the Market, Training Hall, Church and clan page. Ask how they felt: too slow or fiddly anywhere, confusing, anything to change in the look or the wording. Fix those first (small, with tests). If he hasn't played it yet, say so and carry on.

## Step 1: the empire, in two halves (this is a big stage, so split it)

The empire engine does not exist yet, so this stage has to make it before it can draw it. Do **4A** and stop for James; do **4B** only after he says go.

### 4A: rules, engine and numbers (no screens)

Follow plan section 8 and the empire rows in the rules sheet. Write the rule changes into docs/CLANS-RULES.md first, then build `shared/clans/empire.ts` (plain data, seeded, replayable, like `fight.ts`):

1. **Land and buildings:** develop plots with gold; build Barracks, Walls, Towers, Steel Mill, Stables, Gymnasium and Developer's Hall from the daily **worker energy** budget (100% a day, split between buildings). Set the land price and each building's size, energy cost and effect. Drop Spy/Security buildings and shops (plan section 8). Keep every number small enough for a 9-year-old to work with.
2. **Troops:** footmen, axemen and knights bought with gold (15 / 30 / 60); barracks cap how many you keep (20 / 10 / 5 each).
3. **Followers and the draft:** followers from fights join as troops at a draft percentage (0-20%).
4. **Six computer kingdoms** of different strength, and a **battle plan** (rounds, how hard, how much loot) that the engine settles in one go from both armies and a seed. Walls and towers help defence and decide how much a raider can destroy.
5. **Friendly War:** a no-loss practice fight against a computer kingdom (plan section 8).
6. **Classmate raids: write the pure rule only** (steal land or gold or destroy buildings; 10% loot limit; 1-day shield after being raided; similar army size only; 3 days of new-clan protection; 1 raid a day; names hidden). Do not build any screen or server for them, since they need saving (stage C.5). The defender is a saved copy played by the computer, so make the engine take two armies and a seed.
7. **Maths hooks:** use the existing `moments.ts` functions where the numbers come from the real state (check each question's answer equals what the engine really does, as the other moments' tests do). Add any missing moments (for example the loot share, "1 in 5" spy luck is **out** unless you add spies).
8. **Tests and the simulator:** tests for every rule, and a simulator run (`npm run clans:sim` style) showing a clan can afford a sensible empire in a few weeks of fights without running out of gold, and that computer kingdoms are beatable at the right level. Say plainly what you tuned and why.
9. **Stop for James.** Give a plain-words summary of the empire rules and numbers (a short table he can read), then wait for his OK or changes before 4B.

### 4B: screens (only after James approves 4A)

Same rules as part 2: real web pages (React), touch, keyboard letters, screen readers, 1366 x 640 fit, no saving, no server.

1. **The Empire home:** land, buildings, troops, today's energy left, gold; links to Land, Barracks, Raid, Friendly War. Add it as a button on the clan page.
2. **Land:** pick a plot size, maths moment (area, then the fence round it), develop it, build something on it with the energy maths ("can you afford all three today? how much is left?").
3. **Barracks and troops:** "how many barracks do you need?" and "what do these troops cost?" moments, buy troops, see the cap.
4. **Raid and Friendly War:** pick one of the six computer kingdoms (strength shown kindly: "an easy one", "tough"), make the battle plan with big buttons, see the result in plain gentle words (nobody bleeds; "the defenders retreat"), what you won or lost (a Friendly War loses nothing).
5. **Test settings strip:** add "Give 500 gold" is already there; add test-only buttons such as "Give 100 followers" and "Fill the barracks" so James can try everything quickly.
6. **Quests are not part of this stage**; leave them for a later small stage and say so.
7. **Tests:** components render and the main flows work (right answer, wrong answer still charged or given correctly, not enough gold or energy, a raid won, a raid lost, a Friendly War, keyboard only). Run the type check and the tests for `src/` and `shared/` before each commit (about four minutes; run in the background).
8. **Test page for James:** rebuild the single-file test page and **update the existing Artifact** so the link stays the same, with a short "what to try" list.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you.
- Add a "Stage C.4 results" section to docs/CLANS-PLAN.md after 4A (rules and numbers, tests, simulator findings) and extend it after 4B (screens, what was checked, what's left); update shared/README.md and the memory note.
- **Stop for James after 4A, and again after 4B** with a plain-words summary (and the test page link after 4B). Don't start C.5 (saving, the server and the daily reset) until he has played it.
- Nothing goes live in this stage: no migrations applied, no server functions deployed, no merge to `main`.
- If something is wrong or too big, say so plainly and suggest splitting it further.
