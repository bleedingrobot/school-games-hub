# S1: Robin's Berry Basket: the right card can be in any place

**Game:** Robin's Berry Basket
**What's wrong:** On "How many?" and "One more" the right answer is the third of four cards about 95% of the time. A child who always taps the third card passes the step gate without counting.
**What done looks like:** Play 20 card goes. The right card is first, second, third and fourth about equally often. "One more" does not always have a "1" card.
**Size:** S
**Impact on learning:** Very high
**Waits for:** nothing

## 1. The problem

- Wrong cards are always the same few offsets from the answer. How many: `n+1`, `n-1`, `n-2` (`shared/robin/round.ts:221`; `n+4` "lots" is listed fourth and never used: `pickWrongs` keeps the first 3, `round.ts:189-195`). One more: `n`, `n+2` and `1` (`round.ts:216`).
- The cards are then sorted (`round.ts:217` and `round.ts:222`), so they read `[n-2, n-1, n, n+1]` (answer third) or `[1, n, n+1, n+2]` (answer third again).
- The evaluator's sim: at step 4 the answer was the third card in 2275 of 2392 card goes (95%). In play, the third card was right every time except n = 1 and n = 2 (`docs/reviews/maths-review-2/games/robin.md`, Maths fidelity).
- A child passes a step with 8 of 10 right at the first tap, twice (`shared/robin/progress.ts:46-53`, `config.ts:20-21`). So "tap the third card" moves a child up the ladder with no counting.
- Small answers are worse: n = 1 has no cards below it (a card below 1 is refused at `round.ts:192` and `round.ts:197`).

## 2. The rule behind it

LEARNING-DESIGN rule 1 ("The maths is the move"): no give-away choices, and nothing about the cards may let a child win without the idea. Rule 7: the wrong cards stay real slips (counted twice, missed one, said the number under the cloth), so a wrong tap still teaches. This plan changes where the right card sits, not what the wrong cards mean.

## 3. The change

All in `shared/robin/round.ts`, in `pickWrongs` and the two places that call it (`showGo`, `round.ts:216` and `round.ts:221`). No change to `Go`, `Slip` or the taps, so no server or database change.

1. Name the near misses on each side of the answer, nearest first.
   - **How many** (answer `n`): below = `n-1` (skip), `n-2` (row), `n-3` (near), `n-4` (near). Above = `n+1` (double), `n+2` (near), `n+3` (near), `n+4` (lots).
   - **One more** (answer `m = n+1`): below = `n` (same), `n-1` (near), `n-2` (near). Above = `n+2` (again), `n+3` (near), `n+4` (near). The "1" card (`one`) is kept as an occasional swap, see step 4.
   - Drop any value below 1 or above `MAX_CARD` (30) before choosing.
2. Pick the answer's place first, so it is spread evenly. `p` = how many wrong cards sit below the answer, `0..3`. Choose `p` at random (from the go's seeded `random`) among the values where `p <= below.length` and `3 - p <= above.length`. This keeps every go valid.
3. Take the `p` nearest from below and the `3 - p` nearest from above. Tag them with the slip name they carry above. Then sort all four cards, as now (`round.ts:217,222`). The answer's place in the sorted row is now `p` (first to fourth).
4. One more only: with chance 1 in 4 (drawn from the seeded random), if `p >= 1` and the lowest below card is more than 1 away from 1, replace the lowest below card with `1` (slip `one`). So "1" shows up sometimes, never always.
5. Check the tells (rule 1). The four cards must have at most 2 sharing the answer's parity (use `atMostShareTell(answer, choices, (n) => n % 2)` from `shared/kit/mistakes.ts:39`). Four consecutive numbers always pass; the "1" swap can fail (for example `[1, 7, 8, 9]` is fine for answer 8, not for 9). If a pick fails, draw again (up to 6 tries), then fall back to no `1` swap.
6. Small answers: n = 1 has nothing below, so its answer can only be first; n = 2 first or second. That cannot be fixed without a "0" card, so leave it. Do not special-case.
7. Same seed must still give the same cards (the server replays the round from the seed). Only use the go's `random`, in a fixed order.
8. Open rounds: a round already started before the function is redeployed would replay with different cards. Redeploy outside school hours (Mon to Fri 8:45 to 3:00 NZ), and the redo cards (`redoCards`, `round.ts:255`) need no change.

Kit parts used: `tagWrongs` and `atMostShareTell` (`shared/kit/mistakes.ts`), already imported.

Child-facing words and voice lines: none change. The slip lines (`words.ts:37-50`) stay.

## 4. Files affected

- `shared/robin/round.ts` (`pickWrongs`, the two calls in `showGo`).
- `shared/robin/robin.test.ts` (fold the check into the existing test).
- `supabase/functions/robin/index.ts`: rebuilt by `npm run build:functions` in the same PR (shared code is bundled in).
- No kit file changes. `scripts/robin-sim.mjs` may be used to check the spread (read-only).

## 5. Database / migration needs

None. The function bundle must be redeployed at go-live: that is a live step, so it needs James's OK.

## 6. Test steps

Robin already has 8 tests (6 in `shared/robin/robin.test.ts`, 2 in `src/games/robin/voiceLines.test.ts`). The limit is 8 per game, so **do not add a ninth**: extend the existing test "the wrong cards" (`robin.test.ts:107-136`).
- Keep its checks (never the answer, all different, named slips match; the `one` and `lots` offsets still hold).
- Add: for every card key, seeds 1 to 1000, count where the right card sits in the sorted `choices`. For all card keys together, no place has more than 40% of goes. For keys with answer 4 or more, each place is above 15% and below 40%. At most 2 of the 4 cards share the answer's parity.
- Add: across counton keys, the `1` card appears in some goes and is missing from some goes.
- Run `npm run build:functions`, `npm test -- robin`, `npx tsc --noEmit`.
- By playing the preview (`npm run robin:preview` or the game's preview script): play 5 days of How many and One more. The right card must move around. n = 1 and n = 2 may still be first.

## 7. Size and impact

S: one function, one test, a rebuild. Very high: it closes the loophole that lets a child pass steps without counting.

## 8. Session prompt (ready to paste)

```text
You are fixing Robin's Berry Basket in the School Games Hub repo (/Users/jriley/games-hub-trader-captains or a fresh worktree).
Create branch fix/robin-answer-place from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 1 and 7) and docs/plans/maths-review-2/S1-robin-answer-place.md first, then docs/reviews/maths-review-2/games/robin.md.

Goal: on How many and One more the right card must be in any place, not nearly always third.
Steps:
1. In shared/robin/round.ts rewrite pickWrongs and its two calls in showGo as in plan section 3: below and above near-miss lists, choose how many wrongs sit below (p) at random from the seeded random among valid values, take nearest first, tag the named slips, sort. One more: swap the lowest below card for "1" with chance 1 in 4. Keep at most 2 of 4 cards sharing the answer's parity. Same seed gives the same cards.
2. Do not add a ninth test (Robin is at 8). Extend the existing "wrong cards" test in shared/robin/robin.test.ts: over 1000 seeds per card key no place above 40% overall, spread above 15% for answers of 4 or more, parity tell at most 2, and the "1" card sometimes present and sometimes not in One more.
3. Run npm run build:functions in the same PR (supabase/functions/robin/index.ts), then npm test, npx tsc --noEmit and lint.
4. Run the preview and play a few card goes by hand to see the answer move.
Do not touch shared/maths, src/maths, src/styles.css, src/components or any kit file. Do not change the taps, the Slip type or the database.
Stop and tell James before any live step (redeploying the robin function; do it outside school hours). Open a PR when done.
```
