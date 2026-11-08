# S36: Weka, Tūī, Penguin Pairs, Pipi: small fixes

**Game:** Weka's Stepping Stones (Part 1), Tūī's Ten Tree (Part 2), Penguin Pairs (Part 3), Pipi's Beach (Part 4)
**What's wrong:** A handful of small things found in the second review. Weka's pebble step now needs a Check tap and its split steps only say "Try again!". Tūī's start step ignores the "ten less" facts and some picture-thinning code is never used. Penguin Pairs' "fair or not" is wordy with a choice that is never right. Pipi sometimes offers a shell bigger than the whole.
**What done looks like:** In Weka a right pebble count finishes by itself, a wrong split number says why, and a child who knows a fact skips the pebbles and split. Tūī starts a child by both kinds of fact and the dead code is gone. Penguin Pairs asks "Is it fair?" with two choices and a clear wrong-tap line. Pipi never shows a shell larger than the number of pipi.
**Size:** S
**Impact on learning:** Low to Med
**Waits for:** nothing. (Checked: no other plan owns these items. S35 Part 1 changes the same Tūī files, `shared/tui/round.ts` and `src/games/tui/Goes.tsx`, so do Part 2 of this plan first or rebase after S35. Weka and Penguin Pairs are not in S35.)

Each part is its own branch and PR. Every item below was read in the code first. Two of the review's claims are only partly true and are marked.

## 1. The problem

### Part 1: Weka

- **(a) The five-part go and Check. True.** A full-help go can have five parts in a row: (1) pick how many hops to the big rock (`step === 'toTen'`, help only, `src/games/weka/Goes.tsx:293-310`), (2) pick the answer (`Goes.tsx:312-317`), (3) drag the silver pebbles across, (4) tap Check, (5) fill in the split in two taps (`afterPebbles` and `pickBond`, `Goes.tsx:336-343, 395-410`). Parts 3 and 4 came from R9 (#292, `Pebbles.tsx`). A right count does nothing until Check is tapped: `if (moved === go.toTen) return finish(...)` is inside `check()` (`Pebbles.tsx:95-97`), and nothing calls it by itself. For a 5 to 7 year old who already knows the answer this is a long way round the same question, with a button that adds no thinking: the child has already done the counting by moving the right number.
- **(b) Split and bond steps only say "Try again". True for these two steps.** `pickSplit` says `WORDS.tryAgain` on the first wrong tap (`Goes.tsx:374`; the second wrong tap counts together or says the stem) and `pickBond` says it on every wrong tap (`Goes.tsx:403`). Neither step has any wrong-number kinds, unlike the answer step (`wrongKind(go.wrongs, n)`, `Goes.tsx:282-287`). The four numbers offered come from `toTenChoicesFor(target)`: the target, +1, −1, +2 (`shared/weka/round.ts:249-256`). *Not true* for the hops-to-ten step: it has tagged wrong numbers (`toTenWrongsFor`, `round.ts:239-245`) and lines (`words.ts:46-47`, `whyTen`, `whyNear`); it only says "Try again!" when a number has no tag (`Goes.tsx:283`).
- **(c) No shorter go for a child who knows it. True.** After a right answer the go always goes on to pebbles when help is `full` or `split` and the go is not a hop-back (`Goes.tsx:331`, `pebblesFor`, `round.ts:55`), then to the split unless the child split first (`afterPebbles`, `Goes.tsx:336-343`). Nothing looks at whether the answer was a right first tap. The help ladder (`round.ts:131-147`: full until box 2 and quickDays 2, then split-first until box 4 and 8 right, faint until 12 right, then none) means a quick, right child still does all five parts for many days.

### Part 2: Tūī

- **(d) Start step and "secure". The start step is true; "secure" is not true.** `startFor` counts only the "ten and" facts: `KEYS.filter(...)` over `tenand:1..9`, `>= KNOWN_FACTS` (7) gives `KNOWN_START` (step 3, level 4) (`shared/tui/round.ts:77-80`). After R9 split the keys, the "ten less" facts (`LESS_KEYS`, `round.ts:46`) are ignored, so a child who knows "10 + 4" but has never met "14 − 10" starts at step 3 and level 4 and meets the subtraction ways with little help. `topSecure` is fine already: it counts all 18 keys (`round.ts:126-130`, 13 of 18). No change there.
- **(e) Dead picture-thinning code. True.** `pictureFor` returns `nests` and thins it to two on the third wrong tap (`round.ts:315, 325-329`, comment `round.ts:306-310`). The only caller (`src/games/tui/Goes.tsx:89-92`) reads `pic.level` and `pic.peekOpen` only; the nest list is `go.choices` (reversed on a redo, `Goes.tsx:191`). It stays dead on purpose: `round.ts:238-239` keeps four nests at every level (maths review R5; "it was three while every berry was drawn"). The tests that still check it are `shared/tui/tui.test.ts:93, 99-100`.

### Part 3: Penguin Pairs

- **(f) Fair or not is untidy. True, four things.**
  - The written line is long: `` `${go.n} fish: share them, then fair or not?` `` (`src/games/korora/Goes.tsx:301`).
  - Three choices, "Fair share", "One too many", "One too few" (`words.ts:58-61`, `Goes.tsx:83-84`). `FAIR_CHOICES = [1, 0, 2]` and the comment at `shared/korora/round.ts:245-246` says 2 ("one too few") is never right.
  - A wrong choice has no mistake behind it: `wrongs: []` for fair goes (`round.ts:307`), so `kind` is undefined and the only words are "Try again!" (`Goes.tsx:218-227`); the second wrong choice says "Let's pair them off" and shows the pairing hint (`words.ts:64`, `Goes.tsx:221-222`).
  - The pile is a real 6 to 10 fish at levels 1 and 2 and 6 to 20 from level 3 (`fairKeys`, `round.ts:62-66`); the maths is odd or even, shown only by choices that hide it.

### Part 4: Pipi

- **(g) Wrong shells bigger than the whole. True.** `threeWrongs` (`shared/pipi/round.ts:196-208`) builds wrong shells from the slips plus a near miss and fillers `answer + 2`, `answer − 2`, `answer + 3` (line 200). For a "hiding" go the slips are the number showing, the whole, and the whole plus the number showing (`round.ts:222`), and the last can be far above the whole: whole 9 with 9 showing offers 18, whole 5 with 5 showing offers 10, whole 7 with 4 showing offers 11. The fillers can also pass the whole (whole 5, 4 hiding: 6 and 7 are possible). A child can rule these out by size alone, and the guessing chance rises from one in four to one in three. The same fillers affect "two tides" (`round.ts:225-234`, answer is also at most the whole). "Altogether" is different: its answer is the whole and one more is a fair near miss (`round.ts:237`). Leave it.

## 2. The rule behind it

- Rule 1 (the maths is the move) and rule 7 (mistakes teach): a wrong tap says why on the same picture, never the answer (Weka b, Penguin Pairs f). A button that only confirms a count the child has already got right is not maths (Weka a).
- Rule 5 (help follows the child): a child who knows it does not do every help step (Weka c, and Tūī d starts by both kinds of fact).
- Rule 1 again (guessing must not work): every shell must be a possible answer, so size alone cannot rule one out (Pipi g).
- Plain code tidiness (Tūī e) so the next person does not think nests thin.

## 3. The change

### Part 1: Weka

**(a) Check.** In `Pebbles.tsx` finish a right count by itself. When `moved === go.toTen` and the child has not touched a pebble for 1.2 seconds, call `finish(pebbleRightLine(go))` with the same sound and voice line. Keep the Check button for the other cases: the child taps it for too few or too many and gets `pebbleFewLine` or `pebbleManyLine` as now; the second wrong Check still moves the right number across (`Pebbles.tsx:101-104`). A hand points at Check after `HINT_MS` when the count is wrong and the child stops. This keeps the real choice (the child still decides the number) and removes the tap that proves nothing. `onFirstWrong` still fires on a wrong Check only. Do not auto-finish while a drag is in progress. Update the header comment (lines 1-10) to match.

**(b) Why lines for the split and bond steps** (`words.ts`, `voiceLines.ts`, `Goes.tsx:374, 403`). The numbers said are the number the child tapped; none says the answer. After the first wrong tap, say one of these instead of "Try again!". Say it once, and keep the second wrong tap as it is now in `pickSplit` (count together or the stem line); in `pickBond` the second wrong tap says the same line again.
- First part of the split (the part that gets to ten, `bond === 0`):
  - Add goes (`go.kind` is not `back`), `n` is the number tapped: "`{big}` and `{n}` make `{big + n}`. We need to land on 10." Example 8 + 5 with a tap of 3: "8 and 3 make 11. We need to land on 10."
  - Hop-back goes: "`{from}` take away `{n}` is `{from − n}`. We need to land on 10." Example 13 − 5 with a tap of 2: "13 take away 2 is 11. We need to land on 10."
- Second part of the split (the rest, `bond === 1`): "`{toTen}` and `{n}` make `{toTen + n}`. We have `{small}`." Example 8 + 5, 2 already used, tap of 2: "2 and 2 make 4. We have 5." This is the same sentence shape as `whyPart` (`words.ts:42`).
- Add the three lines as `whySplitFirstAdd`, `whySplitFirstBack` and `whySplitRest` in `words.ts`, say them from `pickSplit` and `pickBond`, and show the wrong number greyed (as the answer step does). Add every combination to `allVoiceLines` in `voiceLines.ts` the way `whyLine` is enumerated (the numbers are small, 1 to 9 and totals up to 18) and make the clips with `scripts/voice-clips.py` (Kokoro af_bella) into `public/voice/weka/`. `HearAgain` (`Goes.tsx:454`) must say the new line while it is showing. Hop-back goes do reach the split: `afterPebbles` has no kind check (`Goes.tsx:336-343`). If playing shows otherwise, drop the back line.

**(c) A shorter go.** In the right-answer timer (`Goes.tsx:329-332`), skip pebbles and the split when all of these are true: the child's first tap on the answer was right (`!firstWrong`), no wrong tap was made on the hops step, and the go is not the very first guided go (`guided`). Then go straight to `nextGo()` after the hop. Otherwise nothing changes: a child who missed it, or is on the guided go, still does every part. The pebbles and split are help only and never sent (`Goes.tsx:296, 395`), so no saved record or server rule changes, and the help level (set by the saved facts) still falls by itself as quick right answers add up. Keep one pebble go in five (the go index divisible by five) for everyone on full help so the pebble idea is not lost; the rule must be in a small pure function in `shared/weka/round.ts` (for example `skipPracticeFor(firstRight, guided, goIndex)`) so it can be tested.

### Part 2: Tūī

**(d) Start step.** In `startFor` (`shared/tui/round.ts:77-80`) count both sets: the child starts at `KNOWN_START` only if at least 7 of the nine "ten and" facts **and** at least 7 of the nine "ten less" facts are at box 2 or more. Otherwise `{ step: 1, level: TOP_LEVEL }` as now. Use `LESS_KEYS`. `topSecure` stays as it is. Update the comment above `startFor`. A child with only "ten and" known starts at step 1, which is the safe side (the day's first go is the guided `tenand:2`, so nothing breaks).

**(e) Dead code.** Delete the `nests` field and the thinning from `pictureFor` (`round.ts:312-329`), so it returns `{ level, peekOpen }`. Drop the third parameter `tapped` if nothing else uses it (check `Goes.tsx:89`: it passes `tapped`; remove the argument there too). Fix the comment at `round.ts:306-310` (remove "the third fades the wrong nests to leave two") and keep the comment at `round.ts:238-239`. Edit `shared/tui/tui.test.ts:93, 99-100` to stop checking `nests`. Leave the header of `Goes.tsx` (lines 9-12) as it is.

### Part 3: Penguin Pairs

Make fair or not a two-way choice with plain words. All of this is in the game's own files.
1. **Choices.** `FAIR_CHOICES` becomes `[1, 0]` (`shared/korora/round.ts:245-246`, and the shuffle at line 307). Remove the "one too few" label and `WORDS.tooFew`. The labels are "Fair" and "One left over" (`words.ts:59-60`; `fairLabel` at `Goes.tsx:83-84`). Records are unchanged: the fact keys stay `oddeven:n`, the answer is still 1 for an even pile and 0 for an odd one.
2. **One picture each.** On each choice show a tiny picture: for "Fair", two bowls with the same fish; for "One left over", two bowls with one fish on its own. Use the existing fish art and `FairPile.tsx` (read it first; keep the button 64 px or more).
3. **Written line.** Replace `` `${go.n} fish: share them, then fair or not?` `` (`Goes.tsx:301`) with `` `${go.n} fish. Is it fair?` ``. Keep the voice line the same short sentence (`spokenFor` in `round.ts`, check the clip names for the fair lines).
4. **Wrong tap line.** After the first wrong choice say "Count the fish in one bowl." (new `WORDS.countOneBowl`) instead of "Try again!" (`Goes.tsx:219-221`). After the second wrong choice keep the pairing-off hint (`WORDS.pairOff`, `pairHint`). The words never say which choice is right.
5. Update `voiceLines.ts` (the fair lines at lines 55-61) and make the new clips with `scripts/voice-clips.py` into `public/voice/korora/`. Remove clips that no line uses.

### Part 4: Pipi

In `showGo` (`shared/pipi/round.ts:196-234`): for "hiding" and "twoTides" goes only offer shells that are at most the whole.
1. Remove the `add` slip from the hiding slips (`round.ts:222`). Keep `shown` and `whole`.
2. In `threeWrongs`, pass the whole as a limit and drop any slip, near miss or filler above it. Fill with the existing near miss and the other one-off and two-off numbers below the answer first (`answer − 1`, `answer − 2`, `answer − 3`), then `answer + 1`, `answer + 2` only if they are at most the whole, then any other number from 0 to the whole as a last fall-back. The pool is always at least three numbers: the smallest whole is 3 so there are four numbers from 0 to 3.
3. Keep the other rules: never the answer, no repeat, no negative, at most two shells sharing the answer's odd or even (`atMostShareTell`), and always one near miss. The "altogether" go keeps its own rules and its `whole + 1` shell.
4. The `add` kind and its words (`words.ts:65`, `WhyPicture.tsx:44`) are never produced after this. Take `'add'` out of the allowed list in `shared/pipi/pipi.test.ts:96` and out of the hiding list in `src/games/pipi/voiceLines.ts:47`; leave the type and the words (spare clips cost nothing).

## 4. Files affected

All in each game's own files; none in `shared/kit`, `shared/maths`, `src/maths`, `src/styles.css` or `src/components`.
- **Weka:** `src/games/weka/Pebbles.tsx`, `src/games/weka/Goes.tsx`, `src/games/weka/words.ts`, `src/games/weka/voiceLines.ts`, `shared/weka/round.ts` (the skip rule), `shared/weka/weka.test.ts`, `public/voice/weka/` (new clips). No function rebuild needed unless `shared/weka` is part of the built function: run `npm run build:functions -- weka` and commit the result if it changes.
- **Tūī:** `shared/tui/round.ts`, `src/games/tui/Goes.tsx`, `shared/tui/tui.test.ts`. `npm run build:functions -- tui` in the same PR (`startFor` runs on the server, `shared/tui/server.ts:99-102`).
- **Penguin Pairs:** `shared/korora/round.ts`, `src/games/korora/Goes.tsx`, `FairPile.tsx`, `words.ts`, `voiceLines.ts`, `src/games/korora/kororaFair.test.tsx`, `public/voice/korora/`. `npm run build:functions -- korora` if the built copy changes.
- **Pipi:** `shared/pipi/round.ts`, `shared/pipi/pipi.test.ts`, `src/games/pipi/voiceLines.ts`. `npm run build:functions -- pipi` if the built copy changes.

## 5. Database / migration needs

None. No saved shape changes. The Tūī start step runs on the server (`startFor` in the load for a new child), so rebuild the Tūī function; no migration.

## 6. Test steps

Inside the 8-per-game limit; edit existing tests first.
- **Weka (3):** (1) a pure function for the skip rule: right first tap not guided skips, a wrong first tap or the guided go does not, and one go in five keeps pebbles; (2) the new split why lines say the tapped number and never the answer; (3) `allVoiceLines` includes the new lines (the existing voice-lines test).
- **Tūī (3):** (4) `startFor`: 7 of 9 "ten and" only gives step 1; 7 of 9 each gives step 3 level 4; (5) edit the `pictureFor` test (lines 93, 99-100) to check level and peek only; (6) `topSecure` still counts 18 (existing).
- **Penguin Pairs (2):** (7) fair goes have two choices, 1 and 0, in a seed-fixed order; the wrong tap says "Count the fish in one bowl." and the second wrong tap the pairing line; (8) the voice lines test includes the new lines.
- **Pipi (1):** edit the existing wrong-shells test (`pipi.test.ts:98-119`): for hiding and twoTides every shell is at most the whole, as well as the existing checks (four distinct, at most two share a tell, a near miss).

Play the preview:
- Weka (`npm run weka:preview`): a full-help go: drag the right number of pebbles and see it finish without Check; drag too few and tap Check; a wrong split number says its line; a go answered right first time skips to the next go; the guided first go does all parts. At 375 px wide.
- Tūī (`npm run tui:preview`): a new child with only "ten and" facts at box 2 starts at step 1.
- Penguin Pairs (`npm run korora:preview`): a gold day, two choices with their pictures, the written line, a wrong tap, a second wrong tap.
- Pipi (`npm run pipi:preview`): play several rounds at every level and check no shell is bigger than the number of pipi.

## 7. Size and impact

S: four small changes in four games, all in their own files. Low to Med: each is a nicer, clearer go (shorter for strong children, why for a wrong tap, no silly shells) rather than a new idea.

## 8. Session prompt (ready to paste)

Each part is separate. Do Part 2 first if S35 Part 1 is not merged yet, so S35 rebases on it.

### Part 1: Weka

```text
You are making small fixes to Weka's Stepping Stones in the School Games Hub repo.
Create branch fix/weka-small-fixes from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 1, 5, 7) and docs/plans/maths-review-2/S36-small-fixes-older-games.md (Part 1) first.

Steps (details in the plan, sections 1 and 3, Part 1):
1. src/games/weka/Pebbles.tsx: when the child has moved exactly the right number of pebbles and has not touched one for 1.2 seconds, finish by itself with the same sound and line as a right Check. Keep Check for wrong counts (too few or too many lines, the second wrong Check moves them across). Do not auto-finish during a drag. Update the header comment.
2. src/games/weka/words.ts, Goes.tsx (pickSplit about line 374, pickBond about line 403), voiceLines.ts: replace "Try again!" on a wrong split number with the three why lines in the plan (first part add, first part hop-back, rest). They say the tapped number, never the answer. Grey the wrong number. Add every combination to allVoiceLines, make the clips with scripts/voice-clips.py (Kokoro af_bella) into public/voice/weka/. HearAgain says the new line.
3. shared/weka/round.ts: a small pure function for a shorter go (skip pebbles and split after a right first tap with no wrong hops tap, never on the guided go, but keep pebbles on one go in five). Use it in the right-answer timer in Goes.tsx (about line 329).
4. Run npm run build:functions -- weka and commit the result if it changes.
Tests (the game stays at 8 or fewer, aim for 3): the skip rule; the why lines say the tapped number and never the answer; the voice-lines test.
Do not touch shared/kit, shared/maths, src/maths, src/styles.css or src/components. No database change.
Check in the preview at 375 px wide (drag the right number and see it finish, too few then Check, a wrong split number, a go right first time). npm test, npx tsc --noEmit, lint.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Tūī

```text
You are making small fixes to Tūī's Ten Tree in the School Games Hub repo.
Create branch fix/tui-small-fixes from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 5 and 7) and docs/plans/maths-review-2/S36-small-fixes-older-games.md (Part 2) first.

Steps (details in the plan, sections 1 and 3, Part 2):
1. shared/tui/round.ts startFor (about line 77): start at KNOWN_START only when at least 7 of the nine tenand facts AND at least 7 of the nine tenless facts (LESS_KEYS) are at box 2 or more; otherwise step 1, level 5. Fix its comment. Leave topSecure alone (it already counts all 18).
2. Remove the dead picture-thinning: pictureFor returns only level and peekOpen (no nests, no tapped argument), fix the comment above it, update the call in src/games/tui/Goes.tsx (about line 89). Keep the four nests at every level (round.ts about line 238).
3. Edit shared/tui/tui.test.ts (about lines 93 and 99-100) so it no longer checks nests; add a startFor test.
4. Run npm run build:functions -- tui in the same PR.
Tests (stay within 8 for the game, aim for 3): startFor with only tenand known gives step 1, with both gives step 3 level 4; the edited pictureFor test; topSecure unchanged.
Do not touch shared/kit, shared/maths, src/maths, src/styles.css or src/components. No migration.
Check in the preview (npm run tui:preview). npm test, npx tsc --noEmit, lint.
Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Penguin Pairs

```text
You are tidying "fair or not" in Penguin Pairs in the School Games Hub repo.
Create branch fix/korora-fair-tidy from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 1, 2, 7) and docs/plans/maths-review-2/S36-small-fixes-older-games.md (Part 3) first, then read src/games/korora/FairPile.tsx and Goes.tsx.

Steps (details in the plan, section 3, Part 3):
1. shared/korora/round.ts: FAIR_CHOICES becomes [1, 0] (fair, one left over), fix the comment and the shuffle at about line 307. Remove WORDS.tooFew. Records and keys (oddeven:n) do not change.
2. src/games/korora/words.ts, Goes.tsx, FairPile.tsx: labels "Fair" and "One left over", each with a tiny picture (two equal bowls; two bowls with one fish alone), buttons 64 px or more. The written line becomes "N fish. Is it fair?".
3. First wrong choice says "Count the fish in one bowl." (new WORDS.countOneBowl) instead of "Try again!". Second wrong choice keeps the pairing-off hint. Nothing says which choice is right.
4. Update voiceLines.ts (fair lines) and make the new clips with scripts/voice-clips.py (Kokoro af_bella) into public/voice/korora/; remove clips that no line uses.
5. Run npm run build:functions -- korora and commit the result if it changes.
Tests (the game stays at 8 or fewer, aim for 2): fair goes have two choices; the wrong-tap lines; the voice lines test.
Do not touch shared/kit, shared/maths, src/maths, src/styles.css or src/components. No database change.
Check on a gold day in the preview at 375 px wide. npm test, npx tsc --noEmit, lint.
Stop and tell James before any live step. Open a PR when done.
```

### Part 4: Pipi

```text
You are fixing silly wrong shells in Pipi's Beach in the School Games Hub repo.
Create branch fix/pipi-wrong-shells from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 6 and 7) and docs/plans/maths-review-2/S36-small-fixes-older-games.md (Part 4) first.

Steps (details in the plan, section 3, Part 4):
1. shared/pipi/round.ts: for hiding and two tides goes, never offer a shell above the whole. Remove the add slip (about line 222). Pass the whole into threeWrongs (about line 196) and drop any slip, near miss or filler above it; fill with answer minus 1, 2, 3 first, then answer plus 1 or 2 only if at most the whole, then any other number from 0 to the whole. Keep: never the answer, no repeat, no negative, at most two shells sharing the answer's odd or even, always one near miss. Altogether goes keep their own rules.
2. Take 'add' out of the allowed list in shared/pipi/pipi.test.ts (about line 96) and the hiding list in src/games/pipi/voiceLines.ts (about line 47). Leave the type and the words.
3. Extend the existing wrong-shells test (about lines 98 to 119): for hiding and twoTides every shell is at most the whole.
4. Run npm run build:functions -- pipi and commit the result if it changes.
Do not touch shared/kit, shared/maths, src/maths, src/styles.css or src/components. No database change.
Check in the preview at every level: no shell is bigger than the number of pipi. npm test, npx tsc --noEmit, lint.
Stop and tell James before any live step. Open a PR when done.
```
