# S10: Parrot: wrong cards from near misses, and a redo with no silly card

**Game:** Parrot's See-saw
**What's wrong:** On card goes the right answer is the one number not written in the sum and never the biggest card, so a child can win by pattern. After two wrong tries the redo adds the huge "adds everything" card, so the redo is a choice between a silly card and the right one.
**What done looks like:** The four cards are the answer and numbers close to it, so the child has to think about the balance. The right card sits in every position in turn and is sometimes the biggest or the smallest. The redo offers the answer and the card nearest to it.
**Size:** S to M
**Impact on learning:** High
**Waits for:** S9 (same files, `shared/parrot/round.ts` and `parrot.test.ts`)

## 1. The problem

- **The wrong cards are fixed formulas.** `showGo` (`shared/parrot/round.ts:195-247`) lists four slips per kind, for example `miss`: `['all', a + b], ['copy', b], ['total', a], ['off1', answer ± 1]` (`:211`); `swap` (`:218`); `both` (`:224`); `sub` (`:231`, `:237`). Then `pickWrongs` (`:176-190`) takes only the first three: `.slice(0, count)`. So the fourth slip, `off1`, is never used.
- **So the cards are always the answer, the sum, and the two printed numbers.** Sampled round (`docs/reviews/maths-review-2/games/parrot.md` problem 1): `7 = 2 + ?` cards 2, 5, 7, 9, answer 5. 2 and 7 are printed, 9 is 2 + 7. "The right number is the one not written on the page and is never the biggest card." A child who learns "pick the number that is not in the sum, and not the biggest" never has to balance anything.
- **The redo can be silly.** `redoCards` (`round.ts:277-280`) keeps the answer and the first untried wrong card in ascending order (`go.choices.find(...)`), so the other card is often the small printed number or the big "all" card (evaluator problem 10: "the redo's second card is the obvious huge 'all' card ... no thinking").
- **No test guards the tell.** `shared/parrot/parrot.test.ts:86-110` checks that wrong cards match their slip and are distinct, nothing about where the answer sits or what tells it apart.

## 2. The rule behind it

- Rule 1 (the maths is the move): winning must need the idea. Tapping, or a pattern, must not work. The pattern here is "the unprinted number".
- Rule 7 (mistakes teach): a wrong card should be a real slip. An off-by-one or two is a real slip (counted one wrong). The big sum card is also real, but when two of four cards are printed numbers the printed-number tell outweighs it, so keep **at most one** printed-number card per go.
- Rule 4 (help arrives by itself) and the redo: after the look the child still has to choose.

## 3. The change

`shared/parrot` changes, so the edge function must be rebuilt (section 5). True-or-false goes (three fixed cards, `round.ts:241-246`) are unchanged.

**A. A new card builder.** Replace the `pickWrongs(answer, slips, ...)` call at `round.ts:249` with `nearWrongs(answer, slips, random, max)` (new, in `round.ts`, next to `pickWrongs`; delete `pickWrongs` if nothing else uses it). `max` is `MAX_STONES * 2` (40) as now.

1. **Pick the answer's place first.** The row is the four cards in ascending order, so the answer's rank is 0 to 3. List the ranks that can be built (rank `k` needs `k` cards below and `3 - k` above, all in `0..max`; for example answer 1 cannot have 2 cards below). Choose `k` uniformly from the buildable ranks with `random()`.
2. **Optionally one slip card (about half of goes).** If `random() < 0.5`, take the first of the go's printed-number slips (`copy` or `total`; the `all` card is never used) whose value is in range, is not the answer, and fits the rank (it counts toward the below or above side). Tag it with its slip kind.
3. **Fill the rest with near misses.** Draw the remaining cards from the offsets `answer - 3 .. answer + 3` (not 0, in range, not already used) so that `k` cards end below and `3 - k` above. Offsets of 1 are tagged `'off1'`; offsets of 2 or 3 are tagged `'near'`. If a near value happens to equal one of the go's slip values (`copy`, `total`, `all`, `dbl`), tag it with that slip's kind instead (so the teacher line stays true).
4. **Keep it hard to read from the cards.** Check each candidate set and retry (up to 40 times, with the go's seeded `random`):
   - exactly 2 of the 4 cards have the same parity as the answer (so the answer is never the odd one out), checked with `sharingTell(answer, cards, (n) => n % 2)` from `shared/kit/mistakes.ts:33`;
   - at most 2 cards share a last digit, `atMostShareTell(answer, cards, (n) => n % 10, 2)` (`mistakes.ts:39`);
   - at most one card is more than 3 away from the answer.
   If 40 tries fail, use a fixed fallback: for the chosen rank, the offsets `[-1, -2, +1]`, `[-1, +1, +2]`, `[+1, +2, +3]` or `[-1, -2, -3]` (rank 3, 1, 0, ... as fits), adjusted at the ends so the values are in range. The fallback never returns fewer than 3 wrong cards; `showGo` returns null otherwise as now (`:250`).
5. **The 3 wrong cards are the same on every replay**: they use only the go's seeded `random()` (`round.ts:195`), as today.

**B. The redo.**
6. `redoCards` (`round.ts:277`): keep the answer and the **untried wrong card nearest to the answer** (smallest `|c - answer|`; on a tie the lower one). If all wrong cards were tried, the nearest of them. The huge or far card is never offered.
7. The redo's hand (`pr-choice--hint`, evaluator problem 2 "the redo marks the answer") is not part of this plan.

**C. Slip names stay honest.** S9 added `slipOfPick` (`round.ts`), which names a stone count from the go's own totals. It still works with the new cards because it uses the go's `wrongs` first and the go's sums second. No change to `words.ts` or the voice lines (no new kinds, so no new clips).

**D. Tests (one new `it`, the 8th; the limit is 8).**
8. In `shared/parrot/parrot.test.ts` add `it('keeps the right card hard to spot: near cards, answer in every place, no printed-number pattern')`. Over every card key, every layout and 200 seeds (as `everyGo` in `src/games/parrot/voiceLines.ts` does for layouts; use `showGo` directly with a seed loop):
   - 4 cards, 3 distinct wrongs, none the answer, all in `0..40`;
   - the answer's rank in the sorted row is each of 0, 1, 2 and 3 between 15 and 40 percent of the time;
   - the answer is the biggest card in at least 15 percent of goes and the smallest in at least 15 percent;
   - exactly 2 cards share the answer's parity, and `atMostShareTell` on the last digit holds;
   - the "pick the card that is not printed and not the biggest" pattern (`printed` = the digits in `go.parts`) leaves on average at least 2.2 cards, so that guessing it right is about 45 percent or less (measure first, then set the number with some margin); also, the average of `1 / survivors` is 0.45 or less;
   - at most one wrong card is more than 3 from the answer.
9. Update the existing "never makes a wrong card the answer..." test (`:86`): `copy`, `total` and `all` cards may now be absent, so keep those assertions only inside `if (w.kind === ...)` (they already are), and keep `redoCards(g, [g.wrongs[0].n])` has length 2. Add: `redoCards` never returns a card more than 3 from the answer when a nearer untried one exists.
10. Check `scripts/parrot-sim.mjs:36` (`go.wrongs[0].n`) still works: it does, wrongs always has 3 items on card goes.

## 4. Files affected

- `shared/parrot/round.ts` (`nearWrongs`, call at `:249`, `redoCards` at `:277`, header comment)
- `shared/parrot/parrot.test.ts` (one new `it`, small edits)
- `supabase/functions/parrot/index.ts` (rebuilt; it bundles `shared/parrot`)

No browser file changes. No voice clip changes (no new kinds or lines).

## 5. Database / migration needs

No migration. Run `npm run build:functions -- parrot` and commit the rebuilt `supabase/functions/parrot/index.ts` (also rebuilt for S9; do both PRs one after the other, or if S9 is not yet deployed, rebuild from the latest main). Deploying is a live step: ask James first. **Deploy outside school hours (Mon to Fri 8:45 to 3:00 NZ):** the server replays a child's taps on the cards it makes, and a card go replay throws on a tap that is not one of its cards (`shared/parrot/play.ts:15`, `tapsAllowed`). A round started before the deploy holds taps on the old wrong cards, so finishing it after the deploy would fail. Rounds are per day, so after school or in the evening is safe.

## 6. Test steps

Automated: the new test and the edits in section 3 D (parrot goes from 7 to 8 `it` calls, the limit).

By playing the preview (step 2 or 3, level 3, for cards):
- `7 = 2 + ?`: the cards are close to 5 (for example 3, 4, 5, 8 or 5, 6, 7, 9), at most one is a printed number, the right card is not always the one missing from the sum, and is sometimes the biggest or the smallest.
- Play 10 goes and note where the answer is: it moves around the row.
- Layouts 0 to 3, swap, both, sub goals: same.
- True-or-false: unchanged, three cards.
- Two wrong taps: the look, then the redo with the answer and the nearest remaining card (never the far one).
- Stone goes (levels 4 and 5): unchanged; a stone count equal to a printed number still gets its named line (S9).
- Teacher page: the slip line still counts copy, total, all for pupils who put those counts of stones.
- `npx tsx scripts/parrot-sim.mjs` still runs.

## 7. Size and impact

S to M: one new card builder with a rank rule and retry loop, a changed redo, one test sweep and a rebuild; no browser change. High: the card goes now need the balance idea, not a pattern, which is the main loophole in the evaluator's list.

## 8. Session prompt (ready to paste)

```text
Create branch fix/parrot-near-cards from origin/main (own worktree). S9 (fix/parrot-seesaw-tilt) must be merged first; if it is not, stop and tell James.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S10-parrot-near-cards.md first.
Do not touch shared/maths, src/kit, src/maths, src/styles.css or src/components. shared/parrot is this game's own folder and is fine to change.

Steps (all in shared/parrot, plus the rebuilt function):
1. round.ts: add nearWrongs(answer, slips, random, max) and use it instead of pickWrongs for miss, swap, both and sub goals (about line 249). Pick the answer's rank (0..3) first, uniformly from the ranks that can be built; optionally (about half the goes) use one printed-number slip card (copy or total, never "all") if it fits the rank; fill the rest from answer-3..answer+3 (offset 1 is 'off1', else 'near'; a value equal to a slip value takes that slip's kind). Retry up to 40 times with the go's seeded random until exactly 2 cards share the answer's parity (sharingTell) and atMostShareTell on the last digit holds and at most one card is more than 3 from the answer; otherwise a fixed fallback. Never fewer than 3 wrong cards. True-or-false is unchanged.
2. round.ts redoCards: the answer plus the untried wrong card nearest to the answer (ties: the lower), never a far one.
3. parrot.test.ts: add the 8th it() sweeping every card key, layout and 200 seeds: answer rank 0..3 each 15 to 40 percent; answer biggest and smallest in at least 15 percent each; parity and last-digit tells; the "not printed and not biggest" pattern leaves about 2.2 or more cards on average (measure, then set the number with margin); at most one card more than 3 away. Update the existing mistakes test for the redo rule. Do not exceed 8 tests.
4. Check scripts/parrot-sim.mjs still runs (npx tsx scripts/parrot-sim.mjs).
5. npm run build:functions -- parrot (commit the rebuilt supabase/functions/parrot/index.ts). Run npx vitest run shared/parrot src/games/parrot, npm run typecheck, npm run build. Play the preview as in the plan (7 = 2 + ?, ten goes to see the answer move, layouts, true-or-false, the redo, stone goes).
Stop and tell James before any live step (deploy the parrot function outside school hours Mon to Fri 8:45 to 3:00 NZ; a round started before the deploy could not finish). Open a PR when done.
```
