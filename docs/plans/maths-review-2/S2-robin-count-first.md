# S2: Robin's Berry Basket: count the berries before you answer

**Game:** Robin's Berry Basket
**What's wrong:** On "How many?" a child can tap a number card without touching a single berry, so counting is never needed. After a wrong card the picture is a generic row, not the child's own count. The question is not written on screen.
**What done looks like:** On "How many?" the cards stay grey until every berry has been touched once (or "Count with me" has counted with the child). After a wrong card the child sees their own numbered berries and the count. "How many berries?" is written on screen.
**Size:** M
**Impact on learning:** High
**Waits for:** S1 (same files: `shared/robin/round.ts`, the Robin tests and voice lines)

## 1. The problem

- Marking a berry is optional. `markBerry` only works when the help level dims berries or Peek is open (`src/games/robin/Goes.tsx:233-239`: `!(shows.dims || peekOpen || inRedo)` returns). `helpShows` sets `dims` only for levels 2 and up (`shared/robin/config.ts:60-66`). At levels 0 and 1 a child cannot even mark.
- The cards are enabled from the start: `disabled={asking && (look !== null || tapped.includes(n))}` (`Goes.tsx:357-362`). Nothing asks for a touch first.
- The why picture is `WhyPicture` (`Goes.tsx:53-60`): it draws a row of `pick` berries (the number on the wrong card), not what the child counted. The kind of slip (`double`, `skip`...) is guessed from the card, not seen.
- The written question exists only for Give: `{go.kind === 'give' && <p className="rb-ask">...` (`Goes.tsx:273`). On "How many?" the child must hear "How many berries?" (`words.ts:60`, `voiceLines.ts:31-35`) to know what to do.
- With S1 done the third-card tell is gone; this plan closes the second loophole: tapping a card with no counting.

## 2. The rule behind it

Rule 1 (the maths is the move): the child must do the count before the card works. Rule 2 (voice first, written goal): the question is written too, and "Hear it again" stays (kit `HearAgain`, already used at `Goes.tsx:270`). Rule 4 (help arrives by itself): the pointing hand and "Count with me" show up when the child stalls. Rule 7 (mistakes teach): the why picture is the child's own count.

## 3. The change

All on `kind === 'howmany'` goes only. Give and One more are unchanged (except the written line below).

1. **Touching always works.** In `markBerry` remove the help-level test. A berry can be touched once. It dims at every level. The number on the berry (`mark`) and the spoken number still follow the help level exactly as now (`shows.says`, `shows.dims`, `peekOpen`, `inRedo`). So at levels 0 and 1 the child sees dimmed berries but no numbers.
2. **Cards wait.** Add `const counted = marked.length >= go.n` (or `inRedo` after "Let's count again"; see step 8). Until `counted`:
   - each card gets `aria-disabled="true"` and class `rb-choice--wait` (grey, like `rb-choice--off`, `robin.css:104`), and a tap does nothing except say once: "Touch every berry first." (new line, below);
   - under the cards, a written line: "Touch each berry first." (same words on screen), class `rb-wait`;
   - after `COUNT_HAND_MS = 3000` with no touch, a `PointingHand` (kit, `src/kit/PointingHand.tsx`) points at the next untouched berry. Use a second `useGuidedFirstGo(go.kind === 'howmany' && asking && !counted, COUNT_HAND_MS)`; call `start()` at each go and after each touch, `stop()` when counted. The existing first-go guide hand (`Goes.tsx:113`) is left alone.
3. **"Count with me" button.** Shown on `howmany` goes while `!counted` and nothing is touched, label "Count with me" (icon `🙋`). It is a kit-style `rb-button`, at least 64 px tall, placed under the group. Pressing it:
   - marks the berries one at a time, every 900 ms, in the layout's own order (`go.points` order, `round.ts:150-170`), saying the number each time with the existing `countLine(i)` clips (`voiceLines.ts:44`, numbers 1 to 24);
   - stops one berry short: Bella counts up to `n - 1`. The last berry pulses with the pointing hand, and the child touches it themself. That last touch is silent, so the total is never said before the child answers (rule 2). Then the cards open;
   - while it runs, taps on berries are ignored (use the same `look` style lock) and the button changes to "Counting...";
   - keep the timers in `timers`/`clearTimers` (`Goes.tsx:102-108`) so a new go cancels them.
4. **The first-tap record is not changed.** Only picks are sent (`onDone(taps)`); touches stay in the browser. No server change. (A child who used "Count with me" is not marked as helped. If James wants that later it is a new small plan, with a column.)
5. **Written question.** For `howmany`, show `<p className="rb-ask" aria-hidden="true">How many berries?</p>` using `WORDS.promptHowMany` (`words.ts:60`). Reuse the `.rb-ask` style (`robin.css:88`). For One more, also show "How many now?" (new `WORDS.promptCountOn`) so all card goes have a written question. Voice is unchanged; both clips already exist (`askLine`).
6. **The why picture is the child's own count.** Replace `WhyPicture` for `howmany` wrongs (give goes keep theirs):
   - Show the group's berries as the child touched them, each with the number they got (the order of `marked`), at the same positions as the main group, smaller, in a row of `rb-whypic` boxes. The last touched berry's number is ringed.
   - Next to it, a big badge with the right count `go.answer` and a green tick. Left: "You counted" badge is the same number (they touched every berry once, so their count always equals the answer). The wrong card they tapped is shown small and crossed out, so they can see the card did not match their count.
   - Said line (two clips, joined with `PART_BREAK`, `voiceLines.ts:21`): part 1 `You counted ${numWord(answer)}.` (one clip per number 1 to 20), part 2 `Find the card that says the same.` (one clip). The old per-slip lines (`words.ts:37-50`: `double`, `skip`, `row`, `lots`) say "One berry was counted twice" which is no longer true after step 2, so use the new lines for every wrong card on a `howmany` go. `same`, `again`, `one` (One more) keep theirs. Teachers still see the slip kind (the wrong card's `kind`, `slipOf`, `round.ts:239`).
   - Write the picture as a small component `OwnCount` in `art.tsx` or inside `Goes.tsx` next to `WhyPicture`. Use the kit `ShowWhy` as now (`Goes.tsx:345`); it takes any picture. No kit change.
   - This does show the child their own count, as asked. It does mean the first wrong tap on a count go gives the number away. That is acceptable: only the first tap of a go is scored (`play.ts`), and the child has done the counting before the card opened.
7. **"Let's count again together" (second wrong tap).** `CountingPicture` (`Goes.tsx:63-75`) already counts up in the group. Keep it. After it, the redo opens with all marks reset (`Goes.tsx:195`), and the cards are not gated in the redo (`inRedo` counts as counted), as the child just counted together.
8. **Reset per go.** `nextGo` already clears `marked` (`Goes.tsx:154`). Also clear the count-with-me timers.
9. **Voice clips.** New lines (add them to the enumerator in `voiceLines.ts`, `lines` set near line 76-86, so the existing voice-lines test covers them): "Touch every berry first.", "Find the card that says the same.", "Count with me.", "You counted N." for N = 1 to 20, and `WORDS.promptCountOn`'s line if spoken (it is not spoken: the voice already says the question). Make the clips on the Mac with `scripts/voice-clips.py` (Kokoro af_bella) and commit them under `public/voice/robin/`. Before the clips exist the browser voice is the fallback.

Kit parts used: `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `ShowWhy`, `LookTogether` (`src/kit`), `voiceLinesSuite` (test). No kit file changes.

## 4. Files affected

- `src/games/robin/Goes.tsx` (touching, gating, Count with me, why picture, written line).
- `src/games/robin/words.ts` (new words), `src/games/robin/voiceLines.ts` (new lines in the enumerator, `whyLine` for `howmany`).
- `src/games/robin/robin.css` (`.rb-choice--wait`, `.rb-wait`, `.rb-owncount`, count button).
- `src/games/robin/art.tsx` (only if `OwnCount` goes there).
- `public/voice/robin/*.mp3` (new clips).
- No `shared/` change needed. (If a pure helper `cardsOpen(go, markedCount)` is wanted for the test, put it in `shared/robin/round.ts`; then `npm run build:functions` is needed in the same PR.)

## 5. Database / migration needs

None. Touches stay in the browser. No new column.

## 6. Test steps

Robin is at 8 tests (6 + 2). Add no new `it`.
- `src/games/robin/voiceLines.test.ts` already checks every enumerated line has a clip. The new lines are added to the enumerator, so this test covers them. Make the clips first.
- If a pure `cardsOpen` helper is added, assert it inside the existing "replaying the taps" test (`robin.test.ts:43`).
- Play the preview (`npm run robin:preview`): a "How many?" go at help level 5, 3, 2 and 0 (Settings Off): cards grey until every berry is touched; the hand appears after 3 seconds; "Count with me" counts and stops one short; the child's last touch opens the cards; a wrong card shows the numbered berries, the count badge and the two voice parts; the written "How many berries?" shows with the voice off; at a phone width (375 x 812) the cards and the button are not covered and all targets are 64 px or more; "Hear it again" works.
- Check a go still finishes with no touches by nobody: it cannot (cards locked). Check the redo opens the cards without touching again.

## 7. Size and impact

M: one screen file with new state, a small picture, about 25 new voice clips. High: counting becomes the thing a child has to do on every count go.

## 8. Session prompt (ready to paste)

```text
You are fixing Robin's Berry Basket in the School Games Hub repo. Wait: only start after plan S1 (fix/robin-answer-place) is merged to main.
Create branch fix/robin-count-first from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 1, 2, 4, 7) and docs/plans/maths-review-2/S2-robin-count-first.md first, then docs/reviews/maths-review-2/games/robin.md.

Goal: on How many? a child must touch every berry (or use Count with me) before a number card works, and a wrong card shows the child's own count.
Steps (details in the plan, section 3):
1. src/games/robin/Goes.tsx: let markBerry work at every help level (numbers still follow the level). Grey the cards (rb-choice--wait, aria-disabled) with a written line "Touch each berry first." until every berry is touched; tapping a grey card says "Touch every berry first." once. A pointing hand (kit PointingHand and a second useGuidedFirstGo, 3 s) points at the next untouched berry.
2. Add a "Count with me" button: Bella counts the berries aloud one at a time (countLine clips), stops one short, and the child touches the last berry silently. Timers go in the existing timers/clearTimers.
3. Show the written question "How many berries?" for How many and "How many now?" for One more (rb-ask).
4. Replace WhyPicture for How many wrongs with the child's own numbered berries plus a count badge and the crossed-out wrong card. Say "You counted N." then "Find the card that says the same." (two clips joined with PART_BREAK). The redo (inRedo) is not gated.
5. Add the new lines to the voiceLines.ts enumerator, make the clips with scripts/voice-clips.py (Kokoro af_bella) into public/voice/robin/, add CSS in robin.css.
Robin is at 8 tests: add none; the existing voiceLines test covers the new lines. Do not touch shared/maths, src/maths, src/styles.css, src/components or kit files. No server or database change.
Check in the preview at levels 5, 3, 2 and 0 and at 375 px wide. npm test, npx tsc --noEmit, lint.
Stop and tell James before any live step. Open a PR when done.
```
