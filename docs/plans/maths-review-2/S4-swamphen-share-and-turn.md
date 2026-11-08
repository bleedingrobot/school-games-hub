# S4: Swamp Hen's Reed Rows: the child deals the shares and answers a turn question

**Game:** Swamp Hen's Reed Rows
**What's wrong:** On "share" a pile and empty lanes are shown and the child does nothing. On "turn" the Turn button changes nothing the child needs, and the answer cards are the same, so it cannot be answered wrongly.
**What done looks like:** On a share go the child taps lanes to deal reeds one at a time, and the game checks the shares are fair before the answer cards open. On a turn go the child picks which garden it becomes when turned, and can pick wrong.
**Size:** M
**Impact on learning:** High
**Waits for:** S3

## 1. The problem

- **Share is watched.** `picture()` for `share` draws `Lanes` (empty dashed rows, `src/games/swamphen/art.tsx:224-232`) and a `Pile` (`art.tsx:207-221`) inside a plain `div` with no buttons (`src/games/swamphen/Goes.tsx:166-174`). At help levels 0 and 1 (`view` plain or peek) even those are hidden (`Goes.tsx:167`). "Let's look together" says "Deal the shoots out" (`voiceLines.ts:50`) but shows a 👀 icon (`Goes.tsx:232`). The child only picks a number card for "how many in each row" (`round.ts:263-267`). Evaluator: "set step 4, play: 15 shoots, 5 lanes, a pile, nothing to move."
- **Turn cannot be wrong.** The Turn button only flips a `turned` flag that swaps the edge labels (`Goes.tsx:59,160-161,215-219`). The scored answer is the total `a * b` for the same cards either way (`round.ts:275-277`). Evaluator: "press or do not press: the answer cards are the same."
- Sharing needs up to 70 shoots (`share:` keys are 2 to 10 rows with 2 to 7 in each: `shared/maths/skillPacks/earlyFacts.ts:576`).

## 2. The rule behind it

Rule 1: the maths is the move. Sharing is dealing one to each row in turn; the child must do it. A turn question must be one a child can get wrong. Nothing on screen gives the answer away: the child counts the dealt row themselves. Rule 3: the dealing is the concrete step, the numbers come after. Rule 7: "Let's look together" for share shows the dealing, not a 👀.

## 3. The change

### A. Share: the child deals (browser only; scoring unchanged)

1. Share goes always show the lanes and the pile, at every help level (remove the hide at `Goes.tsx:167`). Help changes only the aids (step 4).
2. Make each lane a button (HTML, not the SVG rect). One tap = one reed moves from the pile into that lane. The lane shows its reeds in a row. The pile shows only the reeds left (`Pile n={left}`).
3. Lane size: at least 44 px tall, full width. For 6 or more lanes (the 10-row goes) lay the lanes in two columns of 5 so it fits a phone (375 x 812) without scrolling the cards off.
4. Buttons: "Take one back" (undo the last deal, `↩`, 64 px) and, only after the child has dealt one full round by hand (one reed into each of the lanes, whatever order), "Deal a round" (one reed into every lane). The second saves taps on the big goes. Words: "Take one back", "Deal a round".
5. Aids by help level (existing `view` from `viewFor(seen)`, `round.ts:293`): at levels 5 and 4 the next lane in turn glows and Bella says "One for each row." when a round starts; at 3 and below no glow and no hint. The child may always tap any lane.
6. When the pile is empty, check the shares (a pure function `fairShare(lanes: number[]): boolean` in `shared/swamphen/round.ts`, so it can be tested):
   - All lanes equal: say "Fair shares!", the lanes pulse, the answer cards open.
   - Not equal: lanes with more glow, say "Some rows have more. Share them fairly." and show a "Deal again" button (puts every reed back). The cards stay shut. Deal-again counts are not sent.
7. Until fair, the cards are disabled, like `needPlant` for Plant (`Goes.tsx:82,128,244`). Add `needDeal` the same way, and a written line "Deal the shoots into the rows." under the question.
8. The scored tap is unchanged: the number card "how many in each row?" (`round.ts:263-267`). The answer is the lane length, which the child must count. The server replays only the picks, so no server change.
9. "Let's look together" for share (second wrong tap): replace the 👀 with a `Lanes`-and-pile picture that deals one reed into every lane per step. `useLookTogether` takes `steps` (`Goes.tsx:146` passes 3): pass `go.cols` for share and draw `look.filled` reeds in each lane. Keep the line "Deal the shoots out, one for each row, again and again." (`voiceLines.ts:50`).

### B. Turn: pick the turned garden

1. A turn go now asks: "R rows of C. Turn the garden. Which garden is it now?" (new `askLine` for `turn`, `voiceLines.ts:21`). The scored answer is a picture card, like Which garden: use `pictureCode(cols, rows)` (rows and columns swapped, `round.ts:230`). The source garden R rows of C is drawn above, with edge numbers at help levels 2 and up as now.
2. Four picture cards (shuffled by the seed, as the which-garden go does, `round.ts:270-273`): the right one `C rows of R`; the unturned `R rows of C` (new slip `unturned`: "That is the garden before it was turned."); `1 row of R + C` (slip `added`); a scatter of the total (slip `scatter`). The turn keys never have R = C (`earlyFacts.ts:570-572`), so the two garden pictures always differ. Check at most 2 of 4 cards share a tell: they are pictures with different row counts, so no number tell.
3. The child must predict, not watch. Do not turn the garden before they answer. The "Turn it round" button is shown only at help levels 5 and 4 (and after a first wrong tap lifts the level, `pictureFor`, `round.ts:300-314`); it turns the source garden to show the model. At levels 3 and below no button.
4. After a right card: the source garden turns once (a 0.6 s turn) while the right card is marked, as a reward and a check (`RIGHT_MS`, `Goes.tsx:29`).
5. "Let's look together": the source garden turns, with the line "Turning it round swaps the rows and the shoots in a row." (replaces `voiceLines.ts:48`).
6. Records: the go key stays `turn:RxC`. A turn go no longer states a total, so do not write the plain `mul:` key for it: in `mulKeyOf` return `null` for `turn:` keys (`round.ts:78-82`). Say this in the PR.
7. Why picture for wrong turn cards: still the 🤔 icon (a better why picture is candidate 6 in the evaluation and is not in this plan).
8. Teacher: add the new slip to `SLIP_WORDS` in `shared/swamphen/teacher.ts:10`: `unturned: 'forgot to turn it round'`. Add it to `Slip` (`round.ts:212`) and `SLIP_LINES` (`voiceLines.ts:30`).
9. Considered and rejected: "Is it still 12?" with choices. The total is the answer of the original question, so the question would give it away.

### New voice lines and words
"One for each row." "Fair shares!" "Some rows have more. Share them fairly." "Deal the shoots into the rows." (written and spoken), "R rows of C. Turn the garden. Which garden is it now?" for every turn key (20 clips), "That is the garden before it was turned.", "Turning it round swaps the rows and the shoots in a row.", buttons "Take one back", "Deal a round", "Deal again". Add each to the enumerator in `voiceLines.ts` (about lines 72-79) and make the clips on the Mac with `scripts/voice-clips.py` (Kokoro af_bella) under `public/voice/swamphen/`.

Kit parts used: `HearAgain`, `PointingHand`, `useGuidedFirstGo`, `ShowWhy`/`LookTogether`/`NowYouTry` (`src/kit`), `tagWrongs` (`shared/kit/mistakes.ts`). No kit change.

## 4. Files affected

- `shared/swamphen/round.ts` (`Slip`, the `turn` branch of `showGo`, `mulKeyOf`, new `fairShare`).
- `shared/swamphen/teacher.ts` (`SLIP_WORDS`).
- `supabase/functions/swamphen/index.ts`: rebuilt with `npm run build:functions` in the same PR.
- `src/games/swamphen/Goes.tsx`, `art.tsx` (clickable `Lanes`, dealt reeds), `words.ts`, `voiceLines.ts`, `swamphen.css`.
- `public/voice/swamphen/*.mp3` (new clips).
- Another plan, S3, also edits `art.tsx` and `Goes.tsx` (the `Garden`). Ship S3 first, or expect small merge conflicts.

## 5. Database / migration needs

None. The turn go changes how `showGo` rebuilds a go from the seed, and the function bundle is rebuilt, so redeploying the swamphen function is a live step (James's OK). A round open at the moment of redeploy would replay a turn go with different cards: redeploy outside school hours (Mon to Fri 8:45 to 3:00 NZ).

## 6. Test steps

Swamp Hen has 3 tests (`shared/swamphen/swamphen.test.ts`) and room for 5 more. Add 2:
- Turn go: for every `turn:` key and seeds 1 to 200, `choices` has 4 different codes, the answer is `pictureCode(cols, rows)`, the unturned code is among the wrongs with kind `unturned`, and `mulKeyOf` is null. The replay marks the right pick right and a wrong pick with its slip.
- `fairShare`: equal lanes true, unequal false, empty lanes with a reed left false.
- Play the preview (`npm run swamphen:preview`): set step 4, deal a 15-into-5 by tapping, see the unfair message with a lopsided deal, see "Deal again", see "Fair shares!" and the cards open, check the 10-lane goes at 375 x 812 (two columns, "Deal a round" after the first round), "Take one back", levels 0 and 5, "Let's look together" dealing. Set step 2: a turn go with pictures, wrong picture shows its line, "Turn it round" only at levels 5 and 4, the garden turns after a right pick. Check the voice with the clips.

## 7. Size and impact

M: new interaction on one kind, one changed kind, about 30 clips. High: division and commutativity become something the child does and can get wrong.

## 8. Session prompt (ready to paste)

```text
You are fixing Swamp Hen's Reed Rows in the School Games Hub repo.
Create branch fix/swamphen-share-turn from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 1, 3 and 7) and docs/plans/maths-review-2/S4-swamphen-share-and-turn.md first, then docs/reviews/maths-review-2/games/swamphen.md.

Goal: the child deals the shares by tapping lanes, and a turn go asks a question that can be wrong.
Steps (details in the plan, section 3):
1. Share (src/games/swamphen/Goes.tsx, art.tsx): make Lanes clickable HTML buttons, one tap deals one reed from the pile into that lane; always show lanes and pile at every help level; "Take one back", "Deal a round" (after the child has dealt a first round by hand); glow of the next lane at levels 5 and 4 only. When the pile is empty check fairShare (new pure function in shared/swamphen/round.ts): fair opens the cards ("Fair shares!"), unfair says "Some rows have more. Share them fairly." with "Deal again". Cards stay shut until fair (like needPlant). Two columns of lanes for 6 or more lanes. The look-together deals one reed per lane per step (useLookTogether steps = cols).
2. Turn (shared/swamphen/round.ts showGo): the answer becomes the picture of C rows of R (pictureCode(cols, rows)); wrongs are the unturned garden (new slip "unturned"), 1 row of R+C (added) and a scatter of the total. New askLine "R rows of C. Turn the garden. Which garden is it now?". The garden is not turned before the answer; the Turn it round button shows only at help levels 5 and 4; the garden turns after a right pick. mulKeyOf returns null for turn keys. Add "unturned" to Slip, SLIP_LINES and shared/swamphen/teacher.ts SLIP_WORDS.
3. Add all new lines to the voiceLines.ts enumerator and make the clips with scripts/voice-clips.py into public/voice/swamphen/. Add CSS in swamphen.css.
4. Two tests in shared/swamphen/swamphen.test.ts (turn go cards and replay; fairShare). Run npm run build:functions in the same PR, then npm test, npx tsc --noEmit and lint.
5. Play the preview as listed in the plan (step 4 share, step 2 turn, 375 px wide).
Do not touch shared/maths, src/maths, src/styles.css, src/components or kit files. No database change.
Stop and tell James before any live step (redeploying the swamphen function, outside school hours). Open a PR when done.
```
