# S22: Beanstalk: missing-leaf goes are fair

**Game:** Kiwi's Beanstalk
**What's wrong:** On the three missing-leaf goes, a child who taps a wrong leaf is blocked from trying that pair again, so there is nothing left but the answer. These goes can also float only two choices, which a guess solves.
**What done looks like:** Missing-leaf goes always have at least 3 floating leaves. A wrong pair can be tried again. The first one is shown with a pointing hand.
**Size:** S to M
**Impact on learning:** High
**Waits for:** S11

## 1. The problem

- Missing-leaf goes are goes 3, 6 and 9 (`MISSING_GOES = [3, 6, 9]`, `shared/beanstalk/round.ts:35`; `isMissingGo` at `:36`). Six leaves are on screen (`ON_SCREEN = 6`, `:38`).
- Tried pairs are blocked on every go: `if (picked !== null && picked !== leaf && tried.includes(pairId(picked, leaf))) return;` (`src/games/beanstalk/Round.tsx:159`). On a missing-leaf go the next pick is made at `:192-217`, so after a wrong try the child is steered, not allowed to think.
- There is no demo the first time this kind of go appears.

## 2. The rule behind it

- Rule 1: guessing must not work, so no go with only two choices.
- Rule 4: help arrives by itself; show the first time a new kind appears.
- Rule 7: a mistake teaches. The child should be free to try again.

## 3. The change

1. Change `MISSING_GOES` to `[2, 4, 6]` (goes 3, 5, 7 in the child's count). At least 3 leaves float on each, so there are 2 or more wrong choices.
2. On a missing-leaf go, do not block tried pairs in `tap()` (`Round.tsx:159`). Keep the block on ordinary goes. Keep the look-together after the second wrong tap (`Round.tsx:127-144`).
3. First missing-leaf go ever: show it. If S11 has built the "seen kinds" kit part, use it. If not, use a guided pointing hand (`useGuidedFirstGo`, `PointingHand` from `src/kit`) plus a first-time tip (`FirstTimeTip`): "One leaf is missing. Which leaf makes it 10?" Say it with the voice.
4. If S21 is merged, build on it. Both change `Round.tsx` and `round.ts`.

Kit parts: `src/kit` `useGuidedFirstGo`, `PointingHand`, `FirstTimeTip`; S11's seen-kinds part when ready. Use these; do not change them here.

## 4. Files affected

- `shared/beanstalk/round.ts`, `src/games/beanstalk/Round.tsx`, tests in `shared/beanstalk/` and `src/games/beanstalk/`.
- No shared or kit file changes. S11 is the kit part, on its own branch.

## 5. Database / migration needs

None. The round is made from the seed, so the new go positions need no saved data. A round already open when this ships could be replayed with different missing goes. Keep the old list for the replay of rounds already open, or ship at the start of a day.

## 6. Test steps

Automated (3 tests):
1. Every missing-leaf go has at least 3 floating leaves.
2. On a missing-leaf go a tried pair can be tapped again. On an ordinary go it still cannot.
3. The first missing-leaf go shows the hand once and not again.

By playing: reach the first missing-leaf go and see the hand; tap a wrong pair twice and see the look-together; confirm you can retry.

## 7. Size and impact

S to M: a list change, one rule change and a demo. High: removes a guessing route and a block on thinking.

## 8. Session prompt (ready to paste)

```text
Branch: create beanstalk-missing-leaf-fair from origin/main (own worktree). S11 must be merged first (or use the fallback in the plan).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S22-beanstalk-missing-leaf-fair.md first.
Steps: change MISSING_GOES to [2, 4, 6] in shared/beanstalk/round.ts; stop blocking tried pairs on missing-leaf goes in src/games/beanstalk/Round.tsx (keep it on ordinary goes and keep the look-together); add the first-time demo for the first missing-leaf go with the kit part from S11 (or useGuidedFirstGo, PointingHand and FirstTimeTip). If S21 is on main, build on it. Never touch shared/maths, src/maths, src/styles.css or src/components.
Tests: the 3 tests in the plan (at most 8 for the game). Run npm run build:functions if shared/beanstalk changed. Check the preview.
Stop and tell James before any live step. Open a PR when done.
```
