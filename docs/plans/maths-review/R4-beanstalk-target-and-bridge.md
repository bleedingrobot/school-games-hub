# R4: Beanstalk: show the target, no duplicate numbers, a bridge from 10 to 100

**Status (7 Nov 2026):** LIVE 7 Nov 2026 (#251). One change from the plan, James's pick: when the only waiting pairs share a number with one floating, the pair **waits** instead of coming in anyway (with "next in order", about 56% of rounds would still show a repeated number near the end). So near the end there can be 4 or 2 leaves floating. The 18 bridge clips are recorded (Kokoro af_bella).

## 1. The problem
Three things make Kiwi's Beanstalk harder to understand or too easy to beat.

1. **The target is never written on the play screen.** "Tap two leaves that make 10" is only spoken and sits in a hidden heading (`src/games/beanstalk/Round.tsx:114`, class `bs-sr`). With Voice off, or a muted tablet, a child has nothing on screen saying whether this beanstalk is 10, 100 or 1000.
2. **The same number can float twice.** Leaves are a fixed list, pair by pair (`shared/beanstalk/round.ts:57-60`, `floating` at line 89). The evaluator saw 6, 2, 8, 4, 3, 7 then 2, 8, 6, 4, 6, 4: a child can match "the same looking" numbers and tick them off, which hides whether they know the bond. (Evaluation, problem 3.)
3. **The jump from 10 to 100 has no bridge.** The first day on the next beanstalk (after 30 days, `shared/beanstalk/progress.ts:19`, `targetFor`) goes straight to 70 + 30 with only a line of words, and the guide hand (`BeanstalkGame.tsx:137`, `guide={state.daysDone === 0 && state.lastLeafDay === null}`) is only for the very first ever go. The evaluator saw 50, 80, 20, 90 with "10 each" under each. (Evaluation, problem 5; DECISIONS.md gives this a Med impact.)

Live data (DECISIONS.md): 15 pupils, 29 rounds, 3.2 wrong taps per round, 14% of rounds with 10 or more wrong taps (guessing).

## 2. The research behind it
Seeing the target as well as hearing it supports children who miss the voice (research-design.md, clarity and one-thing-at-a-time). Bonds to 100 are the same idea in tens, and children need to see the link: "7 tens and 3 tens make 10 tens" (research-maths.md, place value and bonds to 100). Duplicate numbers invite matching by looks instead of by sum.

## 3. The change

### 3a. Show the target
1. In `Round.tsx` add a visible badge above the tray: the words "Make" and a big **"= 10"** (or 100, 1000), in the leaf-number font, with a small "Hear it again" button that calls `say(WORDS.tapTwo(target))`. Hide the old heading from sight only (it stays for screen readers).
2. Words (new, in `words.ts`): `makeTarget: (target) => 'Make ' + target`, `hearAgain: 'Hear it again'`. The spoken line is the existing `tapTwo(target)`, so no new voice clip is needed.
3. Styles in `beanstalk.css` (the game's own file): high contrast (the game already has a 4.5:1 colour test), 44px tap target for the button, no animation when the pupil prefers less motion.

### 3b. No duplicate numbers on screen
Rule: no number is on screen twice, except the 5 + 5 pair, where the two 5s are the answer itself.
1. In `shared/beanstalk/round.ts` the pair order stays as made (so the maths records and tests don't change), but the **order leaves arrive** changes. Keep a queue of pairs. On start, floating = the first three pairs whose numbers are all different (skip a pair whose numbers match one already chosen and take the next that doesn't). Each time a pair is made, bring in the next pair in the queue whose numbers are not on screen; if none is free (only the last pairs), take the next in order.
2. `floating` and `replay` compute this from the taps, so the server and the browser agree (the browser already uses `replay(round, taps).onScreen`; `Round.tsx` new-leaf code at line 80 takes whatever is newly on screen, so it keeps working). A leaf's index still means the same leaf; only the entry order changes.
3. Every floating set is still a set of whole bonds (the leaf and its partner), so the round can always be finished (the existing test checks this over 200 seeds).
4. Number sizes: the same rule works for 100 and 1000 because the leaves are the same numbers times 10 or 100.

### 3c. A bridge to 100 and 1000
Shown on the first challenge of a new beanstalk that is 100 or 1000 (`stalk.eggs > 0 && stalk.day === 0 && stalk.target > 10`; `BeanstalkGame.tsx:194` already knows this moment for the title).
1. Turn the guide hand on for that challenge: `guide = (first ever) || (new beanstalk, target above 10)`, with the hand's text for this case.
2. Show a one-line bridge above the tray: "Each dot is a ten. 7 tens and 3 tens make 10 tens. That is 100." (for 1000: "Each dot is a hundred. 7 hundreds and 3 hundreds make 10 hundreds. That is 1000."). It uses the right numbers for the first pair the hand points at, taken from the round's first partner pair, not always 7 and 3. Read aloud once at the start, then the normal `tapTwo` line.
3. The ten-frames are already full on day 1 of a beanstalk (`progress.ts` dots by day); keep that and keep the "10 each" label (`Leaf.tsx`).
4. Not in this plan: a few days of easy pairs (50 + 50, 20 + 80) before the full set, and bonds to 20. Those can be a later change if James wants more bridging.

### Child-facing words and voice lines (new)
- Badge: "Make 100" and the button "Hear it again" (the button speaks the existing `tapTwo` line).
- Bridge, 100: "Each dot is a ten. 7 tens and 3 tens make 10 tens. That is 100." Bridge, 1000: "Each dot is a hundred. 7 hundreds and 3 hundreds make 10 hundreds. That is 1000." (the first pair's numbers vary: `bridge(target, a, b)`; there are at most four first pairs per target).
- Add the bridge lines to `allVoiceLines()` in `voiceLines.ts`; refresh the lines list and have James run `scripts/voice-clips.py beanstalk` on the Mac for the new clips (Kokoro `af_bella`). Until then the browser voice reads them.

## 4. Files affected
All Beanstalk's own:
- `shared/beanstalk/round.ts` (arrival order) and `shared/beanstalk/beanstalk.test.ts`
- `src/games/beanstalk/Round.tsx`, `BeanstalkGame.tsx` (guide condition), `words.ts`, `voiceLines.ts`, `beanstalk.css`, `Leaf.tsx` (no change expected)
- `supabase/functions/beanstalk/index.ts` rebuilt (`npm run build:functions -- beanstalk`), because the round and replay are bundled into the server
- voice clips and the lines list `public/voice/beanstalk/`
Not touched: `shared/maths`, `src/maths`, `src/styles.css`, `src/components`.

## 5. Database / migration needs
None. A round is saved as a seed and replayed; no new column or function. One thing to know: the new arrival order is used when a round is replayed on finish, so a child in the middle of a round at the moment the function is deployed could have that one round refused. Merge outside school hours (Mon to Fri 8:45 to 3:00 NZ).

## 6. Test steps
Automated (the game has room under its 8):
1. `beanstalk.test.ts` round test: over 200 seeds and all three targets, at every step of a playthrough in the natural order and in a shuffled order of right pairs, no number is on screen twice except the two 5s of the 5 + 5 pair, and the round can still be finished.
2. Replay still refuses taps on leaves not floating, and gives the same answers for the same taps (the existing tests, updated for the new arrival order).
3. A screen test: the badge shows "Make 10", "Make 100" or "Make 1000" for the target, and the bridge shows only on a new 100 or 1000 beanstalk.

Play the preview (use the day skip to reach day 30): the badge is visible with Voice off; no number appears twice while playing a round; after the egg the first 100-beanstalk challenge shows the bridge line and the hand, and the day after it does not.

## 7. Effort and impact
S, Med. Three small changes; the visible target helps every child with Voice off, the arrival rule makes guessing by looks harder, and the bridge removes the biggest jump in the game.

## 8. Session prompt (ready to paste)
```text
Work in /Users/jriley/games-hub-isles. Create a new branch and worktree from origin/main called beanstalk-target-bridge. Read docs/GAME_DEVELOPMENT_GUIDE.md first, then docs/plans/maths-review/R4-beanstalk-target-and-bridge.md and follow it. Steps: (1) Round.tsx: a visible "Make 10/100/1000" badge above the tray with a Hear it again button (speaks the existing tapTwo line); keep the heading for screen readers; styles in beanstalk.css; words in words.ts. (2) shared/beanstalk/round.ts: change the order leaves arrive so no number is on screen twice except the 5+5 pair (first three pairs with different numbers; each new pair is the next in the queue whose numbers aren't on screen, else the next in order), computed in floating/replay so server and browser agree; the round must still always be finishable. (3) the bridge: on the first challenge of a new 100 or 1000 beanstalk, turn on the guide hand and show and speak the one-line bridge ("Each dot is a ten. 7 tens and 3 tens make 10 tens. That is 100.", with the first pair's real numbers; hundreds for 1000); add the lines to allVoiceLines in voiceLines.ts and refresh the lines list, and tell James the new clips need making with scripts/voice-clips.py beanstalk on his Mac. (4) tests as in the plan (no duplicates over 200 seeds and shuffled right-pair orders, replay unchanged, badge and bridge screens). (5) rebuild only the beanstalk function (npm run build:functions -- beanstalk) and commit its index.ts; run the checks. Do not touch shared/maths, src/maths, src/styles.css or src/components. Stop and tell James before any live step (merge outside school hours: a round in progress could be refused); open a PR when done.
```
