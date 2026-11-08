# S26: Penguin Pairs: the child shares the fish, and the near-double picture is true

**Game:** Penguin Pairs
**What's wrong:** At full help the half goes share the fish by themselves, so the child watches and the maths is done for them. On the near-double (level 5) the picture shows an extra fish inside the reflection, so it looks like a double of the wrong number.
**What done looks like:** The child deals the fish at every help level. A near-double picture is a true mirror of n and one separate "one more" fish.
**Size:** S
**Impact on learning:** High
**Waits for:** nothing

## 1. The problem

- `src/games/korora/Goes.tsx:157`: `if (go.kind === 'half' && (ownHelp === 'full' || (boost && setting !== 'off'))) shareAll(go.n, 1200);` shares all the fish for the child. `shareAll` is at `:166-170`.
- The other fair-share go in `src/games/korora/FairPile.tsx` already has the child tap to give two fish (one per chick). `GAME_SHARES_PAIRS = 2` at full help.
- `Mirror` (`Goes.tsx:366-412`) draws the extra fish for a near double inside the reflection: `<FishSpot id={`w${go.n}`} ... className="kr-fish--mirror kr-fish--extra" />` (`:401-405`). It sits where a reflected fish should be.

## 2. The rule behind it

- Rule 1: the maths is the move. Help may show; it must not do the move.
- Rule 8: fair timing. The clock starts when the child can answer.
- Rule 7: pictures must be true.

## 3. The change

1. Remove the auto-share at `Goes.tsx:157`. Keep the share inside "Let's look together" (`:176`).
2. At full help, a tap gives a pair of fish (one to each nest), as FairPile does. The next nest pulses. The answer choices stay locked until all fish are dealt.
3. Restart the answer clock when the choices unlock (`since` reference), so dealing time is not counted as thinking time.
4. Near double: draw a true mirror of n (n fish above, n reflected) and one single "one more" fish outside the water, with a short voice line: "n and n, and one more." Update the screen reader label and `src/games/korora/WhyPicture.tsx` (check the near case there) to match.

Kit parts used: `src/kit` `PointingHand` for the pulse if the pulse is not already in the game; no kit change.

## 4. Files affected

- `src/games/korora/Goes.tsx`, `FairPile.tsx` (only if the pair-deal helper is shared), `WhyPicture.tsx`, `korora.css`, `voiceLines.ts`, tests.
- No shared or kit change.

## 5. Database / migration needs

None.

## 6. Test steps

Automated (3 tests, within the 8-per-game limit):
1. At full help a half go does not auto-share; choices are locked until all fish are dealt.
2. The answer time starts when the choices unlock.
3. A near-double go renders n mirrored fish plus one separate fish.

By playing: play a half go at full help and deal the fish yourself; reach level 5 and see the one extra fish outside the water.

## 7. Size and impact

S: one removed line, one deal rule and one picture fix. High: the child now does the sharing, and the near-double picture is correct.

## 8. Session prompt (ready to paste)

```text
Branch: create korora-child-deals from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S26-penguin-pairs-child-deals-fish.md first.
Steps: in src/games/korora/Goes.tsx remove the auto shareAll at line 157 (keep the one in Let's look together); make a tap give a pair of fish like FairPile, pulse the next nest, keep choices locked until all dealt, and restart the answer clock when they unlock; redraw the near double as a true mirror of n plus one separate fish outside the water; update the screen reader label, WhyPicture.tsx and the voice line. Never touch shared/maths, src/maths, src/styles.css or src/components.
Tests: the 3 tests in the plan (at most 8 for the game). Check the preview by playing.
Stop and tell James before any live step. Open a PR when done.
```
