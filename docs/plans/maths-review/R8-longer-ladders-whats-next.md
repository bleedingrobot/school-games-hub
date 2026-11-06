# R8. Longer ladders and "what's next" links (Penguin Pairs, Tūī, Beanstalk, Hop)

> **Update 7 Nov 2026:** follow [LEARNING-DESIGN.md](../../LEARNING-DESIGN.md) and check [GAME-KIT-PLAN.md](../GAME-KIT-PLAN.md) first. If kit stage K4 (`WhatsNext` card) and `mastery` from K1 is merged, use it instead of copying another game's code; if not, write this so it can move into the kit later.

Status: plan only, nothing built. Written 7 Nov 2026. Games: Penguin Pairs (folder `korora`), Tūī's Ten Tree, Kiwi's Beanstalk, Hop's Glow-worm Pond. Quick-win items first, shared-maths items marked.

## 1. The problem

Pattern 4 in DECISIONS.md. Four foundational games run out of road. A quick child reaches the top and has nothing new, and no game says "you are ready for the next idea, and here it is". The evaluations found these dead ends:

- **Penguin Pairs:** four levels only (doubles 1 to 5, halves 2 to 10, doubles 6 to 10, halves 12 to 20; `shared/korora/round.ts:26-31`). The database `reached` column only allows 1 to 4 (`20261105000100_korora.sql:28`). No double of 0, no near doubles, no missing-number form.
- **Tūī:** five steps, then "ten and some" is finished. Nothing about ten more / ten less, 10 + 10, or 14 to 24, and no pointer to the bridging-ten idea in Weka.
- **Beanstalk:** bonds to 10, 100 and 1000 only. Nothing at 20, no "missing leaf" form, and (R4 covers the bridge) no link on from 10 to 100.
- **Hop:** skip counting stops at tens to 100, fives to 50, twos to 20. No threes or fours, nothing past 100, every start is a multiple of the step.
- **All four:** when a child finishes the top level, the finish screen says "well done" and nothing else.

## 2. The research behind it

- Fluency research (Baroody, Gersten): once a fact set is secure, move on to a linked set quickly. Staying too long is the main cause of boredom in fast learners.
- Near doubles (6 + 7 is 6 + 6 + 1) are the standard next strategy after doubles, and bridge to Weka's make-ten facts.
- Missing-number forms (7 + ? = 10) are what move a child from "I know the pair" to "I can use the pair" (Beanstalk eval candidate 7).
- Counting back and skip counting from non-multiples (start at 3, hop by 10) is what shows the child understands the pattern and has not just memorised the chant (Hop eval candidate 6).
- Where the next game is a different idea, a short signpost keeps the child moving through the ladder without a teacher steering.

## 3. The change

### 3.1 The "what's next" signpost (same idea in all four games)

On the finish screen, only when the child's top level is secure (at least 70 percent of that level's facts at box 2 or more, the same rule the teacher skill map uses), and the target game is switched on for the class (`readSettings()`), show one small card: a picture of the next game and one line, for example "Ready for more? Try Weka's Stepping Stones." Tapping it opens that game. No new database. If the target is switched off, no card. Each game builds this card inside its own folder (do not use the shared NextPartChip in `src/components`).

| From | Next | Line |
|---|---|---|
| Penguin Pairs | Weka | "Doubles help with 6 + 7 too. Try Weka." |
| Tūī | Weka | "You know ten and some. Now make ten to add bigger sums." |
| Beanstalk | Weka | "You know your pairs. Use them to add across ten." |
| Hop | Penguin Pairs (or times tables page if on) | "Jumping in twos is doubling. Try Penguin Pairs." |

(Quick looks to Pipi and Pipi to Beanstalk are covered in R3 and R4 and need no change here.)

### 3.2 Penguin Pairs: more levels

- Level 5, near doubles 5 + 6 to 8 + 9 (use the `add:a+b` keys from Weka's add pack so no shared change is needed; check that the key records are readable from the Penguin Pairs round before building). Picture: two equal groups plus one extra penguin.
- Level 6, doubles of 0 and 10, and doubles of teens (12, 15) using tens and ones: this needs new fact keys in `shared/maths` (shared file, needs James's OK).
- Level 7, missing number: "double what is 14?" shown as ? + ? = 14 (shared maths).
- Widening the `reached` check from 1 to 4 to 1 to 7 needs a NEW migration (never edit the old one).
- Bronze, silver and gold days keep working. R6 help rules apply on the new levels.

Split in two stages. **Stage A (own folder only):** level 5 with Weka's keys, the signpost, the finish screen. **Stage B (needs James's OK):** levels 6 and 7 with new maths keys and the migration.

### 3.3 Tūī: step 6, "Ten more, ten less"

- New step 6: 10 + 10, ten more than a teen (14 to 24), ten less (24 to 14). Uses the ten-frame already in Tūī.
- Needs new fact keys and ladder registration in `shared/maths` (shared file, James's OK), and the migration's step check widened to 6 (NEW migration).
- The signpost reads "You are ready for Weka's bridging ten" once step 6 is secure.
- Tūī eval candidate 4 (show the take-away on the n minus 10 form) is done in R5 and R9, not here.

Stage A (own folder only): the signpost on step 5. Stage B (James's OK): step 6.

### 3.4 Beanstalk: bonds to 20 and the missing leaf

- New sum "bonds to 20" between 10 and 100 (pairs 11 to 19 with 20, using the ten-frame picture); needs the new sum registered (own folder if sums are listed in `shared/beanstalk`, otherwise shared maths: check first).
- "Missing leaf" form on any sum: the child sees 7 + ? = 10 and taps the missing leaf; after it the line "So 10 take 7 is 3" links to the take-away form.
- R4 owns the target number and the 10 to 100 bridge, so do R4 first. Do not duplicate it here.
- Signpost on the finish screen after the 1000 beanstalk, or after 20 for a younger child.

### 3.5 Hop: steps that go on

- Add threes (to 30) and fours (to 40) as steps after twos. Hop currently treats twos as the top, so these become new steps 4 and 5; the step is chosen by the same 70 percent rule.
- Tens past 100 (to 200) as an extra range of the tens step, after the child is secure to 100.
- Non-multiple starts ("start at 3, hop by 10") as an extra mode on gold days, shown for a step only after it is secure.
- Hop keeps its own facts in `shared/hop`, so no shared change is expected. Confirm that the fact key can carry a start number.

## 4. Files affected

Own folders only, unless marked **SHARED**:

- `src/games/korora/*`, `shared/korora/round.ts`, `progress.ts`, voice lines, `words.ts`
- `src/games/tui/*`, `shared/tui/*`
- `src/games/beanstalk/*`, `shared/beanstalk/*`
- `src/games/hop/*`, `shared/hop/*`
- New voice clips (`scripts/voice-clips.py <game>`)
- **SHARED, needs James's OK:** `shared/maths` (new keys for Penguin Pairs levels 6 and 7, Tūī step 6, possibly Beanstalk bonds to 20), `shared/maths/ladder.ts` (pack ids), `src/maths` if the skill map labels need the new steps, `shared/maths/skillPacks/earlyFacts.ts`.

## 5. Database / migration needs

- Penguin Pairs levels 6 and 7: NEW migration widening the `reached` check (number from `node scripts/migration-numbers.mjs`).
- Tūī step 6: NEW migration widening its step check to 6.
- Beanstalk: probably none for bonds to 20 (a new sum value); check the `sum` column constraint in `20261104000700_beanstalk.sql` and widen in a NEW migration if it is a check.
- Hop and the signpost cards: none.
- Merging the PR applies migrations. Stop and tell James first.

## 6. Test steps

At most 8 tests per game.

Penguin Pairs: (1) level 5 questions are near doubles and the answers are right; (2) a child with level 4 secure gets level 5 next; (3) `reached` saves 5; (4) bronze, silver, gold still work on level 5; (5) signpost shows only when secure and Weka is on; (6) signpost hidden when Weka is off.

Tūī: (1) step 6 questions right; (2) step 6 only after step 5 secure; (3) migration accepts step 6; (4) signpost rules as above.

Beanstalk: (1) bonds to 20 pairs all total 20; (2) missing leaf answers right; (3) sum accepted by the database; (4) signpost rules.

Hop: (1) threes and fours land on the right numbers; (2) tens past 100; (3) non-multiple start lands right; (4) step chosen by the 70 percent rule; (5) signpost rules.

Preview checks: play each new level or step to the end on a phone width; the finish card shows once, opens the right game, and is gone when the target is off; read-aloud lines play.

## 7. Effort and impact

Effort M. Impact Medium. Stage A pieces (signposts, Penguin Pairs level 5, Hop steps) are small and safe. Stage B pieces need James's OK for shared maths and a migration each.

## 8. Session prompts (ready to paste, one per game, each its own branch)

Do R4 before the Beanstalk prompt and R6 before any prompt that adds a level. Prompt 1 is the one in the JSON file.

### Prompt 1: Penguin Pairs (Stage A)

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r8-korora-ladder. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md and docs/plans/maths-review/R8-longer-ladders-whats-next.md (sections 3.1 and 3.2, Stage A only).

Make Penguin Pairs go further:
1. Add level 5, near doubles 5+6 to 8+9, in shared/korora/round.ts using Weka's add:a+b keys (first check those records can be read from the Penguin Pairs round without changing shared/maths; if not, stop and tell James). Picture: two equal groups plus one extra penguin. Add the voice lines and run scripts/voice-clips.py korora.
2. Level 5 appears only when level 4 is secure (70 percent of its facts at box 2 or more). Bronze, silver and gold days keep working.
3. Add the "what's next" card to the finish screen inside src/games/korora (do not use NextPartChip): shown only when the top level is secure and Weka is switched on in readSettings(), opens Weka, line "Doubles help with 6 + 7 too. Try Weka."
4. The reached column only allows 1 to 4: if the migration is needed to save level 5, add a NEW migration (number from node scripts/migration-numbers.mjs) widening it. Do not edit the old one.
5. At most 8 tests. Rebuild with npm run build:functions -- korora. Typecheck, npm run test:changed, play the preview on a phone width.
Do not touch shared/maths, src/maths, src/styles.css or src/components. Stop and tell James before any live step (the migration applies when the PR merges). Open a PR when done.
```

### Prompt 2: Hop

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r8-hop-ladder. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md and docs/plans/maths-review/R8-longer-ladders-whats-next.md (sections 3.1 and 3.5).

Make Hop go further:
1. In shared/hop add threes (to 30) and fours (to 40) as steps after twos, and tens past 100 (to 200) once tens to 100 is secure. Step chosen by the same 70 percent rule. Check the fact key can carry what it needs; if it needs shared/maths, stop and tell James.
2. On gold days add non-multiple starts ("start at 3, hop by 10") for a step only after it is secure.
3. Add the finish-screen "what's next" card inside src/games/hop (not NextPartChip): shown only when the top step is secure and Penguin Pairs is on; line "Jumping in twos is doubling. Try Penguin Pairs."
4. Voice lines and scripts/voice-clips.py hop. At most 8 tests. npm run build:functions -- hop. Typecheck, npm run test:changed, play the preview.
Stay inside Hop's folders. Stop and tell James before any live step. Open a PR when done.
```

### Prompt 3: Tūī

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r8-tui-ladder. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md and docs/plans/maths-review/R8-longer-ladders-whats-next.md (sections 3.1 and 3.3, Stage A only).

Add the "what's next" card to Tūī's finish screen inside src/games/tui (not NextPartChip): shown only when step 5 is secure and Weka is on in readSettings(); line "You know ten and some. Now make ten to add bigger sums." Add the voice line and run scripts/voice-clips.py tui. At most 4 tests. Typecheck, npm run test:changed, play the preview.
Step 6 (Ten more, ten less) is Stage B: write nothing for it, but tell James it needs new keys in shared/maths and a migration widening the step check to 6, and wait for his OK.
Stop and tell James before any live step. Open a PR when done.
```

### Prompt 4: Beanstalk (after R4)

```text
Work in /Users/jriley/games-hub-isles. git fetch origin, make your own worktree and branch from origin/main named r8-beanstalk-ladder. Confirm R4 has merged. Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md and docs/plans/maths-review/R8-longer-ladders-whats-next.md (sections 3.1 and 3.4).

1. Add the "missing leaf" form (7 + ? = 10) to the sums, with the line "So 10 take 7 is 3" after a right answer.
2. Add bonds to 20 as a sum between 10 and 100 (check shared/beanstalk and the sum column in migration 20261104000700_beanstalk.sql; widen any check in a NEW migration, never edit the old one; if it needs shared/maths, stop and tell James).
3. Add the finish-screen "what's next" card inside src/games/beanstalk (not NextPartChip): shown only when the top sum is secure and Weka is on; line "You know your pairs. Use them to add across ten."
4. Voice lines and scripts/voice-clips.py beanstalk. At most 8 tests. npm run build:functions -- beanstalk. Typecheck, npm run test:changed, play the preview.
Stop and tell James before any live step. Open a PR when done.
```
