# Prompt: Clan Quest, stage C.4 part B, second half (Barracks, Raid, Friendly War)

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans (`node_modules` there is a link to the main folder's). Never commit game work straight to `main`.
- **Read first:** docs/CLANS-RULES.md section 12 (the empire rules and numbers, now approved), docs/CLANS-PLAN.md ("Stage C.4, part A results" at the bottom, and "Stage C.3 results" for how the screens work), shared/README.md, and the memory note school_games_hub.md.
- **First half is DONE (18 Oct 2026, commits 55b2283 + 9f53d58):** Empire home (`Empire.tsx`), Land and buildings (`Land.tsx`), the empire helpers in `places.ts` (`putInVault`, `developLand`, `buildOn`, `canBuildOn`, `whyNot`, test helpers `giveFollowers`, `giveVault`, `barracksAndFill`), a new clan starts with `newEmpire()`, Skip a day runs `empireNewDay`. Read the "Stage C.4, part B, first half" section at the bottom of docs/CLANS-PLAN.md. Test page (private Artifact, republish the same file path to update): https://claude.ai/artifact/HdLC12TafKW9ohqVnkAnAB (the old link was deleted). Scratchpad screenshot trick: click the creator's first button, then use the test strip.
- **Already built:** the whole engine in `shared/clans/` (members, fights, market, training, Church) and **the empire engine `shared/clans/empire.ts`** (land, buildings, worker energy, troops, the draft, six kingdoms, `battle`, `raidKingdom`, `friendlyWar`, and the classmate-raid rule). `moments.ts` has every empire maths moment: `landPlot`, `barracksNeeded`, `troopBill`, `energyLeft`, `draftJoin`, `lootShare`. The screens so far are in `src/games/clans/` (creator, Mines, fight, Market, Training Hall, Church, clan page). `Moment.tsx` is the ask-then-show-working step; `places.ts` holds the plain functions the places use; `session.ts` is the in-browser clan; `PracticalAsk.tsx` is the question box. Test page: `preview/clans/`, `npm run clans:preview`, then `node scripts/inline-preview.mjs dist-preview-clans <out.html>` makes the single file. The existing private Artifact is https://claude.ai/artifact/G1EuzE7Q3MuhDF5xN3cTaP (update it, keep the link).
- Ground rules from before: a wrong maths answer **never blocks** (show the working, charge or give the right amount); questions are made and marked by code; every tuning number lives in `shared/clans/config.ts`; the screens are display only, no game rules in components (use the engine's functions and their `say` sentences for "why not"); no saving and no server in this stage (a refresh starts again).
- James's decisions on the empire (18 Oct 2026): the empire has its **own vault** (Put in / Take out from the clan purse); a new clan can't raid for 3 days either; the Gymnasium raises the draft limit; the empire is big (12 barracks, 24 extra plots to claim).
- The original game's code is GPL-2 and **none of it may be copied**; our names, text, numbers and pictures only. Kenney's 1-Bit Pack (CC0) for pictures: check its licence at the start and say what you found.

## Step 0: quick feedback (1 minute)

Ask James how the first half played (Empire home, Land, buildings) and whether anything should change before you build on it. If he has nothing, go on.

## Step 1: the second half

Same rules as before: real web pages (React), touch, keyboard letters, screen readers, 1366 x 640 fit, no saving, no server.

1. **Barracks and troops:** an "Barracks and troops" button on the Empire home. "How many barracks do you need?" (`barracksNeeded`, using `barracksFor`) and "what do these troops cost?" (`troopBill`) moments, buy troops (footmen, axemen, knights) with the room left shown per kind and the engine's `say` when there's no room or gold; the draft setting (0 to the top in fives, `setDraft`, top raised by Gymnasiums) and "draft my followers" with its moment (`draftJoin`, then `draft`; say plainly that the followers are used up and the rest go home). Make the draft line on the Empire home use the same controls or link here.
2. **Raid and Friendly War:** pick one of the six kingdoms (shown kindly: "an easy one", "tough", with its blurb), make the battle plan with big buttons (rounds 1-5, Careful/Steady/Bold, loot 5/10/15/20%), the loot question (`lootShare`, the answer must equal what a win really takes), see the result in plain gentle words (nobody bleeds; "the defenders give way", "your army falls back", "a stalemate"), what you won or lost and the troops that did not come home. Show the round-by-round strength bars from `result.rounds`. A Friendly War loses and wins nothing: say so clearly, and it does not use up the one raid a day. Show "one raid a day, already used" kindly. Each fight gets its own seed (like `nextSeed` for the Mines).
3. **Test strip:** add "Win the next raid" and "Lose the next raid" (test only), for example by giving a huge army or an empty one, plus anything else James needs to try everything quickly.
4. **Tests:** components render and the main flows work: buy troops, no room in the barracks, not enough gold, right and wrong answer to each moment still charging or giving the right amount, the draft with followers and with no room, a raid won (loot lands in the vault and equals the loot answer), a raid lost, a stalemate, a Friendly War that changes nothing, the one-raid-a-day limit, and keyboard only. Run the type check and the tests for `src/` and `shared/` before each commit (about four minutes; run in the background).
5. **Test page for James:** rebuild the single-file test page and update the existing Artifact (same link as above) with a short "what to try" list.
6. **Quests are not part of this stage**; leave them for a later small stage and say so.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you.
- Extend the "Stage C.4, part B" section of docs/CLANS-PLAN.md with the second half and a wrap-up of the whole stage (screens, what was checked, what's left); update shared/README.md and the memory note.
- **Stop for James at the end** with a plain-words summary and the test page link. Don't start C.5 (saving, the server and the daily reset) until he has played it.
- Nothing goes live in this stage: no migrations applied, no server functions deployed, no merge to `main`.
- If something is wrong or too big, say so plainly and suggest splitting it further (Barracks and troops first, Raid and Friendly War after).
