# S27: Pipi: outlines do not give the answer, levels mix older sums, wrong shells tidy up

**Game:** Pipi
**What's wrong:** At full and faint help the dashed outlines show exactly how many pipi are hiding, so a child can count the outlines and never think. A level uses only its own sums, so older ones are never revisited. A wrong shell stays on screen greyed out.
**What done looks like:** The outlines appear only after a first wrong try on that go. About 2 goes in 10 are from earlier levels. A wrong shell leaves the row once its reason has been shown.
**Size:** M
**Impact on learning:** High
**Waits for:** nothing (do S24 first or after; they touch different lines of the same files)

## 1. The problem

- `src/games/pipi/Goes.tsx:12-17` says full help is a frame plus a dashed outline of where each hidden pipi is. `Hidden` draws one outline per hidden spot (`src/games/pipi/PipiArt.tsx:36-44`; faint is the same shape at 35% opacity, `pipi.css:141`). Counting the outlines is the answer. The help is picked at `Goes.tsx:153-158` and passed at `:285`: `<Hidden outline={helpNow} />`.
- Each round uses only the keys of the child's current level (`levelKeys(level)`, `shared/pipi/round.ts:55`; `makeRound`, `:158-184`). Levels are 1: wholes 3 to 5, 2: 6 and 7, 3: 8 to 10 (`:29-33`). Once a child is on level 3 they never meet 3 to 5 again. Penguin Pairs has `REVIEW_GOES = 3` (`shared/korora/round.ts:30`, used at `:223`) as a model.
- A wrong shell gets `pp-shellbtn--tried` (grey, `pipi.css:186-187`) and stays disabled in the row (`Goes.tsx:318`). The row keeps wrong answers that are now just clutter.

## 2. The rule behind it

- Rule 1: the maths is the move. Help must not hand over the answer.
- Rule 6: mix old facts so they stay known.
- Rule 7: a mistake shows why, then gets out of the way.

## 3. The change

1. Outlines on demand: in `Goes.tsx` pass `outline` as `'none'` while no shell has been tried on this go (`tried.length === 0`) and the struggle boost is not on (`boosted`, `:154`). After the first wrong shell, show `helpNow`. Keep the dashed frame (the five or ten frame) so the whole is still visible. The "outlines are back" line (`WORDS.outlinesBack`) still plays on a struggle.
2. Review goes: add `REVIEW_GOES = 2` in `shared/pipi/round.ts`. In `makeRound`, take 2 of the 10 goes from the keys of earlier levels (`levelKeys` of every level below the child's), the weakest first by box with ties by the seed (use `weakest`, `round.ts:141-147`). None at level 1. Keep the rules about edge goes and the guided first go (`:170-176`). Put the review goes in the middle of the round, never first.
3. Tidy wrong shells: after the "why" line has been said (`Goes.tsx:215-217`), take that wrong shell out of the row (do not render it) so the rest grow into the space. Keep the order of the others. Never remove the answer. The look-together after the second wrong shell (`:209-212`) stays.
4. The replay of a round still checks answers the same way. The goes list is saved with the round, as now, so review goes need no new saved shape if `GoPlan` already holds the key.

Kit parts used: `src/kit` `ShowWhy`, `LookTogether`, `NowYouTry` (already used). No kit change.

## 4. Files affected

- `src/games/pipi/Goes.tsx`, `PipiArt.tsx` (only if the outline prop needs a new value), `pipi.css`, `shared/pipi/round.ts`, tests in `shared/pipi/` and `src/games/pipi/`.
- `supabase/functions/pipi/index.ts` regenerated with `npm run build:functions` (shared/pipi changed).
- No shared kit change. Do not touch `shared/maths`.

## 5. Database / migration needs

None. The round's goes are stored at start and replayed on finish, so older open rounds still replay from what was stored.

## 6. Test steps

Automated (4 tests, within the 8-per-game limit):
1. Full and faint help show no outline until a shell has been tried; the struggle boost shows them at once.
2. `makeRound` at level 3 has 2 earlier-level goes, at level 1 has none, the first go is never a review go.
3. The same seed and facts give the same round.
4. A wrong shell is not rendered after its why line, and the answer is never removed.

By playing: see an empty frame first, tap a wrong shell and see the outlines come in; play at level 2 and see a few small sums; watch wrong shells slip away.

## 7. Size and impact

M: three small changes in one game, one of them in the round maker. High: the child must now work out how many hide.

## 8. Session prompt (ready to paste)

```text
Branch: create pipi-outlines-review from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S27-pipi-outlines-review-tidy.md first.
Steps: (1) in src/games/pipi/Goes.tsx show the dashed outlines only after the first wrong shell on a go, or when the struggle boost is on; (2) in shared/pipi/round.ts add REVIEW_GOES = 2 so about 2 goes in 10 come from earlier levels (weakest first, none at level 1, never the first go, keep the edge and guided rules); (3) take a wrong shell out of the row after its why line, never the answer. Never touch shared/maths, src/maths, src/styles.css or src/components.
Run npm run build:functions. Tests: the 4 tests in the plan (at most 8 for the game). Check the preview by playing.
Stop and tell James before any live step. Open a PR when done.
```
