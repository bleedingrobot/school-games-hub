Bond Match stage M.5: the maths ladder and teacher focus. M.1–M.4 and M.6 are done, and Bond Match went live on 20 Oct 2026 (switch migration applied, `bond-match` function v3 deployed, merged to main). James asked for M.5 next.

You are working for James, a Year 4–6 teacher. Reply to him in plain, simple words: no jargon, file paths or commit hashes unless he asks. He decides every live step.

## Read first
- `docs/GAME_DEVELOPMENT_GUIDE.md` (sections 0, 3, 4, 8 and 9): especially "never touch `shared/maths/` from a game branch".
- `docs/BOND-MATCH-PLAN.md`: section 7, section 9 (M.5 row), and every "results" section at the end (including "Going live").
- `docs/MATHS-FOCUS-PLAN.md`: how skills, focus and Auto work.
- `shared/maths/ladder.ts`, `shared/maths/skillPacks/placeSkills.ts`, `decimalSkills.ts`, `fractionSkills.ts`, `generatedKit.ts`, `shared/maths/focus.ts`.

## The one rule that must not break (James, 19 and 20 Oct 2026)
**Bond Match is never evidence for the ladder.** A match can be memory or a guess. Nothing Bond Match does may write fact records, move a ladder place, count towards a maths focus or its results, or feed Auto. Bond Match may only *read* the ladder and the focus, to choose which bond to open on. New bond skills are proven only by real questions in the other games (Monsters, Space, Dragon Maths, Marble Rush, Gem Keep). Keep the existing test (`supabase/functions/bond-match/handler.test.ts`, "never touches fact records") passing, and add one for anything new.

## What already exists (checked 20 Oct 2026; check again, it may have moved on)
- `bonds-100` ("Pairs that make 100": `bond100:tens/fives/any/take`) and `bonds-1000` ("Hundreds that make 1000": `bond1000:hundreds/fifties/tens/take`) are **built** ladder skills, from the maths focus work (F.5). The plan's "flip the stubs" is already done.
- Tenths to make 1 exists as one question type, `addten:to-one`, inside `add-tenths`.
- **Missing from the ladder:** bonds to 1 with hundredths (0.35 + 0.65), decimal bonds to 10 (3.4 + 6.6), and fraction pairs that make 1 (⅓ + ⅔, ⅜ + ⅝). Confirm these are really missing before building.

## Two parts, two branches

### Part A: new bond question types for the ladder (branch `maths-bonds`, its own worktree from `origin/main`)
This changes `shared/maths/`, so every maths game that asks ladder questions changes once it's deployed. It is its own branch, per the guide.
1. **Stop first and propose to James**, in plain words and before writing code, where each missing bond goes:
   - new question types inside existing skills (for example hundredths-to-1 and to-10 inside `add-tenths` or `decimal-equivalents`, and fractions-to-1 inside `equivalent-fractions`), or
   - new ladder skills (for example "Decimals that make 1" and "Fractions that make 1") with a place on the ladder and curriculum tags.
   Recommend one, with the trade-off: new skills show up in progress and focus choices; new types inside existing skills change less.
2. Build what he picks, following `generatedKit.ts`:
   - one mastery record per question type, keys next to the existing ones (e.g. `bondd1:hundredths`, `bondf1:thirds`);
   - typed answers on the pad with the point key, or four choices for fraction answers;
   - every wrong choice is a named mistake, never a random number;
   - nothing is built from floating-point decimals.
3. Tests in the existing style (ladder, generated, focus, focusPacksSql if the SQL lists of keys need it). If a migration is needed (allowed keys or packs), use `node scripts/migration-numbers.mjs` for the number.
4. Going live, each step only on James's word: apply any migration, then redeploy every function that bundles `shared/maths` (find them; it was `gem-keep`, `space-game`, `save-bot-game`, `marble` and maybe `monster` and `lord`; rebuild only those with `npm run build:functions -- <name>`), then merge `maths-bonds` to main.

### Part B: Bond Match opens on the right bond (branch `bond-match`)
Read only, never writing anything maths-related.
1. **Teacher focus.** If the student's class has a maths focus on a skill that matches a bond set, the picker opens on that bond, with a "Your teacher picked this" label. The student can still change it. Use the focus the pupil can already read (`my_maths_focus` or what the other games call); don't add a database function unless you must. Put the map from ladder skill to bond set in Bond Match's own folder:
   - `bonds-100` → To 100;
   - `bonds-1000` → To 1000;
   - the Part A skills → their decimal or fraction sets;
   - `facts-10` → To 10, `facts-20` → To 20.
2. **Auto.** With no focus, if the class has Auto on, highlight the bond for the student's current ladder place, read from what the pupil can already read (`my_ladder`). The picker shows it first or marks it "Good for you now". It never starts a game by itself.
3. Kids can always pick any bond. No focus and no Auto: the picker works exactly as now.
4. Nothing here changes saving, points, stars or the server function. If you find you need to change the server, stop and ask.
5. Screens follow the new look (`src/games/bond-match/bond-match.css`, 20 Oct): one small badge on the tile, no extra rows of text. Check phone width (390 px) and laptop width (1366 px), and rebuild the preview (`npx vite build --config vite.bond-match-preview.config.ts`) with a fixed fake focus. Give James the private preview page (the existing one is https://claude.ai/artifact/C9trZSY7R9RC1EfEmExaX3; republish it).
6. Tests: focus opens the right bond; Auto marks the right bond; no focus means no change; and Bond Match still makes no maths-record call.

## Order
Part B's focus mapping for To 10, 20, 100 and 1000 can be built straight away. The decimal and fraction mappings wait for Part A's skills. Do Part A's proposal (step 1) first, while James decides, start Part B.

## Every stage
- `git fetch` and merge `origin/main` into your branch first.
- Never a bare `git push`: push with `git push origin <branch>`.
- Never `supabase db reset`. Test SQL on a scratch copy (`scripts/scratch-db.sh`, `scripts/scratch-test.sh`). Every copy has three known failures: two Clan Quest midnight-job checks and `maths_focus_results` check 42.
- Before saying a stage is done, run `npm run typecheck`, `npm run test:all` and `npm run build`.
- Write a "Stage M.5 results" section in `docs/BOND-MATCH-PLAN.md`, and a matching note in `docs/MATHS-FOCUS-PLAN.md` for Part A.
- Stop and report to James in plain words: what's built, what he needs to decide, and what each live step would change for the kids.
