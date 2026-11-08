# S13: Three wrong in a row brings full help back: Pigeon, Lizard, Swamp Hen

**Game:** Pigeon, Lizard, Swamp Hen
**What's wrong:** Three goes in a row with a wrong first tap should bring full help back for the rest of the round. The rule is written down in these three games but never used, so a struggling child keeps the thin help.
**What done looks like:** In each of the three, get the first tap wrong on three goes in a row (use the preview's help-level button to start on a low level). From the fourth go on, the full picture is shown (level 5) until the round ends. The next round starts from the saved level again.
**Size:** S
**Impact on learning:** High
**Waits for:** nothing

The kit already has the number (`STRUGGLE_GOES`); nothing new is needed in the kit. Later cards give the older games the same rule where it is missing, with the same one-line count.

## 1. The problem

- The constant is defined and never read in these three games: `shared/pigeon/config.ts:38`, `shared/lizard/config.ts:38`, `shared/swamphen/config.ts:35` (each says "the kit's rule"). A search of `src/games/pigeon`, `src/games/lizard`, `src/games/swamphen`, `shared/pigeon`, `shared/lizard` and `shared/swamphen` for `STRUGGLE`, `struggl` and `wrongFirstRun` finds only those three definitions (DECISIONS item 12, `docs/reviews/maths-review-2/DECISIONS.md:128`).
- The picture for a go comes from `pictureFor(go, wrongs, tapped)` (`src/games/pigeon/Goes.tsx:101`, `src/games/lizard/Goes.tsx:154`, `src/games/swamphen/Goes.tsx:76`), which only knows the wrong taps **on this go** (`shared/pigeon/round.ts:362`, `shared/lizard/round.ts:317`, `shared/swamphen/round.ts:300`). Each new go starts again at the planned level `go.l`.
- The shared kit says what the rule is: `STRUGGLE_GOES = 3` ("Goes in a row with a wrong first tap that bring full help back for the rest of the round. Not saved.", `shared/kit/help.ts:15-16`).

How the games that use it do it (copy this):
- Robin keeps `struggle` state and a `run` counter (`src/games/robin/Goes.tsx:97-98`), and after a go finishes right, `run.current = flow.wrong > 0 ? run.current + 1 : 0; if (run.current >= STRUGGLE_GOES) setStruggle(true);` (`src/games/robin/Goes.tsx:213-215`). The level comes from `levelFor(go.l, flow.wrong, struggle, round.help)` (`src/games/robin/Goes.tsx:115`) where `levelFor` sets the top level when `struggling` (`shared/robin/round.ts:245-248`). Parrot does the same (`src/games/parrot/Goes.tsx:163-164, 276-277, 182`; `shared/parrot/round.ts:267-270`). Weka does it with `setBoost` (`src/games/weka/Goes.tsx:275, 342, 365`).
- It is not saved. The server never sees it, so no database change.

## 2. The rule behind it

LEARNING-DESIGN rule 5 item 3 (`docs/LEARNING-DESIGN.md:97`) and rule 4 (line 84): three goes in a row with a wrong first tap give full help for the rest of the round. Help follows the child, not the calendar.

## 3. The change

For each of the three games (same shape, three small edits):

1. **`shared/<game>/round.ts`, `pictureFor`:** add a fourth parameter `struggling = false`. Work out the level as now, then **after** the wrong-tap steps add: `if (struggling) { level = C.TOP_LEVEL as HelpLevel; peekOpen = false; }`. Put it last, so a first wrong tap cannot lower the level again (see the note on Robin and Parrot below). With `struggling`, the card trimming at three wrong taps stays as it is (it depends only on `wrongTaps`).
   - Pigeon (`shared/pigeon/round.ts:362-387`): also keep the `band` rule as is.
   - Lizard (`shared/lizard/round.ts:317-331`): `pictured`, `labels`, `counts` and `colours` are worked out from `level` at the end, so they follow.
   - Swamp Hen (`shared/swamphen/round.ts:300-315`).
2. **`src/games/<game>/Goes.tsx`:** add `const [struggle, setStruggle] = useState(false); const run = useRef(0);` next to the other state (`src/games/pigeon/Goes.tsx:83`, `src/games/lizard/Goes.tsx:133`, `src/games/swamphen/Goes.tsx:57`). Pass `struggle` as the new argument to `pictureFor` (lines above). In the branch that handles the **right** tap (after `setPhase('right')`; Pigeon `src/games/pigeon/Goes.tsx:164`, Lizard `src/games/lizard/Goes.tsx:250`, Swamp Hen `src/games/swamphen/Goes.tsx:152`) add: `run.current = gs.wrong > 0 ? run.current + 1 : 0; if (run.current >= STRUGGLE_GOES) setStruggle(true);` Import `STRUGGLE_GOES` from `../../../shared/kit/help` (as Robin does, `src/games/robin/Goes.tsx:20`). Do **not** import the unused local copy in `shared/<game>/config.ts`: delete that local constant (and its comment) so there is one number, or re-export the kit's. `struggle` and `run` start fresh with each round because `Goes` is mounted again for each round (confirm by playing two rounds in a row).
3. **The first go of the first round** (the guided go, `at === 0`) counts like any other go.
4. **Peek and the teacher's "Off":** the Peek button is only shown when `pic.level <= 1` (`src/games/pigeon/Goes.tsx:102`), so with `struggle` it disappears by itself. Teacher setting "off" does **not** switch the struggle help off (Robin does the same, `shared/robin/round.ts:245-250`): three misses in a row is the child asking for help. Tell James this in the PR in one line, in case James wants it the other way.
5. **No new words, no new voice.** The picture just gets fuller. (Parrot and Robin say nothing either.)

**Found while reading, small, optional (Step 6, Robin and Parrot, same PR or a second tiny PR):** in `levelFor`, the order is `if (struggling) level = TOP_LEVEL; if (wrongTaps >= 2) level = TOP_LEVEL; else if (wrongTaps === 1) level = min(TOP_LEVEL, planned + 1)` (`shared/robin/round.ts:245-250`, `shared/parrot/round.ts:267-272`). So once struggling, the **first wrong tap on a go lowers the level** from 5 to `planned + 1`. Fix: `else if (wrongTaps === 1 && !struggling)` (or put the struggle line last). One line each, plus one assertion in each game's existing test. Only do this step if James says yes; it touches two other games' folders (their own, not shared kit).

## 4. Files affected

- `shared/pigeon/round.ts`, `shared/lizard/round.ts`, `shared/swamphen/round.ts` (one parameter each).
- `src/games/pigeon/Goes.tsx`, `src/games/lizard/Goes.tsx`, `src/games/swamphen/Goes.tsx`.
- `shared/pigeon/config.ts:37-38`, `shared/lizard/config.ts:37-38`, `shared/swamphen/config.ts:34-35` (remove the unused local constant).
- The three games' test files (`shared/pigeon/pigeon.test.ts`, `shared/lizard/lizard.test.ts`, `shared/swamphen/swamphen.test.ts`).
- `shared/<game>/round.ts` is bundled by each game's function (`makeRound` and `showRound` live there), so run `npm run build:functions -- pigeon lizard swamphen` (or the repo's way to rebuild several; see `scripts/build-functions.mjs`) and commit the three `index.ts` files. Nothing child-visible changes on the server.
- Own branch for all three games together: they are one tiny, identical change. Nothing in `shared/kit`, `shared/maths` or `src/components` is touched.

## 5. Database / migration needs

None. The state lives only in the browser for the rest of the round.

## 6. Test steps

One test per game (3 in all, well inside the 8 limit): `pictureFor(go, 0, [], true).level === 5` for a go planned at level 0, 1 and 3; with `struggling` and one wrong tap the level stays 5; and `peekOpen` is false. (Add the same assertion for Robin and Parrot's `levelFor` if Step 6 is done.)

By playing each of the three previews: start a round on a low help level (the preview's level buttons), tap a wrong card first on three goes in a row (finish each go). The fourth go shows the full picture straight away. Get the next go right at the first tap: the full picture **stays** until the round ends. Start a new round: the planned level is back. Play with teacher help "Off": the struggle picture still comes after three misses.

## 7. Size and impact

S: about 10 lines of code per game, the same in all three. High: children who struggle now keep thin help for the whole round (evaluators saw this in play; DECISIONS item 12 held).

## 8. Session prompt (ready to paste)

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 4 and 5) and docs/plans/maths-review-2/S13-three-wrong-brings-help-back.md. Create branch `struggle-three-games` from origin/main in a new worktree.
Steps: (1) In shared/pigeon/round.ts, shared/lizard/round.ts and shared/swamphen/round.ts add a `struggling = false` parameter to pictureFor; after the wrong-tap steps set level to C.TOP_LEVEL and peekOpen to false when it is true. (2) In src/games/pigeon/Goes.tsx, src/games/lizard/Goes.tsx and src/games/swamphen/Goes.tsx add `struggle` state and a `run` ref, import STRUGGLE_GOES from shared/kit/help, count `gs.wrong > 0` at each right tap exactly as src/games/robin/Goes.tsx:213-215 does, and pass `struggle` to pictureFor. (3) Delete the unused local STRUGGLE_GOES in the three config.ts files. (4) One test per game for pictureFor with struggling (levels 0, 1, 3 become 5; one wrong tap keeps 5; no peek). (5) npm run build:functions for pigeon, lizard and swamphen; commit the index.ts files. (6) Only if James says yes in this session: also fix levelFor in shared/robin/round.ts and shared/parrot/round.ts so a first wrong tap does not lower the level while struggling, with one assertion each.
Play each preview: three wrong first taps in a row bring the full picture for the rest of the round; a new round starts from the saved level. Typecheck, test:changed, build. Stop and tell James before any live step. Open a PR when done.
```
