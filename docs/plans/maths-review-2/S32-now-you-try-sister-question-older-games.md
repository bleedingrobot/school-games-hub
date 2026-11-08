# S32: Older games: Now you try asks a sister question
**Game:** Weka, Tūī, Hop, Penguin Pairs, Pipi, Beanstalk
**What's wrong:** After "look together", "Now you try" asks the very same question again. The child can copy the answer just shown. Tūī also praises a redo the same as a first try.
**What done looks like:** "Now you try" asks a sister question: the same idea with different numbers, not the one just shown. Tūī praises a redo in a plain way.
**Size:** M
**Impact on learning:** High
**Waits for:** S16 ("Now you try" asks a sister question, and the LEARNING-DESIGN rule 7 amendment)

## 1. The problem
R5 (docs/plans/maths-review/R5-mistakes-that-teach.md) added show-why and redo. In these six games the redo is a copy. DECISIONS.md pattern 3 says so.

Where each redo is built now:
- Weka: `lookTogether()` at src/games/weka/Goes.tsx:225-243. `onEnd` sets `setRedo(true)` and asks the same line again (`toTenLine`, `fromTenLine` or `askLine`).
- Tūī: look together at src/games/tui/Goes.tsx:158-171. The redo only flips the nests: `[...go.choices].reverse()` at :191. `NowYouTry` at :236.
- Hop: `lookTogether()` at src/games/hop/Hops.tsx:121-137. `worms` (:118) reshuffles the same hop's choices when `redoCount>0`.
- Penguin Pairs: `lookTogether()` at src/games/korora/Goes.tsx:173-192. Redo reorders the same choices (:185, `reordered` at :65). `NowYouTry` at :327.
- Pipi: `lookTogether()` at src/games/pipi/Goes.tsx:171-189. Redo reorders the same shells (:182-187, `reordered` at :83). `NowYouTry` at :308.
- Beanstalk: `lookTogether(anchor)` at src/games/beanstalk/Round.tsx:127-143. The redo keeps the same leaf picked (:138-139), so the child finds the partner just shown.

Tūī praise: the right-answer line is `say(WORDS.right(go.answer, go.n))` at src/games/tui/Goes.tsx:183, the same for a first try and a redo (src/games/tui/words.ts:52-55). issues-a.json lists this as not fixed (words.ts:53).

Look together length and skip: I read "length and skip" as the look-together timing in the kit. The skip button shows after 3 s (SKIP_AFTER_MS=3000) and the whole look ends at 12 s (LONGEST_MS=12000) (src/kit/ShowWhy.tsx:67-71, :142-146). Each game sets how many steps it plays: Weka `go.small` (Goes.tsx:236), Hop `counted.length` (Hops.tsx:126), Pipi 3 (Goes.tsx:176), Penguin Pairs `mirror ? go.answer : go.n / 2` (Goes.tsx:179), Tūī `go.n` (Goes.tsx:161), Beanstalk `(target - n) / unitOf(target)` (Round.tsx:133). Each part checks that its look is not too long and that the skip works.

## 2. The rule behind it
LEARNING-DESIGN rule 7 (mistakes teach): show why, then try again. S16 amends it so the "again" is a sister question. Rule 10: praise is about the result.

## 3. The change
Reuse S16's pattern and names. S16 also decides how a redo tap is sent and replayed on the server. Today `replayTaps` checks `go.choices.includes(pick)` for the go in play (shared/kit/replay.ts). A sister question has different choices, so follow S16 for this. Do not invent it here.

Each game adds one deterministic helper, `sisterOf(go, seed, index)`. It makes the same kind and help level, using the round seed, so the server can rebuild it. A sister is never the question just shown.

### Part 1: Weka
Sister: the neighbour fact on the same start number (small plus or minus 1, sum 11 to 18, small not above big). It keeps the kind (add, turn or back) and the help level. If there is no neighbour, use another fact of the same level. Replace the same-line ask at Goes.tsx:225-243.

### Part 2: Tūī
Sister: a different number n of the same way (tui.md:177). Replace `[...go.choices].reverse()` (Goes.tsx:191). Praise for a redo is plain: "You found it. 10 and 6 is 16." The "Well done" style is for a first-try right answer only (words.ts:52-55). Add a `WORDS.rightRedo` line.

### Part 3: Hop
Sister: a different key of the same step and direction, so a different answer or start (`roll` in shared/maths/skillPacks/earlyFacts.ts:227). Replace the `worms` reshuffle (Hops.tsx:118).

### Part 4: Penguin Pairs
Sister: a neighbouring number of the same kind: double n plus or minus 1, half of the next even number, near double n plus or minus 1, or another pile for fair or not. Replace the reorder (Goes.tsx:185).

### Part 5: Pipi
Sister: a different split of the same whole, or the same kind with a new whole (not the same key). Replace the reorder (Goes.tsx:182-187).

### Part 6: Beanstalk
Sister: ask for the partner of a different on-screen leaf that has a partner. This works with the existing replay because taps are only leaf pairs (shared/beanstalk/round.ts:187-223). Change Round.tsx:138-139 so the anchor is a different leaf and `WORDS.nowTry(n)` (words.ts:80) uses its number.

## 4. Files affected
Per game: `shared/<game>/round.ts` (the sister helper), `shared/<game>/play.ts` if replay needs it (as S16 says), `src/games/<game>/Goes.tsx` (or Hops.tsx, Round.tsx), `words.ts`. Tūī also words.ts. The kit change is in S16.

## 5. Database / migration needs
None expected. If S16 needs one, follow S16.

## 6. Test steps
For each game (no more than 8):
1. The sister is never the same key as the question just shown.
2. The sister has the same kind and help level.
3. Same seed and index gives the same sister.
4. The server replay accepts a redo tap on the sister.
5. A wrong redo does not score.
6. The look together ends by 12 s and the skip shows after 3 s.
7. Tūī: a redo gets the plain line, a first try the usual praise.
8. `npm run build:functions` passes.

## 7. Size and impact
Size M. Impact High: the child has to work it out, not copy.

## 8. Session prompt (ready to paste)

### Part 1: Weka
```text
Create branch s32-weka-sister-question from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S32-now-you-try-sister-question-older-games.md (Part for Weka).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Write sisterOf in shared/weka/round.ts. 2. Use it in lookTogether. 3. Follow S16 for the redo tap.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Tūī
```text
Create branch s32-tui-sister-question from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S32-now-you-try-sister-question-older-games.md (Part for Tūī).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Write sisterOf (different n, same way). 2. Use it in the redo. 3. Add WORDS.rightRedo and use it when redo is true. 4. Follow S16 for the redo tap.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Hop
```text
Create branch s32-hop-sister-question from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S32-now-you-try-sister-question-older-games.md (Part for Hop).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Write sisterOf (different key, same step and direction). 2. Use it in the redo instead of worms reshuffling. 3. Follow S16.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 4: Penguin Pairs
```text
Create branch s32-penguin-sister-question from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S32-now-you-try-sister-question-older-games.md (Part for Penguin Pairs).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Write sisterOf (neighbouring n, same kind). 2. Use it in the redo. 3. Follow S16.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 5: Pipi
```text
Create branch s32-pipi-sister-question from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S32-now-you-try-sister-question-older-games.md (Part for Pipi).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Write sisterOf (different split). 2. Use it in the redo. 3. Follow S16.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 6: Beanstalk
```text
Create branch s32-beanstalk-sister-question from origin/main.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S32-now-you-try-sister-question-older-games.md (Part for Beanstalk).
Do not touch shared/maths, src/maths, src/styles.css or src/components from this branch.
Steps:
1. Pick a different on-screen leaf with a partner as the anchor. 2. Use it in the redo and nowTry. 3. Follow S16.
Tests:
Write the tests listed in section 6 of the plan (no more than 8). Run npm test, npm run build and npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```
