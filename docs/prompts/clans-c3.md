# Prompt: Clan Quest, stage C.3 (the screens), with a quick look at James's C.2 feedback first

Paste this into a new chat to start the next part.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans (`node_modules` there is a link to the main folder's). Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (the approved plan; "Stage C.1 results", "Tuning pass" and "Stage C.2 results" are at the bottom), docs/CLANS-RULES.md, shared/README.md, and the memory note school_games_hub.md.
- **The engine you'll draw (already built, tests only):** `shared/clans/` (`fight.ts`, `character.ts`, `config.ts`, `battleCry.ts`, `moments.ts`, `sim.ts`) and `shared/maths/practical.ts`. Don't change rules or numbers in this stage unless a screen shows something is broken; if so, say so plainly.
- **For the look and the question box**, read how an earlier game's test page was built (`npm run gem-keep:preview` / `101:preview` and their `vite.*-preview.config.ts`) and `src/maths/` (`QuestionModal.tsx`, `NumberPad.tsx`). Don't read the rest of the other games' code.
- Not changed by this step: the original game's code is GPL-2 and **none of it may be copied**; our names, text, numbers and pictures only. Kenney's 1-Bit Pack (CC0) for monsters and items: check its licence again at the start and say what you found.

## Step 0: James's C.2 feedback (ask first, 2 minutes)

James was shown example questions at Years 4, 5 and 6. Ask him whether the wording and level were right, and whether any kind should be dropped, simpler or weighted more. Fix those first (small, with tests). If he hasn't looked yet, say so and carry on, since the screens don't depend on it.

## Step 1: C.3, the screens

Follow sections 3, 4, 5, 6 and 11 of the plan. Real web pages (React, as the other games), **no saving and no server**: everything lives in the browser for this stage and a refresh starts again. Pure display on top of the engine; no game rules in components.

1. **Look:** dark BBS style, the 16 old terminal colours, VT323 for headings and a clear font for reading, box-drawn borders. Same look as Dragon Maths if it already exists on a branch; otherwise start it here and say so. Big buttons, touch, keyboard letters, screen readers, fits 1366 x 640. Sound off (made in code, later); respect reduced motion.
2. **Clan creator:** pick race and class for four members, see the stats, "Roll again" (up to 3 times), names and the clan name from word lists (no typing). Show **only HP, attack, defence and one star** by default, with "More details" for the rest.
3. **The Mines and the fight:** choose a depth 0-20 with the hint from `depthHint`; each round, in agility order, pick Attack (target), Spell, Guard or Run for each member, with "Default action" on Enter. A fight log in plain gentle words (nobody bleeds; enemies "crumble" or "run off"). Show who is up next, HP and SP bars, and the 8-a-day counter.
4. **The Battle Cry:** one question before each round using the question box. Right answer: choose damage or heal. Wrong or "No thanks": show the worked answer and carry on. No timer, nothing lost. Needs a **minus key** on the number pad (Year 6 negatives) and tap-to-answer for "which is the better buy".
5. **Market, Training Hall, Church, clan page:** each with its maths moment from `moments.ts` (shop total with tax, examine, change, better buy, points left over, Church bill). A wrong answer never blocks: show the working and charge the right amount. Clan page: members, gear, gold, followers, level, and "practising: percentages" (never any accuracy figures).
6. **A settings strip for James's test only** (year band, topics on/off, depth, a "skip a day" button) so he can try every band without waiting. It stands in for the Teacher page, which is later.
7. **Pictures and writing:** Kenney monsters and items if the licence is fine, and portraits made in code from race + class parts. Write the monster, class and race text kindly and briefly; no gore.
8. **Tests:** components render and the main flows work (make a clan, win a fight, answer and miss a Battle Cry, buy something with a wrong answer and still be charged the right price), plus a keyboard-only run of one fight. Run type check and the tests for `src/` and `shared/` before each commit.
9. **Test page for James:** build a standalone preview the same way the other games did and publish it as an **Artifact for James** (private; nothing saved). Give him the link and a short "what to try" list.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you. Run the whole suite before pushing (about four minutes; run it in the background).
- Add a short "Stage C.3 results" section to docs/CLANS-PLAN.md (what was built, what was checked, what's left) and update the memory note.
- **Stop for James after C.3** with a plain-words summary and the test page link. Don't start C.4 (the empire) until he has played it.
- Nothing goes live in this step: no migrations applied, no server functions deployed, no merge to `main`.
- If something in the plan turns out to be wrong or too big (this stage is the biggest so far), say so plainly and suggest splitting it, for example creator + fight first, then shop/church/clan page.
