# S25: Full help ends sooner for a child who already knows it

**Game:** Hop, Penguin Pairs, Pipi, Weka, Tūī
**What's wrong:** A fact keeps its full help until the child has got it right on two different days. A child who answers it right and quickly the very first time still sees full help the next day, and the day after. Tūī has a floor that cancels the fade, so a perfect child stays on level 4 for about 8 days.
**What done looks like:** A fact the child answers right and quickly twice (even on one day) drops from full to the next help level. A wrong answer brings full help back. A perfect round in Tūī starts to fade the help at once.
**Size:** S to M
**Impact on learning:** High
**Waits for:** S14

## 1. The problem

- Each game keeps full help on a fact until `box >= 2` and `quickDays >= 2` (for example Weka `HELP_LADDER`, `shared/weka/round.ts:107-113`; Hop `shared/hop/round.ts:146-151`; Pipi `shared/pipi/round.ts:84-89`; Penguin Pairs `shared/korora/round.ts:101-106`). `quickDays` is a list of days, so the rung cannot end before day two.
- The kit's `helpForFact` (`shared/kit/help.ts:37`) reads only `box`, `correct` and `quickDays`.
- Tūī has its own `placeAfter` (`shared/tui/round.ts:93-118`). At `:117`: `level = Math.max(FRAMES_LEVEL, Math.min(TOP_LEVEL, faded ? level : level + NEW_STEP_HELP))`. The floor cancels the fade when help has just faded.

## 2. The rule behind it

- Rule 5: help follows the child, not the calendar. Fade on right-and-quick; return on struggle.

## 3. The change

S14 must be done first: a lucky guess must not count as quick, and `quickDays` inherits that.

### Kit part (own small branch)

1. In `helpForFact` (`shared/kit/help.ts:37`), leave the first rung early when `(box >= 2 && quickDays.length >= 1) || (attempts === correct && quickDays.length >= 1)`. That is: two quick rights even on one day, or a clean right-and-quick first answer. A wrong answer sets box 1 and `attempts !== correct`, so full help returns.
2. Widen the `Pick<FactStats, ...>` type to include `attempts`.
3. Test in `shared/kit/kit.test.ts`. Run `npm run build:functions` in the same PR (shared/kit changes). No game words in the kit.

### Per game (one small PR each, after the kit PR is merged)

Hop, Penguin Pairs, Pipi, Weka: check the first rung of `HELP_LADDER` uses `until: { box: 2, quickDays: 2 }`. Change `quickDays` to 1 so the new early exit is the door out. Keep the later rungs. Tests: one per game that a fact answered right and quickly twice leaves full help, and a wrong answer returns it.

### Tūī (no kit change)

1. At `shared/tui/round.ts:117` do not apply the floor when the help just faded: `faded ? level : Math.max(FRAMES_LEVEL, ...)`.
2. Count a 10/10 round (8 or more is good; `GOOD`, `:30-42`) as two good rounds for the fade (`GOOD_TO_FADE = 2`).
3. Replays do not count (S24 wins).

Kit parts used: `shared/kit/help.ts` (`helpForFact`, `fadeAfter`, `ROUND_OF_TEN`). The kit edit is Part 1.

## 4. Files affected

- Kit (own branch): `shared/kit/help.ts`, `shared/kit/kit.test.ts`, plus `npm run build:functions`.
- Games: `shared/hop/round.ts`, `shared/korora/round.ts`, `shared/pipi/round.ts`, `shared/weka/round.ts`, `shared/tui/round.ts` and their tests.
- `supabase/functions/*/index.ts` regenerated.

## 5. Database / migration needs

None.

## 6. Test steps

Automated (kit 2 tests; 1 per game, within the 8-per-game limit):
1. Kit: two quick rights on one day leave rung one; a wrong answer returns it.
2. Each game: its first rung matches the new rule.
3. Tūī: a perfect round fades the help and the level is not floored back.

By playing: in the preview, answer one fact right and fast twice in a row and see it lose full help; get it wrong and see full help return.

## 7. Size and impact

S to M: one kit rule, then five small game edits. High: less help for children who do not need it, so more real thinking.

## 8. Session prompt (ready to paste)

### Part 1: Kit

```text
Branch: create kit-help-early-exit from origin/main (own worktree). S14 must be merged first.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S25-full-help-ends-sooner.md first.
Steps: in shared/kit/help.ts extend helpForFact so a rung is left early when (box >= 2 and quickDays >= 1) or (attempts equals correct and quickDays >= 1); add attempts to its stats type; add tests to shared/kit/kit.test.ts. No game words in the kit.
Run npm run build:functions in the same PR.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: The four ladder games

```text
Branch: create help-fades-sooner from origin/main (own worktree). Part 1 must be merged first.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S25-full-help-ends-sooner.md first.
Steps: in Hop (shared/hop/round.ts), Penguin Pairs (shared/korora/round.ts), Pipi (shared/pipi/round.ts) and Weka (shared/weka/round.ts) change the first rung of HELP_LADDER from quickDays 2 to quickDays 1. Add one test per game. Do not edit shared/kit here.
Run npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Tūī

```text
Branch: create tui-fade-sooner from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S25-full-help-ends-sooner.md first.
Steps: in shared/tui/round.ts placeAfter (line 117) do not floor the level when the help just faded; count a 10 out of 10 round as two good rounds for the fade. Replays must not count (see S24). Add a test.
Run npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```
