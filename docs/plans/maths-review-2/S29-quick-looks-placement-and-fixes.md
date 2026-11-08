# S29: Quick looks: a fairer starting check and small fixes

**Game:** Quick looks (the dot-flash activity inside Training; code in `src/subitising/` and `shared/subitising/`)
**What's wrong:** The starting check tests each stage with only two pictures, so one slip or one lucky tap decides a stage. A child on "Keep the picture on the screen" never sees a plant grow. A screen reader says "1 counters". A review picture in the Empty squares stage has no sign that the question changed.
**What done looks like:** The starting check shows 3 pictures per stage and a 4th only when the child got exactly 2 of the first 3; 3 right passes the stage. With the picture kept on, plants grow a little (never to "In flower"). The screen reader says "1 counter and 4 empty squares". A review picture says "A look back." first.
**Size:** M (small changes in four places, one voice step on James's Mac)
**Impact on learning:** Med
**Waits for:** nothing (R3, which made the garden stop growing in guided mode, is already merged: `src/subitising/SubitisingApp.tsx:100`)

## 1. The problem

Four things, all found in the second review (`docs/reviews/maths-review-2/issues-a.json`, the "new" list and the Quick looks rows).

**1a. The starting check is too thin.** The check is a search over the seven stages: 3 tests, 2 pictures each, a stage passes when both are right, the first test is at stage 4 (`shared/subitising/placement.ts:1-6`, `:12`, `:29-35`; `shared/subitising/config.ts:82` `placementTrials: 6`). Two right out of two is easy to get by chance or by a lucky run on a child who is really a stage lower. Everything below the start is then drawn "In flower" although the child never played it (`shared/subitising/engine.ts:67`, `src/subitising/Garden.tsx:6`). The evaluator saw this: stage 1 in flower after the check, never played.

Numbers, worked out from the rule (one button in five; a child who knows a stage is right about 90% of the time):

| How often the child is right on that stage | Passes now (2 of 2) | Passes with the new rule |
|---|---|---|
| 20% (pure guessing, 5 buttons) | 4.0% | 2.7% |
| 40% | 16% | 18% |
| 60% | 36% | 48% |
| 70% | 49% | 65% |
| 90% (knows it, one slip) | 81% | 95% |

So the new rule helps mostly by not failing a child who knows the stage and slips once (81% becomes 95%), and by making a real "about half" child more likely to be told the truth. It cuts a lucky pass only a little. The check is also short for the job: only the first test sees the real child, the rest follow its result.

**1b. Guided mode never grows the garden.** R3 made every answer with "Keep the picture on the screen" practice only: `SubitisingApp.tsx:100` (`helped = r.helped || r.guided`) saves it under the `subh:` / `gaph:` key (`src/subitising/saving.ts:14`), and `progressFrom` skips helped answers (`shared/subitising/engine.ts:71-73`). That was right for passing a stage (looking at a picture that stays is counting). But the setting is for the children who need it most, and for them the garden never changes. The summary even tells them "your plants are waiting" (`src/subitising/voiceLines.ts:23`, shown at `SubitisingApp.tsx:219`). The evaluator rated this "caused by a fix" (R3).

**1c. Screen-reader label "1 counters".** `src/subitising/FlashRunner.tsx:200` builds the label for an Empty squares picture as `${trial.n} counters and ${trial.answer} empty`. For one counter it says "1 counters and 4 empty", with no word "squares". The sentence the child hears after answering is correct (`voiceLines.ts:39-41` already handles one and many), so only the label is wrong.

**1d. Review pictures in stage 6.** In the Empty squares stage, 20% of pictures are review pictures from finished stages (`shared/subitising/trials.ts:59-62`). They are dot pictures, so the heading says "How many did you see?" (`FlashRunner.tsx:196`, `:207`). That heading is right for the picture, but it is a different question from the one the child has been answering ("How many empty squares?") with no sign of the switch, and the picture can be a ten-frame in both cases. It is also in the first review ("Review pictures in stage 6 used the wrong heading", `issues-a.json`, status not_fixed).

## 2. The rule behind it

- **Rule 6, Progression** (`docs/LEARNING-DESIGN.md`, "Move up on mastery, not one lucky answer"; the named best example is Quick looks' placement check). The check must not move a child on a lucky tap, and it must not hold back a child who slipped once.
- **Rule 1, The maths is the move** (guessing must not work). The 3-of-4 rule is the same idea as the 7-of-8 rule that already finishes a stage (`config.ts:56-57`).
- **Rule 10, Fun comes from the maths / growth you can see** and **Rule 2, voice first**: a child who needs the picture kept on still sees growth, and a screen-reader child gets a proper sentence.

## 3. The change

All in Quick looks' own folders. No change to `shared/maths`, `src/maths`, `src/styles.css`, `src/components` or any kit file. Not a kit part (Quick looks' own check).

### 3a. The starting check: 3 or 4 pictures per stage, 3 of 4 passes

The rule for one stage test (the answers for that stage, in order):
1. Show 3 pictures.
2. 3 right: the stage is passed. Stop at 3 pictures.
3. 0 or 1 right: the stage is not passed (the best possible is 2 of 4). Stop at 3 pictures.
4. Exactly 2 right: show a 4th picture. Right: passed (3 of 4). Wrong: not passed.

This is the same as "3 right out of 4", with the 4th picture skipped when it cannot change the result.

The search over stages stays as now: 3 tests, the first at stage 4, then 6 or 2, then the stage between (`placement.ts:25-37`). So the check is 9 pictures at least and 12 at most (it is 6 now). The most is the same as a normal round (`config.ts:80` `sessionTrials: 12`).

Steps:
1. `shared/subitising/placement.ts`: replace `PLACEMENT_PER_TEST` with `PLACEMENT_PASS_OF_FIRST = 3` (the first batch of pictures) and a small function `testOutcome(slice)` that returns `'pass'`, `'fail'` or `'open'` by the four steps above, and how many pictures the test took (3 or 4). Rewrite `searchFrom` (lines 25-37) to walk the answers test by test using `testOutcome`, so each test takes 3 or 4 answers, not always 2. A test that is still `'open'` (the child pressed "Finish for now" part way) is not counted, as now.
2. `placementTrial` (lines 45-60): build picture 1, 2, 3 and 4 of a test in order, each by the same `buildTrial` call, with a different seed on a retry. Picture k must not repeat any earlier key of the same test, and where the stage has more than one picture type it must not be the same type as the picture just before (same loop and limit of 12 tries as now, lines 53-58). Stage 2 has only one type (`config.ts:46`), so there only the key must differ.
3. New export `placementOver(answers)`: true when the 3 tests are decided (`lo >= hi`). `startStageFrom` (lines 63-65) is unchanged in meaning (stages below the first not passed count as passed).
4. `shared/subitising/config.ts:82`: remove `placementTrials`. Add the number 12 as `PLACEMENT_MAX` in `placement.ts`.
5. `src/subitising/FlashRunner.tsx`: new optional prop `over?: () => boolean`. In `advance` (line 172) finish when `index + 1 >= total || over?.()`. The button label at line 233 uses the same test ("Finish" when over). In the check the progress dots (lines 260-264) cannot say how long it will be, so hide them and keep a screen-reader label "Picture N" (new line in `WORDS`-style text inside the file, not spoken).
6. `src/subitising/SubitisingApp.tsx:198`: pass `total={PLACEMENT_MAX}` and `over={() => placementOver(checkAnswers.current)}`; `finishCheck` (line 120) is unchanged.
7. `placement.ts` header comment (lines 1-6) and the `PLACEMENT_*` comments must describe the new rule.

Thresholds to build exactly: first batch 3; pass at 3 of the first 3, or 3 of 4; fail at 0 or 1 of the first 3, or 2 of the first 3 and a wrong 4th. All right gives start stage 7 after 9 pictures. All wrong gives stage 1 after 9 pictures. The child-facing words do not change ("All done! You'll start with ...", `SubitisingApp.tsx:201-204`).

Effect on saved data and tests:
- **Nothing saved changes.** The check's answers are never saved (`SubitisingApp.tsx:198` pushes to a ref only; `onAnswered` is not called for the check). Only `placed`, `startStage` are kept (`shared/subitising/saved.ts:15-33`). So no child's stage, plants or finished count move, and there is no migration.
- A child who already took the old check keeps their start stage. Only a child who presses "Do the starting check again" (`SubitisingApp.tsx:153`) gets the new check. Pressing it can lower `startStage` but never takes away a finished stage (`state.finished` is kept: line 74).
- Tests that assume 6 pictures and pairs must change: `shared/subitising/subitising.test.ts:381-426` (the "placement" group: 6 pictures, `placementTrials` = 6, `[4,4,6,6,7,7]`, "uses the best guess so far when ended early") and `src/subitising/SubitisingApp.test.tsx:98-125` (the check loop uses `C.placementTrials`). Section 6 says how.

### 3b. The garden grows in guided mode, but never to "In flower"

Idea: a picture-on-screen answer (guided, or after a struggle) is still practice, so it can move a plant forward a little. It can never finish a stage (that still needs flashed answers, `engine.ts:43-53`). So the child sees progress, and the teacher still sees that the stage was not passed by looking at a picture that stays.

Steps:
1. `shared/subitising/engine.ts`: add `helpedRight: number` to `StageProgress` (line 21). In `progressFrom` (lines 70-77), before the two `continue`s for helped answers, count a right helped answer for the stage that `parseKey` gives. Answers whose key does not parse are still ignored.
2. `growth(stage)` (lines 109-113): finished is 4 as now. Otherwise take `points = 2 * right + helpedRight` and return `Math.min(3, Math.floor(points / 8))`. With no helped answers this is the old `floor(right / 4)`, so the old numbers hold. A picture-on-screen right answer is worth half a flashed one: 8 of them for one step, 24 for "Nearly in flower" at most.
3. The `sb-grow` animation and the "X grew!" lines already follow `growth` (`SubitisingApp.tsx:127`, `:223-225`), so they appear without more code.
4. `src/subitising/voiceLines.ts:22-23` `guidedSummary` becomes: "The picture stayed on today, so your plants grew a little. Switch flashing back on to finish them." (Shown at `SubitisingApp.tsx:219`, spoken at `:134`.)
5. Not changed: how a stage is finished, the 85% rule, step back, review, and the saved key (the guided answers stay under `subh:` / `gaph:`).

Effects and limits to know:
- The saved key cannot tell a "keep the picture" answer from a help picture after a struggle (both `subh:`/`gaph:`, `saving.ts:14`). So help pictures also grow plants a little. That is fair (the child did the work, with the picture there), and no new key or server change is needed.
- Old guided answers saved since R3 become growth too (plants only go up). Guided answers saved before R3 are under plain keys and already counted.
- The server keeps the newest 30 answers per picture (`shared/subitising/saved.test.ts:114`). After months a not-yet-finished plant could lose a step if old right answers drop off. That already holds for flashed answers; it is not new.

### 3c. Screen-reader label

1. `src/subitising/voiceLines.ts`: export a small function `gapWords(counters, empty)` that returns "1 counter and 4 empty squares" (one or many, for both numbers), and use it inside `gapFeedback` (lines 39-41) so the plural rule lives in one place. The words after "Yes!" / "Not quite." stay exactly as now, so no gap-feedback clip changes.
2. `FlashRunner.tsx:200`: the Empty squares label becomes `The picture again. ${gapWords(trial.n, trial.answer)}.` (for example "The picture again. 1 counter and 4 empty squares.").

### 3d. Review heading

1. `src/subitising/voiceLines.ts` `PROMPTS`: add three lines, spoken and written the same:
   - `reviewFlash`: "A look back. How many did you see?"
   - `reviewGuided`: "A look back. How many can you see?"
   - `reviewGap`: "A look back. How many empty squares?"
2. `FlashRunner.tsx`: one small function `questionPrompt(trial, guidedMode)` picks the line for the heading (line 207) and the read-aloud (line 166): a struggle help picture and the demo keep their own lines first (as now); then if `trial.review` use the review line for the picture's own question, else the normal line (`PROMPTS.gap`, `guided`, `flash`). The visible `prompt` at lines 192-196 keeps the empty-square icon for a gap review picture.
3. The "Get ready" line is unchanged (it already names the question).

### 3e. New voice lines (a separate step on James's Mac)

New lines to record: `reviewFlash`, `reviewGuided`, `reviewGap` and the new `guidedSummary`. The old `guidedSummary` clip (`the-picture-stayed-on-today-so-your-plants-are-waiting-switch-flashing-back-on-and-they-will-grow.mp3`) must be deleted, because the voice test fails on a clip with no line (`src/subitising/voiceLines.test.ts:55`). The voice test also fails until the 4 new clips exist (line 51), so the clips must be in the PR before it can merge.
1. Rewrite the list: `WRITE_VOICE_LINES=1 npx vitest run src/subitising/voiceLines.test.ts` (writes `public/voice/quick-looks/lines.json`).
2. James runs `~/kokoro/.venv/bin/python -I scripts/voice-clips.py quick-looks` on the Mac (Kokoro `af_bella`; it only records lines with no clip). Commit the 4 new mp3 files and the deleted one.

## 4. Files affected

All inside Quick looks. None is a kit or shared-maths file.
- `shared/subitising/placement.ts`, `shared/subitising/engine.ts`, `shared/subitising/config.ts`
- `src/subitising/FlashRunner.tsx`, `src/subitising/SubitisingApp.tsx`, `src/subitising/voiceLines.ts`
- Tests: `shared/subitising/subitising.test.ts`, `src/subitising/SubitisingApp.test.tsx`
- Voice: `public/voice/quick-looks/lines.json` and clips (4 new, 1 removed)
- `shared/subitising/config.ts` is inside the Training function bundle (`supabase/functions/training/index.ts:5`), so run `npm run build:functions -- training` in the same PR and commit the rebuilt `supabase/functions/training/index.ts`. `engine.ts` and `placement.ts` are not in that bundle.
- Not touched: `shared/training`, `shared/maths`, `src/maths`, `src/styles.css`, `src/components`, `src/kit`.

## 5. Database / migration needs

None. No table, column or key changes. The check's answers are not saved and the guided answers keep their `subh:` / `gaph:` keys. The rebuilt Training function goes live when the PR merges (guide section 8); James decides when (outside school hours, Mon to Fri 8:45 to 3:00 NZ).

## 6. Test steps

Quick looks already has many tests, so change the existing ones and add at most 3 new (a "game" gets 8 at most, and the tests are for rules, not wording).
1. `subitising.test.ts` placement group (lines 381-426): rewrite `play(firstFail)` so a stage fails by a wrong answer pattern, then check (new test 1) the rule exactly: 3 right passes after 3 pictures; 2 right then right passes after 4; 2 right then wrong fails after 4; 1 right fails after 3; a stage test never repeats a key; all right is 9 pictures and start stage 7; all wrong is 9 and start 1; `placementOver` is true only after 3 decided tests. Keep the "ended early uses the best guess" check with the new lengths.
2. `subitising.test.ts:225` (garden): keep the three existing lines (they still hold) and add one: 8 right helped answers on stage 1 give level 1, 24 give level 3 and never 4, and a finished stage stays 4 (new test 2).
3. `SubitisingApp.test.tsx:98-125` (the check): loop until the button says "Finish" instead of `C.placementTrials`; all right lands on stage 7 and saves no answers.
4. `SubitisingApp.test.tsx:168-178` (a whole guided round): change to "no stage finishes, `finished` stays 0, a plant grew, and the summary says 'grew a little'". Add one assertion that a gap picture's label reads "1 counter and 4 empty squares" (new test 3, only if it fits in the existing gap test; otherwise skip it).
5. `src/subitising/voiceLines.test.ts` needs no new test; it fails until the list and clips are right.

Play the preview (`preview/subitising/`):
- New child: demo, then the check. Answer all right: 9 pictures, then "You'll start with Mix it up" (stage 7). Answer one stage's pictures badly: it stops after 3.
- Get exactly 2 of 3 right on one stage: a 4th picture comes.
- Tick "Keep the picture on the screen" and play a round: summary says plants "grew a little", a plant moves one step, nothing reaches "In flower".
- With a screen reader (or the accessibility tree), the Empty squares answer picture reads "1 counter and 4 empty squares".
- Reach a finished stage, then Empty squares: a review dot picture starts with "A look back."
- Check the voice with "Read the words out loud" on once the clips are in.

## 7. Size and impact

M because the check changes length and needs one small new prop on the runner, plus a voice step. Impact is Med: it improves the start stage for every new child and gives guided children visible growth, but it does not change the maths of any stage.

## 8. Session prompt (ready to paste)

```text
You are fixing Quick looks (the dot-flash activity inside Training) in the School Games Hub repo (/Users/jriley/games-hub-trader-captains or a fresh worktree).
Create branch fix/quick-looks-placement from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 1, 2, 6 and 10) and docs/plans/maths-review-2/S29-quick-looks-placement-and-fixes.md first, then docs/reviews/maths-review-2/games/quick-looks.md.

Goal: a fairer starting check, plants that grow in guided mode, a proper screen-reader label and a review heading.
Steps:
1. Starting check (plan 3a): in shared/subitising/placement.ts add testOutcome (3 pictures; 3 right passes; 0 or 1 right fails; exactly 2 right shows a 4th, which decides), rewrite searchFrom and placementTrial for tests of 3 or 4 pictures with no repeated key and no same type twice in a row, add placementOver, remove PLACEMENT_PER_TEST and placementTrials from config.ts (maximum 12 pictures). In src/subitising/FlashRunner.tsx add the optional over() prop and hide the progress dots in the check; in SubitisingApp.tsx pass total 12 and over.
2. Garden (plan 3b): in shared/subitising/engine.ts count right helped answers per stage (helpedRight), change growth to min(3, floor((2*right + helpedRight)/8)); finished stays 4. Change the guidedSummary line in voiceLines.ts.
3. Label (plan 3c): export gapWords from voiceLines.ts, use it in gapFeedback and in the label at FlashRunner.tsx:200.
4. Review heading (plan 3d): add reviewFlash, reviewGuided, reviewGap to PROMPTS and a questionPrompt function in FlashRunner.tsx used for the heading and the read-aloud.
5. Tests as in plan section 6: edit the existing placement, garden, check and guided-round tests and add at most 3 new. Do not add more.
6. Voice (plan 3e): run WRITE_VOICE_LINES=1 npx vitest run src/subitising/voiceLines.test.ts. The clips need James's Mac (Kokoro): stop and ask James to run ~/kokoro/.venv/bin/python -I scripts/voice-clips.py quick-looks, then commit the 4 new clips and delete the old guidedSummary clip. Do not merge before the clips are in.
7. Run npm run build:functions -- training in the same PR (config.ts is in the Training bundle), then npm test, npx tsc --noEmit and lint.
8. Play the preview as in plan section 6.
Do not touch shared/maths, src/maths, src/styles.css, src/components or any kit file. Do not change the saved keys, shared/training or the database.
Stop and tell James before any live step (the rebuilt training function goes live on merge; do it outside school hours). Open a PR when done.
```
