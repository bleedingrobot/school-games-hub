# S6: Lizard: keep the child's attempt and draw the real bundles

**Game:** Lizard's Bundles
**What's wrong:** After a wrong Build, Bundle or Swap the mat is wiped, nothing says what the child made, and the "why" picture is a thinking emoji. The third wrong try in a redo says nothing at all. Pressing "+ bundle" and "That's it" over and over can find the answer.
**What done looks like:** A wrong try leaves the child's bundles and sticks on the mat and says "You made 34. We need 43." The picture beside it is the child's own bundles and sticks. After two wrong tries Lizard shows the answer and the child does it again. Every wrong try in the redo gets a reason too.
**Size:** M
**Impact on learning:** High
**Waits for:** S5 (same file, `src/games/lizard/Goes.tsx`)

## 1. The problem

- **The attempt is wiped.** `src/games/lizard/Goes.tsx:240`: `if (!cardGo) setMat(go.from);` runs on every wrong try. The child cannot see what they built against what was asked, and cannot fix just the tens or just the ones.
- **The picture is an emoji.** `Goes.tsx:352`: `picture={<span className="lz-why__icon" ...>🤔</span>}`. The words are good (`voiceLines.ts:36-41, 44-53`) but the picture is not the child's work (DECISIONS pattern 9).
- **Nothing says the count.** The line for a wrong Build is "Not quite. Count your bundles, then your sticks." (`MAT_LINES.build`, `voiceLines.ts:37`). The evaluator: "It does not say what the child made."
- **The third wrong try is silent.** The kit state machine goes `free`, `why`, `look`, `redo` (`shared/kit/mistakes.ts`, `stepGo`). In `redo` a wrong try keeps the phase, but `Goes.tsx:351` only draws the why panel when `gs.phase === 'why'`, and `:365` draws only "Now you try". The evaluator saw the mat just empty again.
- **Brute force.** `sendable` is `!matsAlike(mat, go.from)` (`Goes.tsx:281`). A child can press one more bundle and "That's it" each time. The evaluator did exactly this on "Make 50" and reached 5 bundles by trying 1, 2, 3, 4, 5 (`lizard.md`, "Random tapper"). S5 closes the bundle button on steps 1 to 3, but Bundle and Swap goals and step 4 onward can still be searched.

## 2. The rule behind it

- Rule 7 (mistakes teach): a wrong try shows why **on the child's own model**, then the child tries again. The picture must be what they made.
- Rule 1 (the maths is the move): at most two wrong tries, then the game shows the answer and the child redoes it. Wrong tries must not work as a search.
- Rule 4 (help arrives by itself): the redo needs help too, not silence.

## 3. The change

Browser only. No change to `shared/lizard` (the server already saves every try as a number).

**A. Keep the attempt (Build, Bundle, Swap goals).**
1. Delete `if (!cardGo) setMat(go.from);` at `Goes.tsx:240`. The mat stays as the child left it.
2. Add `const [lastTried, setLastTried] = useState<Mat | null>(null)`; set it to `mat` on a wrong try; clear it in `nextGo` and when the child changes the mat. `sendable` (`:281`) also needs `&& !(lastTried && matsAlike(mat, lastTried))`, so the same wrong mat cannot be sent twice.
3. When "Let's look together" ends (`onEnd`, `:244`), reset the mat to `go.from` once (the child redoes from the start, the model has just been shown). Clear `lastTried`.

**B. Say the count (written, big, next to the picture).**
4. New function in `voiceLines.ts`: `tryLine(go, mat)` gives these lines (the numbers are written on screen; see the voice note below):
   - Build: `You made 34. We need 43.` (`matValue(mat)` and `go.n`). If the mat has ten or more loose sticks the existing tie line is used instead (`MAT_LINES.tie`, chosen at `:258`): `You made 34. You have ten sticks to tie.` is not needed, keep the tie line.
   - Bundle (tie loose sticks): `You have 2 bundles and 13 sticks. Can you tie more? Ten sticks make a bundle.`
   - Swap (untie one): `You have 3 bundles and 7 sticks. Untie one bundle. Then count the sticks.`
   - Card goes (Read, More/less): `You picked 34.` then the existing slip line (`SLIP_LINES`).
5. **Voice.** Bella's clips cannot hold every number (up to 999). So the voice says a fixed clip and the numbers are on screen: `WORDS.lookAtYours = 'Look at what you made, and what we need.'` (new clip, no numbers). Do not add number clips in this plan. Say so in the PR.

**C. Draw the child's own bundles and sticks.**
6. Replace the emoji at `Goes.tsx:352` with `<TryPicture />`, a small component in `Goes.tsx` that uses the existing `MatView` (`Goes.tsx:80-119`) with `labels`, `counts` and `colours` on, `frame={false}`, and a new class `lz-mat--small` (about 60% size, in `lizard.css`, next to `.lz-mat--3` at `:158`):
   - Mat goals: `MatView mat={lastTried}`, label "Your mat: 3 tens and 4 ones." Beside it the number we need written large as digits (`go.n`), not pictured. The target mat is **not** drawn here. It comes with the second wrong try.
   - Card goals: `MatView mat={matOf(pickedCard)}` (`matOf` is exported from `shared/lizard/round.ts`), label "You picked 34: 3 tens and 4 ones."
   Keep the text line from step 4 under it. Use the kit `ShowWhy` as now (`picture` prop takes any node).
7. Keep `LookTogether` (`:355-362`). It already draws the target with `targetMat(go)`.

**D. The redo: reason every time, no search.**
8. In the `redo` phase a wrong try now shows the same `ShowWhy` panel with the child's attempt and the count line. Change the condition at `:351` to `(gs.phase === 'why' || (gs.phase === 'redo' && lastLine)) && lastLine`. Show `NowYouTry` only until the first wrong try in the redo.
9. In the redo, after a wrong try, point at the place that is wrong, never the number: put the kit `PointingHand` (`src/kit/PointingHand.tsx`) on the **tens** "+" button if `mat.t !== target.t`, else on the ones "+" (hundreds first if `places === 3` and `mat.h` differs). `handAt` (`:277`) already carries a place. It only needs a value in the redo.
10. After a wrong try (any phase) the "That's it" button is disabled for 2 seconds (`THINK_MS = 2000`, use the existing `later` timer, `:149`) and the child's changes to the mat re-enable it at once. This stops rapid-fire guessing and costs a careful child nothing.
11. No change to the cap: the kit's `LOOK_AT = 2` (`shared/kit/mistakes.ts`) already means two wrong tries, then the look, then the redo. Do not change the kit.

**E. Small words.** Add to `words.ts`: `lookAtYours`, `yourMat` (aria label), `weNeed`. Add `WORDS.lookAtYours` to `allVoiceLines()` (`voiceLines.ts:73`). Rewrite the clip list and make the clip as in S5 step 7.

## 4. Files affected

- `src/games/lizard/Goes.tsx` (lines 240, 244, 258, 281, 351-352, 365, the new `TryPicture`)
- `src/games/lizard/voiceLines.ts` (`tryLine`, clip list)
- `src/games/lizard/words.ts`
- `src/games/lizard/lizard.css` (`lz-mat--small`, the count line)
- `public/voice/lizard/` (one new clip and `lines.json`)
- `shared/lizard/lizard.test.ts` or `src/games/lizard/tying.test.ts` (extend, see section 6)

No shared or kit file changes.

## 5. Database / migration needs

None. Tries are still saved as numbers (`taps` in `lizard_rounds`). The server replay (`shared/lizard/play.ts`) already accepts any number of tries after a wrong one.

## 6. Test steps

Automated (the game will have 4 after S5; the limit is 8):
1. One test of the pure line builder: `tryLine` for a Build go with a 34 mat and target 43 contains "34" and "43"; for a Bundle go and a Swap go it contains the bundle and stick counts; it never contains the answer to a card go.

By playing the preview (step 2 or 3 for Build; step 4 for Bundle and Swap):
- Build 43, make 34 (3 bundles, 4 sticks), "That's it": the mat keeps 3 bundles and 4 sticks, the panel shows the child's bundles and sticks with counts, "You made 34. We need 43." The target is not drawn.
- Wrong again: "Let's look together" shows 4 bundles, 3 sticks. Then the mat resets and "Now you try."
- Wrong in the redo: the panel appears again with the count, the hand points at the tens "+". "That's it" is greyed for about 2 seconds.
- Pressing "That's it" twice on the same wrong mat does nothing the second time.
- Read go: tap a wrong card, the panel shows bundles and sticks for the picked number, not an emoji.
- Phone width (375px): the small mat and the number fit, no horizontal scroll.
- A right try still works from any state, including after wrong tries.

## 7. Size and impact

M: about one session; one file does most of it, plus a small component and one clip. High: the child sees what they made against what was asked, so the mistake teaches, and the search loophole is closed.

## 8. Session prompt (ready to paste)

```text
Create branch fix/lizard-attempt from origin/main (own worktree). S5 (fix/lizard-tying) must be merged first; if it is not, stop and tell James.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S6-lizard-attempt.md first.
Do not touch shared/, src/kit, src/maths, src/styles.css or src/components.

Steps (all in src/games/lizard, browser only):
1. Goes.tsx: delete the setMat(go.from) on a wrong try (about line 240). Add lastTried state; sendable also requires the mat to differ from lastTried. Reset the mat to go.from when "Let's look together" ends.
2. voiceLines.ts: add tryLine(go, mat): Build "You made 34. We need 43."; Bundle and Swap give the bundle and stick counts then the existing line; card goes "You picked 34." then the slip line. Voice says one fixed clip (WORDS.lookAtYours); the numbers are written only.
3. Replace the emoji picture in ShowWhy with a TryPicture using the existing MatView at a small size (new class lz-mat--small in lizard.css): the child's own bundles and sticks with counts (mat goals) or the picked card's bundles and sticks (card goals). Do not draw the target here; the look-together still does.
4. In the redo phase show the ShowWhy panel on every wrong try (change the condition at about line 351); NowYouTry only until the first wrong redo try. Point the PointingHand at the tens or ones "+" that is wrong (never a number).
5. Grey "That's it" for 2 seconds after a wrong try (a mat change re-enables it).
6. Add the new words, add lookAtYours to allVoiceLines, rewrite lines.json (WRITE_VOICE_LINES=1 npx vitest run src/games/lizard/voiceLines.test.ts) and make the clip (~/kokoro/.venv/bin/python -I scripts/voice-clips.py lizard).
7. One test: tryLine for Build, Bundle, Swap and a card go (counts present, no card answer given).
8. Run npx vitest run shared/lizard src/games/lizard, npm run typecheck, npm run build. Play the preview as listed in the plan (Build 43 with 34, wrong twice, redo, wrong in the redo, a Read go, phone width).
Stop and tell James before any live step. Open a PR when done.
```
