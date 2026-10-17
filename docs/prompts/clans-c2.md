# Prompt: Clan Quest, stage C.2 (the maths), with a short tuning pass first

Paste this into a new chat to start the next part.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans (`node_modules` there is a link to the main folder's). Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (the approved plan, all questions answered, with "Stage C.1 results" at the bottom), docs/CLANS-RULES.md (every number taken from the original game and every change), shared/README.md, and the memory note school_games_hub.md. Then the code from C.1: `shared/clans/` (`fight.ts`, `character.ts`, `config.ts`, `sim.ts`, `clans.test.ts`).
- For how the maths packs and question box work, read `shared/maths/` (`skillPack.ts`, `selector.ts`, `config.ts`) and `src/maths/`. **Check first whether the Maths Monsters branch has been merged into `main`**: the plan says times tables is on `main` and the other five packs are on the `monsters` branch. If `monsters` isn't merged yet, build on `main`'s times tables and don't copy the other packs; say so to James. Don't read the rest of the Maths Monsters or Dragon Maths code.
- Not changed by this step: the original game's code is GPL-2 and **none of it may be copied**; our names, text and numbers only.

## Step 1: a short tuning pass (about an hour, stop if it grows)

The C.1 simulator (`npm run clans:sim`, see the plan's results section) showed three problems. Fix what's easy and say plainly what you changed:

1. **Late game is too slow.** Target: a mixed clan at level 20 in 6-8 weeks of daily play (not 60+ days). Look at XP past level 14, and at monster armour/strength past depth 15.
2. **An all-fighters clan runs out of gold at the Church from about day 30.** Suggest a fix (cheaper wake-ups, or one free wake-up a day) and try it.
3. **Early game never loses.** Check what "too easy / just right / too hard" depth hints should be, using the simulator at depth offsets.

Keep every number in `shared/clans/config.ts` or `gamedata.ts`, update the CLANS-RULES.md table and the plan's results, and keep the tests passing.

## Step 2: C.2, the maths (stop for James when done)

Follow sections 6 and 12 of the plan. Pure TypeScript in `shared/maths/` (new question kinds) and `shared/clans/` (wiring), with tests. **No screens yet** (that's C.3).

1. **New question kinds**, made and marked by code (never by an AI), each rebuildable from its numbers so the server can check the answer later. Each has Y4/Y5/Y6 bands (easy bands use round numbers like 10%, 25%, 50%; harder ones 15%, 35%, 12.5%):
   - percent of an amount;
   - price with tax, and change from 1,000 (market);
   - area (and perimeter) of a rectangle (land plots);
   - division with remainders, and rounding up (training points, barracks);
   - simple ratios and budgets (troop costs);
   - negative numbers for the points table (Y6 only);
   - a simple "which is the better buy" unit-rate question.
2. **The Battle Cry**: once a round, before the members move, one question for the whole clan. The engine already takes `cry: 'damage' | 'heal' | null`; add the part that picks a question at the clan's year band and the teacher's topic switches, marks the answer, and returns the cry to play. A wrong answer or "No thanks" is a normal round and shows the worked answer. No timer, nothing lost.
3. **The shop and church moments** from the table in section 6 of the plan, as functions that take the real numbers (the actual price, tax, level, member count) and make the question from them. A wrong answer never blocks anything: the shop shows the working and charges the right amount.
4. **Private by design**: nothing here shows a classmate's accuracy. Reuse the way the other games record answers (look at Gem Keep's save of maths answers) but do not add tables or functions yet.
5. **Tests**: every kind at every band gives a valid question with a single right answer, the same seed gives the same question, answers are marked correctly (including tricky ones such as remainders and rounding), no negative or silly numbers at the easy bands, and a fight replayed with its recorded Battle Cry answers gives the same result as it did live.
6. **Hooks for the teacher switches**: topic on/off and year band, in the same shape the other games use. No Teacher page changes yet.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you. Run type check and the tests for `shared/` before each commit; run the whole suite before pushing (it takes about four minutes, so run it in the background).
- Add a short "Stage C.2 results" section to docs/CLANS-PLAN.md (what was built, what was checked, what's left) and update the memory note.
- **Stop for James after C.2** with a plain-words summary and a handful of example questions at each band so he can judge the level. Don't start C.3 (the screens) until he's looked.
- Nothing goes live in this step: no migrations applied, no server functions deployed, no merge to `main`.
- If something in the plan turns out to be wrong or too big, say so plainly and suggest a fix instead of quietly changing course.
