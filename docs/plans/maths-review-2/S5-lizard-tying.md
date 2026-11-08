# S5: Lizard: the child ties the bundles on the first three steps

**Game:** Lizard's Bundles
**What's wrong:** Tying ten sticks into a bundle is the big idea, but only the very first go makes the child do it. After that a "+ bundle" button builds the ten for them.
**What done looks like:** On steps 1 to 3 a Build go has no "+ bundle" button. To make 40 the child adds sticks, ties ten into a bundle, and does that four times. From step 4 the "+ bundle" button is there.
**Size:** S
**Impact on learning:** High
**Waits for:** nothing

## 1. The problem

- `src/games/lizard/Goes.tsx:326` gives the mat its buttons: `withBundles: !(guided && at === 0)`. The bundle "+" and "-" are hidden only on the child's first ever go. On every other Build go they show (the check is at `Goes.tsx:108`).
- So "ten ones become one ten" is never needed after go 1. The evaluator built 40 with four taps of "+ bundle" and never tied anything (`docs/reviews/maths-review-2/games/lizard.md`, "Build go: the child can press + bundle four times", Problem 3).
- The "Tie ten" button exists (`Goes.tsx:269`, shown at `:334`) and lights when there are ten sticks, but nothing makes the child use it.
- Build goes are on steps 1 to 3 (`shared/lizard/round.ts:48-56`: step 1 is tens to 50, step 2 and 3 are tens and ones to 100). These are the steps where the idea is learned.

## 2. The rule behind it

- Rule 1 (the maths is the move): the action the child does must be the idea. Here the idea is "ten ones make one ten", so the tying has to be the move.
- Rule 3 (concrete, then picture, then number): the loose sticks are the concrete step. The "+ bundle" button is a shortcut that belongs after the idea is secure.

## 3. The change

All of it is in the browser. Nothing in `shared/lizard` changes, so the server function is not rebuilt.

1. In `src/games/lizard/Goes.tsx` add an exported helper near the top:
   `export const TIE_STEPS = 3;`
   `export const showBundleButtons = (step: number, firstGuidedGo: boolean) => step > TIE_STEPS && !firstGuidedGo;`
2. Line 326 becomes `withBundles: showBundleButtons(round.step, guided && at === 0)`. `round.step` is the step the child's challenge started at (`shared/lizard/round.ts` `Round.step`). Review goes in a step 4 or later challenge also get the button. That is intended: tying is secure by then.
3. The raft buttons (`withRafts`) stay exactly as they are. Hundreds are step 6 and are out of this plan.
4. Slow stick taps. Ten goes of "make 30" would be about 300 stick taps, and a 5 year old cannot do that. So on steps 1 to 3 the ones column gets one more button, **"Ten sticks"** (`WORDS.addTenSticks = 'Ten sticks'`, aria-label "Add ten loose sticks"). It adds ten loose sticks in one tap. They are loose sticks, not a bundle, so the child still has to press **Tie ten** to make the bundle. It is disabled when `mat.o > MAX_ONES - 10` (the mat holds at most 19 sticks, `shared/lizard/config.ts` `MAX_ONES`). Show it only while `!showBundleButtons(...)` on a Build go, and not on the guided first go (that go has the hand on the single stick "+", as now). Same size as the other step buttons (52px or more, `lizard.css:165`).
5. A nudge when ten sticks are on the mat. When `mat.o` first reaches 10 or more on a Build go on steps 1 to 3, say once for that go: "Ten sticks! Tie them into a bundle." (`WORDS.tieNudge`) and keep the "Tie ten" button lit (it already lights at `Goes.tsx:334`). Do not say it again for the same go. It never says how many bundles are needed.
6. Pressing "That's it" with ten or more loose sticks still gives the "tie" line (`MAT_LINES.tie`, `voiceLines.ts:38`; chosen at `Goes.tsx:258`). No change.
7. Add the new words to `allVoiceLines()` (`voiceLines.ts:73`): `WORDS.tieNudge`. Rewrite the clip list: `WRITE_VOICE_LINES=1 npx vitest run src/games/lizard/voiceLines.test.ts`, then make the clip: `~/kokoro/.venv/bin/python -I scripts/voice-clips.py lizard`. Commit the new `.mp3` and `lines.json` with the PR. The button label "Ten sticks" is not spoken.
8. CSS for the new button goes in `src/games/lizard/lizard.css` (the game's own file), next to `.lz-step--add`.

## 4. Files affected

- `src/games/lizard/Goes.tsx` (helper, line 326, the new button and nudge)
- `src/games/lizard/words.ts` (two new words)
- `src/games/lizard/voiceLines.ts` (add the nudge line to the clip list)
- `src/games/lizard/lizard.css`
- `public/voice/lizard/` (one new clip and `lines.json`)
- `src/games/lizard/tying.test.ts` (new test)

No shared or kit file. `shared/lizard` is not touched.

## 5. Database / migration needs

None. The server replays the child's taps the same way as before: a Build go still sends the number built.

## 6. Test steps

Automated (the game has 3 tests today, the limit is 8):
1. One small test in `src/games/lizard/tying.test.ts`: `showBundleButtons(1..3, false)` is false, `showBundleButtons(4..7, false)` is true, and `showBundleButtons(5, true)` is false.

By playing the preview (`npm run build:preview` for lizard as in the guide, set the step with the preview buttons):
- Step 1: make 30. There is no "+ bundle" or "- bundle". Add ten sticks (one tap of "Ten sticks" or ten taps of "+"), tie ten, repeat three times, "That's it". It is right.
- At ten sticks the voice says the nudge once. A second pass through the same go does not repeat it.
- Step 2 and step 3 Build goes: same. Read, More/less, Bundle and Swap goes are unchanged.
- Step 4 Build go: "+ bundle" and "- bundle" are back.
- The very first go of a new child: unchanged (hand on the stick "+", no "Ten sticks").
- Phone width (375px): the ones column still fits with the extra button.

## 7. Size and impact

S: one condition, one small button, one voice line, one test. High: tying ten ones into a ten is the whole place-value idea and it is currently skipped.

## 8. Session prompt (ready to paste)

```text
Create branch fix/lizard-tying from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S5-lizard-tying.md first.
Do not touch shared/, src/kit, src/maths, src/styles.css or src/components.

Steps:
1. In src/games/lizard/Goes.tsx add exported TIE_STEPS = 3 and showBundleButtons(step, firstGuidedGo) = step > 3 && !firstGuidedGo. Use it at the withBundles line (about line 326) with round.step.
2. On a Build go on steps 1 to 3 add a "Ten sticks" button in the ones column: it adds ten loose sticks (disabled if mat.o > MAX_ONES - 10), not on the guided first go. The child must still press Tie ten.
3. Add WORDS.addTenSticks and WORDS.tieNudge ("Ten sticks! Tie them into a bundle."); say the nudge once per go when the ones first reach 10. Add the nudge to allVoiceLines, rewrite lines.json (WRITE_VOICE_LINES=1 npx vitest run src/games/lizard/voiceLines.test.ts) and make the clip with ~/kokoro/.venv/bin/python -I scripts/voice-clips.py lizard.
4. Style the new button in src/games/lizard/lizard.css.
5. Add src/games/lizard/tying.test.ts with one test for showBundleButtons (steps 1-3 false, 4-7 true, guided first go false).
6. Run npx vitest run shared/lizard src/games/lizard, npm run typecheck, npm run build. Play the preview: step 1 make 30 by tying; step 4 shows "+ bundle"; first go unchanged; phone width fits.
Stop and tell James before any live step. Open a PR when done.
```
