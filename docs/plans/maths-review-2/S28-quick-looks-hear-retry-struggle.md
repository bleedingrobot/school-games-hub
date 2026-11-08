# S28: Quick looks: hear the question, get a second try, drop the 4-second struggle rule

**Game:** Quick looks
**What's wrong:** The question is only read aloud if a child finds and turns on the voice, which is off by default. A wrong answer shows the answer at once with no second try. Thinking longer than 4 seconds counts as struggling, so a careful child gets help they did not need.
**What done looks like:** Young children hear the question without setting anything. After a wrong answer the picture comes back once for a second try. Only two wrong in a row count as struggling.
**Size:** M
**Impact on learning:** High
**Waits for:** nothing (S29 also edits `FlashRunner.tsx`; merge one first)

## 1. The problem

- Read-aloud is off until a child turns it on: `readSaved()` is true only if saved as "true" (`src/speech.ts:11-17`). The Quick looks voice effect only runs when `reading` is on (`src/subitising/FlashRunner.tsx:162-169`). `useReadAloud` is at `src/speech.ts:124`. This file is used by many games, so it is shared.
- `choose` (`FlashRunner.tsx:110`) sets the feedback phase at once and records the answer. There is no retry.
- `isStruggling` (`shared/subitising/engine.ts:94-98`) is true after two wrong in a row (`struggleWrongInARow: 2`) or when the last answer took longer than `struggleThinkingMs: 4000` (`shared/subitising/config.ts:68`). The thinking time starts when the buttons unlock (`unlockedAt`, `FlashRunner.tsx:95`, `:104`), and the lock is `answerLockMs` 1000 (`config.ts`), not after the voice has finished.
- The empty-squares label "1 counters" (`FlashRunner.tsx:200`) is fixed by S29, not here.

## 2. The rule behind it

- Rule 2: voice first, for children who cannot read.
- Rule 7: mistakes teach; a second try is a chance to think.
- Rule 8: fair timing. The clock starts after the voice, and thinking longer is not a fault.

## 3. The change

### Part 1: a default for read-aloud (shared file, own small branch)

1. In `src/speech.ts` let `useReadAloud` take an optional `{ defaultOn }`. The saved choice still wins. When nothing is saved, use `defaultOn`. No game words.
2. One test. Every other game keeps the current default (off) because they do not pass the option.

### Part 2: Quick looks

1. `SubitisingApp.tsx:60` calls `useReadAloud({ defaultOn: true })`. The "Voice off" button (`FlashRunner.tsx:266`) still works and is remembered.
2. Start the thinking clock after the question has been spoken: when reading is on, unlock after `speak(..., onEnd)` (`src/speech.ts:76`) and set `unlockedAt` then (rule 8). If reading is off, as now.
3. One second try: when the first answer on a picture is wrong, wobble that button, show the picture again for `peekMs` (`config.ts`), and let the child answer once more with the wrong button greyed. Save only the first tap as the answer (`onAnswer` is called with the first tap, so the records stay honest). The second try is not saved and moves no stage. If the second try is right: the usual "Yes" feedback. If wrong: show the answer as now.
4. Drop the time clause in `isStruggling` (`engine.ts:97`) and the `struggleThinkingMs` setting. Keep "two wrong in a row". Update the tests in `shared/subitising/` that use it.
5. Update the voice line list if a new line is needed ("Try once more") and the clip list (`src/subitising/voiceLines.ts`, `voiceLines.test.ts`).

Kit parts used: `src/kit` `HearAgain` if a "hear it again" button fits next to the question; no kit change.

## 4. Files affected

- Part 1 (own branch): `src/speech.ts` and its test.
- Part 2: `src/subitising/FlashRunner.tsx`, `SubitisingApp.tsx`, `voiceLines.ts`, `shared/subitising/engine.ts`, `config.ts`, tests. If `shared/subitising/` changes, run `npm run build:functions`.
- No kit change.

## 5. Database / migration needs

None. The saved answers are unchanged (first tap only).

## 6. Test steps

Automated (4 tests in Quick looks, 1 in speech):
1. `useReadAloud({ defaultOn: true })` is on when nothing is saved, and a saved "false" wins.
2. After a wrong first answer a second try is allowed and only the first tap is passed to `onAnswer`.
3. A slow correct answer does not make the next picture a help picture; two wrong in a row still do.
4. The thinking clock starts after the question's voice ends.

By playing: open Quick looks with nothing saved and hear the question; answer wrong once and get the picture back; take 10 seconds to answer and check no help appears.

## 7. Size and impact

M: a small shared change, then a second-try flow and a rule change. High: the youngest children can use it alone, and a slow answer is no longer treated as a fault.

## 8. Session prompt (ready to paste)

### Part 1: Read-aloud default (shared file)

```text
Branch: create speech-default-on-option from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S28-quick-looks-hear-retry-struggle.md first.
Steps: in src/speech.ts let useReadAloud take an optional { defaultOn } used only when nothing is saved; the saved choice always wins; no game words. Add one test. Every other game must keep the current default (off).
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Quick looks

```text
Branch: create quick-looks-hear-retry from origin/main (own worktree). Part 1 must be merged first.
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S28-quick-looks-hear-retry-struggle.md first.
Steps: call useReadAloud({ defaultOn: true }) in src/subitising/SubitisingApp.tsx; start the thinking clock after the spoken question ends; add one second try after a wrong first answer (only the first tap is saved, the second moves no stage); drop the 4 second rule from isStruggling in shared/subitising/engine.ts and the struggleThinkingMs setting in config.ts, keep two wrong in a row; add any new voice line and clip name. If S29 is on main, build on it (both edit FlashRunner.tsx). Never touch shared/maths, src/maths, src/styles.css or src/components.
Run npm run build:functions if shared/subitising changed. Tests: the 4 tests in the plan. Check the preview by playing.
Stop and tell James before any live step. Open a PR when done.
```
