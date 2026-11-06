# R3: Quick looks fixes

## 1. The problem
Four small problems in Quick looks, the dot-flash activity (not a game folder: it is Training's `/training?quick=1`, code in `src/subitising/` and `shared/subitising/`).

1. **"Keep the picture on the screen" practice counts towards passing.** A child (or a teacher with the setting on) can pass every stage with the picture always showing, which is counting, not "seeing at a glance". The saved answers look the same as flashed ones, so a teacher cannot tell. Evidence: `FlashRunner.tsx:109` (guided thinking time is 0, answers still go to `onAnswer`); `SubitisingApp.tsx:87` only marks an answer as helped when `r.helped` (a struggle help), not for guided mode; `shared/subitising/engine.ts:71-73` skips only helped answers; `saving.ts:11-18` saves under the plain key unless `a.helped`. (Evaluation, problem 8.)
2. **No reaction time is saved.** `saving.ts:14` saves `ms: 0` for every answer, so nobody can ever see hesitation, and a teacher view (R7) has nothing to read. The server already accepts a time on Quick looks keys: `shared/training/save.ts:138` allows `ms` from 0 to `rejectAnswerMs` (600000); only `typingMs` must stay 0 (line 134).
3. **A new child starts with no example.** The starting check begins at stage 4 (3 to 7 dots, five-frames): the very first picture is among the harder ones and flashes before the child has seen how it works. (`placement.ts` header: "the first at stage 4"; evaluation, problem 1.)
4. **Help-prompt wording is wrong in two cases.** After two wrong answers the picture stays and the heading says "Take your time. Can you see smaller groups?" (`FlashRunner.tsx:202`, voice line `PROMPTS.helped`, `voiceLines.ts:15`) even for a single dot (there are no smaller groups) and even for the empty-squares pictures, where the question is "How many empty squares?". And a right and a wrong answer to an empty-squares picture get the identical sentence ("3 counters and 2 empty squares make 5.", `voiceLines.ts:27`), so the child doesn't hear yes or not quite. (Evaluation, problems 3 and 4.)

Live data (DECISIONS.md): 21 pupils, 378 counted answers, 81% right; 43 helped answers, 74% right.

## 2. The research behind it
Subitising is quick recognition of small groups without counting (research-maths.md, subitising); letting the picture stay on removes the very skill being trained, so it should be practice only. Feedback should say whether the answer was right (research-design.md, feedback). Time to answer is the main sign of fluency and is needed for any teacher view (R7).

## 3. The change
All four are in Quick looks only, using its own files.

### 3a. Keep-picture practice doesn't count to pass
1. `FlashRunner.tsx`: add `guided: boolean` to `AnswerResult` (line 11) and set it from `guidedMode` in `choose` (line 110).
2. `SubitisingApp.tsx` `onPracticeAnswer` (line 85): when `r.guided`, save the answer as helped (`helped: r.helped || r.guided`) both in the local `answer` (so `progressFrom` ignores it, so the garden and stage do not move) and in the `onAnswered` event (so `saving.ts` saves it under the `subh:` / `gaph:` key as it does for help pictures). The check (`checking`) is not changed.
3. The "pictures looked at" counting for the round: `finishSession` (line 100) counts answers without help. Replace it with a small ref that counts each picture where `!r.helped` (struggle help only) so a guided round still finishes as a round for "Training before games". Keep the `looked` counter as now.
4. Say so to the child on the summary screen (line 182 area), only when `state.guidedMode` is on: "The picture stayed on today, so your plants are waiting. Switch flashing back on and they will grow." Add it to `allVoiceLines` as a new line.
5. Old guided answers already saved under plain keys cannot be told apart; leave them.

### 3b. Save the reaction time
1. `SubitisingApp.tsx` `QuickAnswerEvent` (line 17): add `thinkingMs: number`; set it from `r.thinkingMs` in the `onAnswered` call (line 96).
2. `saving.ts`: `ms: Math.round(a.thinkingMs)` instead of 0 (keep `typingMs: 0`). Guided and helped answers are already 0 (thinking time is 0 when the picture stays).
3. This is the time from the buttons unlocking to the tap, which does not include the voice, so no voice fix is needed.
No server change: `shared/training/save.ts` already accepts it and `training_answers.answer_ms` is already a column.

### 3c. A demo first
1. New small screen `'demo'` in `SubitisingApp.tsx`: `startCheck` (line 71) goes to `'demo'` first, but only when the child has not placed yet (`!state.placed`); the "Do the starting check again" button skips the demo.
2. The demo is one `FlashRunner` with `total={1}`, `guidedMode` true (the picture stays), `checking`, and a fixed easy picture: stage 1, a line of 3 dots, made with the same function the check uses (`buildTrial(progressFrom([], 1), seed, 0, null, { ...CONFIG, reviewShare: 0 })`). Its answer goes nowhere (no saving, no check list). Finishing it goes to the real check.
3. A new optional prop `intro?: string` on `FlashRunner` replaces the heading for this screen: "This is how it works. A picture shows, then hides. Tap how many dots you saw. This one stays so you can practise." Spoken the same way as other prompts.
4. Not in this plan (a bigger change, for James to decide later): moving the check's first test from stage 4 to stage 2.

### 3d. Help-prompt wording
1. `voiceLines.ts` `PROMPTS`: `helped` becomes three lines: `helpedGroups: 'Take your time. Can you see smaller groups?'` (unchanged, for 2 or more dots), `helpedOne: 'Take your time. Look carefully.'` (when the answer is 1), `helpedGap: 'Take your time. How many empty squares?'`.
2. `FlashRunner.tsx` line 202 (heading) and line 162 (voice) pick one by `trial.activity === 'gap'`, then `trial.answer === 1`. Line 215 (screen reader "Look for the groups. How many?") says "Look carefully. How many?" for one dot.
3. `gapFeedback(counters, empty, capacity, correct)`: right: "Yes! 3 counters and 2 empty squares make 5."; wrong: "Not quite. 3 counters and 2 empty squares make 5." (pass `result.correct` at `FlashRunner.tsx:39`).
4. New voice lines need recorded clips: update `allVoiceLines` (and so the gap-feedback lines double), refresh the list with `WRITE_VOICE_LINES=1 npx vitest run src/subitising/voiceLines.test.ts`, then James runs `scripts/voice-clips.py quick-looks` on the Mac (Kokoro `af_bella`) and the clips are committed. Until then the browser voice reads the new lines.

## 4. Files affected
All inside Quick looks, none shared:
- `src/subitising/FlashRunner.tsx`, `SubitisingApp.tsx`, `saving.ts`, `voiceLines.ts`
- tests: `saving.test.ts`, `SubitisingApp.test.tsx`, `voiceLines.test.ts` (list file `public/voice/quick-looks/lines.json` and new clips in the same folder)
- Not touched: `shared/subitising`, `shared/training`, `supabase/functions/training`, `shared/maths`, `src/components`.

## 5. Database / migration needs
None. The answers use existing columns (`answer_ms`, the `subh:` and `gaph:` keys). Client-only, so no function is redeployed.

## 6. Test steps
Automated (a few changes to existing tests, at most 3 new):
1. `saving.test.ts`: a guided answer is saved under `subh:...`; a plain answer carries its `thinkingMs` as `ms` and still passes the server check (the existing "is something the server accepts" test, with `ms` > 0).
2. `SubitisingApp.test.tsx`: with "keep the picture" on, 12 correct answers do not finish a stage or grow a plant, and the round still counts as finished (extend the existing guided-mode test at line 90).
3. `voiceLines.test.ts`: existing tests cover the list being up to date and each line having a clip name; refresh the list.

Play the preview:
- New pupil: the first thing is the demo with the picture staying, then the check starts flashing. "Do the starting check again" skips the demo.
- Tick "Keep the picture on the screen", play a round: the summary says the plants are waiting, and no plant grows.
- Get two wrong in a row on a single dot and on an empty-squares picture: the help line fits each.
- Answer an empty-squares picture right and wrong: "Yes!" versus "Not quite."
- In the Training page check a saved answer has a non-zero time (preview data).

## 7. Effort and impact
S, Med. Four small contained fixes. Guided-mode counting and the saved time matter most because they make Quick looks' data honest and are needed before a teacher view.

## 8. Session prompt (ready to paste)
```text
Work in /Users/jriley/games-hub-isles. Create a new branch and worktree from origin/main called quick-looks-fixes. Read docs/GAME_DEVELOPMENT_GUIDE.md first, then docs/plans/maths-review/R3-quick-looks-fixes.md and follow it. Everything is inside src/subitising (client only). Steps: (1) keep-picture practice: add guided to AnswerResult in FlashRunner.tsx, save guided answers as helped (subh:/gaph: keys, ignored by progressFrom) in SubitisingApp.tsx onPracticeAnswer, count a round's pictures with a ref so a guided round still finishes, and add the summary line when guided mode is on. (2) save reaction time: thinkingMs on QuickAnswerEvent, ms: Math.round(thinkingMs) in saving.ts, typingMs stays 0. (3) a demo first: a new 'demo' screen before the starting check for a new pupil (one stage 1 line of 3 dots, picture stays, answer saved nowhere), with an intro prop on FlashRunner and the words in the plan. (4) help-prompt wording: three helped lines (groups, one dot, empty squares) chosen in FlashRunner, and gapFeedback gets Yes! / Not quite. (5) update allVoiceLines and refresh the list with WRITE_VOICE_LINES=1 npx vitest run src/subitising/voiceLines.test.ts; tell James the new clips need making with scripts/voice-clips.py quick-looks on his Mac. (6) tests: saving.test.ts, the guided-mode test in SubitisingApp.test.tsx; run the checks. Do not touch shared/maths, shared/training, src/maths, src/styles.css or src/components. Stop and tell James before any live step; open a PR when done.
```
