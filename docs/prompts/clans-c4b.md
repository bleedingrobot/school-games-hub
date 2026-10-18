# Prompt: Clan Quest, stage C.4 part B (the empire screens)

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans (`node_modules` there is a link to the main folder's). Never commit game work straight to `main`.
- **Read first:** docs/CLANS-RULES.md section 12 (the empire rules and numbers, now approved), docs/CLANS-PLAN.md ("Stage C.4, part A results" at the bottom, and "Stage C.3 results" for how the screens work), shared/README.md, and the memory note school_games_hub.md.
- **Already built:** the whole engine in `shared/clans/` (members, fights, market, training, Church) and **the empire engine `shared/clans/empire.ts`** (land, buildings, worker energy, troops, the draft, six kingdoms, `battle`, `raidKingdom`, `friendlyWar`, and the classmate-raid rule). `moments.ts` has every empire maths moment: `landPlot`, `barracksNeeded`, `troopBill`, `energyLeft`, `draftJoin`, `lootShare`. The screens so far are in `src/games/clans/` (creator, Mines, fight, Market, Training Hall, Church, clan page). `Moment.tsx` is the ask-then-show-working step; `places.ts` holds the plain functions the places use; `session.ts` is the in-browser clan; `PracticalAsk.tsx` is the question box. Test page: `preview/clans/`, `npm run clans:preview`, then `node scripts/inline-preview.mjs dist-preview-clans <out.html>` makes the single file. The existing private Artifact is https://claude.ai/artifact/G1EuzE7Q3MuhDF5xN3cTaP (update it, keep the link).
- Ground rules from before: a wrong maths answer **never blocks** (show the working, charge or give the right amount); questions are made and marked by code; every tuning number lives in `shared/clans/config.ts`; the screens are display only, no game rules in components (use the engine's functions and their `say` sentences for "why not"); no saving and no server in this stage (a refresh starts again).
- James's decisions on the empire (18 Oct 2026): the empire has its **own vault** (Put in / Take out from the clan purse); a new clan can't raid for 3 days either; the Gymnasium raises the draft limit; the empire is big (12 barracks, 24 extra plots to claim).
- The original game's code is GPL-2 and **none of it may be copied**; our names, text, numbers and pictures only. Kenney's 1-Bit Pack (CC0) for pictures: check its licence at the start and say what you found.

## Step 0: quick feedback (1 minute)

Ask James if there is anything he wants changed in the empire rules before the screens are built. If he has nothing, go on.

## Step 1: the screens

Same rules as part 2 of C.3: real web pages (React), touch, keyboard letters, screen readers, 1366 x 640 fit, no saving, no server. Add an `empire` to the in-browser clan in `session.ts` (use `empireOf(clan)`), and move the empire's day on when the test strip's "Skip a day" is used (`empireNewDay`).

1. **The Empire home:** vault, wild land, plots and buildings, troops (and room), today's worker energy left, the draft; buttons to Land, Barracks, Raid, Friendly War, and "Put in / Take out" gold between the clan purse and the vault. Add an Empire button to the clan page.
2. **Land:** pick a plot size (sides 2-6), maths moment (area, then the fence round it, `landPlot`), show the price (it comes from those two answers), develop it; claim more wild land when it runs out; build something on a plot with the energy maths ("can you afford all three today? how much is left?", `energyLeft`). Show why not, kindly, using the engine's `say`.
3. **Barracks and troops:** "how many barracks do you need?" (`barracksNeeded`, using `barracksFor`) and "what do these troops cost?" (`troopBill`) moments, buy troops, see the room left; the draft setting (0 to the top in fives) and "draft my followers" with its moment (`draftJoin`).
4. **Raid and Friendly War:** pick one of the six kingdoms (shown kindly: "an easy one", "tough"), make the battle plan with big buttons (rounds 1-5, Careful/Steady/Bold, loot 5/10/15/20%), the loot question (`lootShare`), see the result in plain gentle words (nobody bleeds; "the defenders give way", "your army falls back", "a stalemate"), what you won or lost (a Friendly War loses nothing; say so clearly). Show the round-by-round strength bars from `result.rounds`.
5. **Test settings strip:** "Give 500 gold" is already there; add (test only) "Give 100 followers", "Put 1,000 gold in the vault", "Build a barracks and fill it" and anything else James needs to try everything quickly.
6. **Quests are not part of this stage**; leave them for a later small stage and say so.
7. **Tests:** components render and the main flows work (right answer, wrong answer still charged or given correctly, not enough gold, not enough energy, no room in the barracks, a raid won, a raid lost, a stalemate, a Friendly War that changes nothing, keyboard only). Run the type check and the tests for `src/` and `shared/` before each commit (about four minutes; run in the background).
8. **Test page for James:** rebuild the single-file test page and **update the existing Artifact** so the link stays the same, with a short "what to try" list.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you.
- Extend the "Stage C.4" section of docs/CLANS-PLAN.md with part B (screens, what was checked, what's left); update shared/README.md and the memory note.
- **Stop for James at the end** with a plain-words summary and the test page link. Don't start C.5 (saving, the server and the daily reset) until he has played it.
- Nothing goes live in this stage: no migrations applied, no server functions deployed, no merge to `main`.
- If something is wrong or too big, say so plainly and suggest splitting it further (the Empire home plus Land is a good first half; Barracks, Raid and Friendly War the second).
