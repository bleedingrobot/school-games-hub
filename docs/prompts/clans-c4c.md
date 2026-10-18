# Prompt: Clan Quest, stage C.4 part C (Quests)

Paste this into a new chat to start the next stage.

---
You're continuing a game for James's School Games Hub (a website of games for his Year 4-6 class at Douglas Park School). Reply to James in plain, simple words (no jargon, file paths or commit hashes unless he asks).

## Where things are

- Code: ~/projects/school-games-hub. Clan Quest has its **own branch `clans` and worktree** at ~/projects/school-games-hub-clans (`node_modules` there is a link to the main folder's). Never commit game work straight to `main`.
- **Read first:** docs/CLANS-PLAN.md (section 6 "Quests", and the results sections at the bottom, especially "Stage C.4, part B, second half"), docs/CLANS-RULES.md, shared/README.md, and the memory note school_games_hub.md.
- **Already built (all on `clans`, nothing saved, nothing live):** the whole engine in `shared/clans/` (members, fights, market, training, Church, the empire, battles) and every screen so far in `src/games/clans/` (creator, Mines, fight, Market, Training Hall, Church, clan page, Empire home, Land and buildings, Barracks and troops, Raid and Friendly War). `Moment.tsx` is the ask-then-show-working step, `places.ts` holds the plain functions the places use, `session.ts` is the in-browser clan, `PracticalAsk.tsx` is the question box. Test page: `preview/clans/`, `npm run clans:preview`, then `node scripts/inline-preview.mjs dist-preview-clans <out.html>` makes the single file. Private Artifact to update (same file path, keep the link): https://claude.ai/artifact/HdLC12TafKW9ohqVnkAnAB. The last stage put a "What to try" box at the top of the page; keep one.
- Ground rules from before: a wrong maths answer **never blocks**; questions are made and marked by code, never by an AI; every tuning number lives in `shared/clans/config.ts`; the screens are display only, no game rules in components; no saving and no server in this stage (a refresh starts again).
- The original game's code is GPL-2 and **none of it may be copied**; our names, text, numbers and pictures only.

## Step 0: quick feedback (1 minute)

Ask James how the Barracks, Raid and Friendly War screens played and whether anything should change first. If he has nothing, go on.

## Step 1: Quests

Plan section 6 says: one quest a day, about 10 to start, short branching stories with 1-2 choices and sometimes a puzzle (pattern, logic, number riddle), written fresh by us, with charisma opening extra choices. Negative numbers appear only here as a puzzle (Year 6), never as a score.

1. **Engine (`shared/clans/quests.ts`):** quest data (story text, choices, what each choice gives: gold, followers, training points, a magic item, nothing), the rule for which choices charisma opens, one quest a day, and a seeded way to pick today's quest. Plain data and plain functions with tests, like `empire.ts`. Everything tunable in `config.ts`. Rewards must stay small next to the Mines and raids (check against the simulator numbers in CLANS-RULES.md).
2. **Ten quests, written fresh:** kind, funny, short (a Year 4 can read each in a minute), no violence beyond the game's gentle level, no real people or brands. Mix of: a pure story choice, a pattern puzzle, a logic puzzle, a number riddle, a negative-numbers puzzle (Year 6 only; skipped for other years), and a charisma choice. Puzzles are made and marked by code; a wrong answer shows the working and the story carries on (a small difference in reward is fine, never a block).
3. **Screen (`Quest.tsx`):** a "Quest" button on the clan page ("done for today" kindly when used), the story one paragraph at a time, big choice buttons (charisma-locked ones shown greyed with the reason), the puzzle through `Moment`/`PracticalAsk` where it fits, and a plain result. Touch, keyboard letters, screen readers, 1366 x 640 fit.
4. **Test strip:** "Allow another quest today (test only)" and a way to pick a quest by number so James can try them all quickly.
5. **Tests:** every quest can be finished by every route; charisma locks and unlocks; the one-a-day limit and the new-day reset (`skipDay`); right and wrong puzzle answers both carry on; the negative-numbers puzzle only for Year 6; rewards land on the clan; keyboard only. Run the type check and the tests for `src/` and `shared/` before each commit (about four minutes; run in the background).
6. **Test page for James:** rebuild the single file and update the existing Artifact with a short "what to try" list.

## How to work

- Small commits on the `clans` branch, with the attribution line the system gives you.
- Extend docs/CLANS-PLAN.md with a "Stage C.4, part C" results section (what was built, what was checked, what's left); update shared/README.md and the memory note.
- **Stop for James at the end** with a plain-words summary and the test page link. Don't start C.5 (saving, the server and the daily reset) until he has played it. Classmate-raid screens are not part of this stage either.
- Nothing goes live: no migrations applied, no server functions deployed, no merge to `main`.
- If something is wrong or too big, say so plainly and suggest splitting it (for example engine and five quests first, the other five after).
