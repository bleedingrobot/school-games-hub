# Prompt: Clan Quest, stage C.3 part 2 (Market, Training Hall, Church, clan page), with James's feedback on part 1 first

Paste this into a new chat to start the next part.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans (`node_modules` there is a link to the main folder's). Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (the approved plan; "Stage C.3, part 1 results" at the bottom says what exists and the choices made), docs/CLANS-RULES.md, shared/README.md, and the memory note school_games_hub.md.
- **Already built (part 1):** `src/games/clans/` (`ClanQuest.tsx` is the shell with screens home / mines / fight / results; `session.ts` holds the clan state and pure helpers; `Fight.tsx`, `Creator.tsx`, `Mines.tsx`, `MemberCard.tsx`, `Sprite.tsx`, `tileMap.ts`, `text.ts`, `words.ts`, `clans.css`), `src/maths/PracticalAsk.tsx` (question card with minus key and tap-to-answer, plus `Working` for the worked answer), and the test page (`preview/clans/`, `npm run clans:preview`, then `node scripts/inline-preview.mjs dist-preview-clans <out.html>` makes the single file for the Artifact).
- **The engine and maths moments (already built):** `shared/clans/character.ts` (`buy`, `shopPrice`, `examineCost`, `inShop`, `trainStat`/`trainHp`/`trainSp`, `trainCost`, `wake`, `wakeCost`, `churchCost`) and `shared/clans/moments.ts` (`marketTotal`, `examineCostQuestion`, `marketChange`, `betterBuy`, `itemPoints`, `trainingBuy`, `churchBill`; each returns `null` if the teacher has that topic off). Don't change rules or numbers unless a screen shows something is broken; if so, say so plainly.
- The original game's code is GPL-2 and **none of it may be copied**; our names, text, numbers and pictures only. Kenney's 1-Bit Pack (CC0) for items: check its licence again at the start and say what you found (the picture sheet is `src/games/clans/tiles.png`).

## Step 0: James's feedback on part 1 (ask first, 2 minutes)

James has a private test page for part 1. Ask him how the creator, the Mines and the fight felt: too slow or fiddly anywhere, anything confusing, anything to change in the look or the wording of the log. Fix those first (small, with tests). If he hasn't played it yet, say so and carry on.

## Step 1: part 2, the places you spend things

Follow sections 3, 4 and 6 of the plan. Same rules as part 1: real web pages (React), **no saving and no server**, a refresh starts again, pure display on top of the engine, no game rules in components. Add the four places to the clan home screen and keep the 1366 x 640 fit, touch, keyboard letters and screen readers.

1. **Market:** the items in `inShop(smithy)`, with Kenney pictures for weapons, armour and shields (colour them like the rest). Pick a member, pick an item, see the price **with tax**. Before paying, the maths moment: "what do you pay?" (`marketTotal`). Right: pay it. Wrong or skipped: show the working and charge the correct `shopPrice` anyway. "Look closely" costs `examineCost`, with its own question (`examineCostQuestion`) and the same never-blocks rule; it reveals the item's real bonuses and what the member needs to use it well (`usableBonus`). Offer **"which is the better buy"** between two items (`betterBuy`) as tap-to-answer, and **change** from the note (`marketChange`) after a purchase. Show which gear a member already has and swap it.
2. **Training Hall:** pick a member with points; show cost per +1 for each stat (`trainCost`, with the Training Hall level), HP and SP buys. Maths moment: "you have N points, it costs C: how many can you buy, what's left?" (`trainingBuy`, two questions). A wrong answer never blocks; show the working and carry on. Show points left clearly.
3. **Church:** knocked-out members, the bill after the free wake-up (`wakeCost`, `churchBill`), a wake button per member. A wrong answer still charges the right amount. Not enough gold: say so kindly.
4. **Clan page:** members with gear, gold, followers, level and "practising: percentages" (the teacher's topics, never any accuracy figures). Link to each place; "More details" stays.
5. **Test settings strip:** add "Give 500 gold" and "Give 12 training points to everyone" buttons so James can try every place without grinding fights (test only; say so on the buttons).
6. **Writing and pictures:** short, kind item text (no gore), item pictures from the sheet, a Training Hall and a Church heading picture if easy.
7. **Tests:** components render and the main flows work: buy something with a **wrong** answer and still be charged the right price; buy with a right answer; examine; better buy; train with a wrong answer and still get the right result; wake someone with the free wake-up then a paid one; not enough gold; the whole flow by keyboard only. Run type check and the tests for `src/` and `shared/` before each commit (about four minutes; run in the background).
8. **Test page for James:** rebuild the single-file test page and **update the existing Artifact** (https://claude.ai/artifact/G1EuzE7Q3MuhDF5xN3cTaP) so the link stays the same. Give him a short "what to try" list.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you.
- Add the "Stage C.3 results" wrap-up to docs/CLANS-PLAN.md (what was built across both parts, what was checked, what's left) and update the memory note.
- **Stop for James after part 2** with a plain-words summary and the test page link. Don't start C.4 (the empire) until he has played it.
- Nothing goes live in this step: no migrations applied, no server functions deployed, no merge to `main`.
- If something is wrong or too big, say so plainly and suggest splitting it (for example Market first, then Training Hall and Church).
