# R2: Fair step-up for careful children

## 1. The problem
In the Foundational games a fact only moves up a box when it is answered correctly **within 5 seconds**. The 5-second clock starts while the voice is still reading the question aloud (4 to 6 seconds for some questions), and the limit is the same for a five-year-old as for a ten-year-old. A slow, careful child who gets everything right can see no box move at all, so the game keeps asking the same facts, and a quick tapper who guesses can be moved on.

Evidence:
- `shared/maths/config.ts:53` `QUICK_MS = 5000`; `leitner.ts:59` `if (ms > quickMs) return next;` (correct but slow keeps the box).
- The live saving path: `supabase/functions/_shared/recordAnswers.ts:50` passes `quick_ms: quickMsForPack(pack)` to the database function `record_fact_answers` (migration `20261017001200_fact_answers.sql:75`, `elsif a.ms <= quick_ms`). The early facts pack has no exception (`QUICK_MS_BY_PACK` only has `generated`).
- The clock starts at the moment the question appears, not when the voice stops:
  - Hop `src/games/hop/Hops.tsx:56` (`since.current = Date.now()` then `say(...)` on line 57)
  - Penguin Pairs `src/games/korora/Goes.tsx:92-93`
  - Tūī `src/games/tui/Goes.tsx:80` (then `say(askLine(go))`)
  - Pipi `src/games/pipi/Goes.tsx:92-93` (inside the "tide" timer, then `say`)
  - Weka `src/games/weka/Goes.tsx:142`, `:203` and `:273` (each followed by or next to a `say`)
  - Beanstalk `src/games/beanstalk/Round.tsx:56` (the clock starts at mount, the voice is on line 64)
- The hop evaluation (Hop, weakness a) and DECISIONS.md pattern 3.
- Live data (DECISIONS.md): the early facts are answered 80 to 95% right, so accuracy is fine. The risk is boxes that never move for careful children.

## 2. The research behind it
Fluency is about correct answers that become easier over time, but the speed limit has to suit the age of the child and must not count time spent listening (research-maths.md on fluency and timing; research-design.md, feedback and clarity). A "quick" limit that is too short punishes careful thinkers and rewards guessing.

## 3. The change
Two small changes, applied to the six Foundational games (Hop, Penguin Pairs, Pipi, Beanstalk, Tūī, Weka). No change to `shared/maths`.

**Decision: the junior quick time is 10 seconds (10000 ms) for all six games**, a single constant `JUNIOR_QUICK_MS = 10_000` in a new file `shared/juniorQuick.ts`. (The 5 s rule stays for Times Tables and everything else.) Reasoning: with the voice no longer counted, 10 s is generous for a child counting on the ten-frame, and still stops a child who wanders off from moving up. James can change the number in one place.

### A. Start the answer clock after the voice stops
1. Make the voice report when it has finished. In `src/speech.ts` change `speak(text, clipFolder?)` to `speak(text, clipFolder?, onEnd?)`: call `onEnd` once when the clip ends (`audio` "ended") or, if the clip fails and the browser voice is used, when the utterance ends (`u.onend`; also on `onerror`). Do not call it if the speech was stopped or replaced by newer speech (`stopSpeaking`, or another `speak`). With no voice available at all, call it straight away.
2. In each game's `*Game.tsx` the `say` is `useCallback((text) => on && speak(text, VOICE_FOLDER), [on])`. Change it to take an optional second argument: `(text, onEnd?) => { if (on) speak(text, VOICE_FOLDER, onEnd); else onEnd?.(); }`, and widen the `say` prop type in the game's play screen to match. With read-aloud off the clock starts at once, as now.
3. In each game's clock line (list in section 1): keep the existing `since.current = Date.now()` (so a child who taps before the voice ends is still timed fairly), and pass `() => { if (live && !tapped.current) since.current = Date.now(); }` to the question's `say` call, where `live` is a flag set false in the effect's cleanup (a new question started) and `tapped` is false until the first tap on this question. This stops the end of an old line moving a clock that already belongs to a newer question or a tap.
4. Only the **question line** gets the callback. "Yes!", "Try again" and other lines do not touch the clock.
5. Weka has three clock starts. For each, put the callback on the `say` that follows it. Beanstalk's clock runs between taps; its voice only matters for the first pair, so apply it to the opening `say(WORDS.tapTwo ...)` on line 64 only.

### B. Use the junior quick time when answers are recorded
The live record is made in `supabase/functions/_shared/recordAnswers.ts`, which also serves about 20 other game functions. So this part touches one shared file and needs its own small branch first (see section 4).
1. `recordMathsAnswers(...)` gets one new optional last parameter `quickMs?: number`. When given, `quick_ms: quickMs ?? quickMsForPack(pack)`.
2. Each of the six games' `supabase/functions/<game>/entry.ts` passes `undefined, JUNIOR_QUICK_MS` after `'<game>'` (the sixth parameter is the batch-id maker, which stays default).
3. The preview ("trial") copies of the same rule use the same constant instead of `quickMsForPack('early-facts')`: `shared/hop/server.ts:102`, `shared/korora/server.ts:107`, `shared/pipi/server.ts:104`, `shared/tui/memoryServices.ts:101`, `shared/weka/server.ts:109` (that one is `'add-sub'`). Beanstalk has no copy.
4. Facts already recorded stay as they are. Nobody moves backwards.

No new child-facing words, so no new voice clips.

### Why one branch can touch six game folders
The game rules say a game branch stays inside its own game. Part B2/B3 and the clock line in Part A3 are each about one line per game (plus the one-line `say` change), the same line repeated in six places, and they only work together. So after the shared branch is merged, one branch `junior-quick-games` may touch all six game folders. Review it as "the same change six times".

## 4. Files affected
Shared (its own small branch `maths-junior-quick`, merged and live **before** the games branch; ask James first, per the guide's shared-code rule):
- `src/speech.ts` (the optional `onEnd`)
- `supabase/functions/_shared/recordAnswers.ts` (+ `recordAnswers.test.ts`)
- `shared/juniorQuick.ts` (new, one constant)
- Rebuild the `index.ts` of every function that bundles `_shared/recordAnswers.ts` (`npm run build:functions`); they redeploy when it merges, so choose a time outside school hours (Mon to Fri 8:45 to 3:00 NZ).

Games branch `junior-quick-games` (one line each, six games):
- `src/games/{hop/Hops.tsx, korora/Goes.tsx, pipi/Goes.tsx, tui/Goes.tsx, weka/Goes.tsx, beanstalk/Round.tsx}` (clock) and each `*Game.tsx` (`say`) and each play-screen `Props`
- `supabase/functions/{hop,korora,pipi,tui,weka,beanstalk}/entry.ts` and their rebuilt `index.ts`
- `shared/{hop,korora,pipi,weka}/server.ts`, `shared/tui/memoryServices.ts`

Not touched: `shared/maths`, `src/maths`, `src/styles.css`, `src/components`.

## 5. Database / migration needs
None. `record_fact_answers` already takes `quick_ms` as an argument. The change goes live by itself when each PR merges (functions are redeployed from the rebuilt `index.ts`).

## 6. Test steps
Automated:
1. `shared/juniorQuick.test.ts`: with `afterAnswer(..., 8000, ..., JUNIOR_QUICK_MS)` a correct answer moves up a box and with the default 5000 it does not (and 11000 does not move at the junior time either).
2. `recordAnswers.test.ts` (shared): passing `quickMs` reaches `record_fact_answers` as `quick_ms`; leaving it out still uses the pack's time.
3. One test per game is not needed; the six games share the same two lines. Add at most one to a single game's tests: `say` is called with a callback and the clock is reset when it is called (Hop).

By playing the preview (read-aloud on, then off):
- Read-aloud on: tap the right answer 3 seconds after the voice ends, then check the saved time (the preview's records) is about 3000, not 8000.
- Tap while the voice is still talking: the time is small but not negative or zero.
- Read-aloud off: the clock starts when the question appears.
- Answer a question 7 seconds after the voice ends (correct): the fact now moves up a box; before this change it did not.
- Skip to the next question during a long voice line: the old line ending must not move the new clock.

## 7. Effort and impact
S, High. The same two changes repeated six times, no new screens, but it fixes the main way the games stall careful children (and so the list of "ready for next" facts the teacher sees).

## 8. Session prompt (ready to paste)
```text
Work in /Users/jriley/games-hub-isles. This is two branches, in order. Read docs/GAME_DEVELOPMENT_GUIDE.md first, then docs/plans/maths-review/R2-fair-step-up.md and follow it.

Branch 1: create maths-junior-quick from origin/main (own worktree). It is shared code, so tell James what it touches before starting. Steps: (1) src/speech.ts: speak(text, clipFolder?, onEnd?) calls onEnd once when the clip or browser voice finishes (also on error or fallback end), never when cancelled, and straight away if there is no voice. (2) New shared/juniorQuick.ts exporting JUNIOR_QUICK_MS = 10_000. (3) supabase/functions/_shared/recordAnswers.ts: new optional last parameter quickMs, used as quick_ms ahead of quickMsForPack(pack); extend recordAnswers.test.ts. (4) Add shared/juniorQuick.test.ts as in the plan. (5) Rebuild every function index.ts that bundles recordAnswers (npm run build:functions), run all checks. Do not touch shared/maths. Stop and tell James before any live step (this redeploys about 20 functions, so it should merge outside school hours); open a PR when done.

Branch 2 (after branch 1 has merged): create junior-quick-games from origin/main. It touches the six game folders (hop, korora = Penguin Pairs, pipi, tui, weka, beanstalk) only because each change is one line per game. Steps: (1) in each *Game.tsx change say to (text, onEnd?) => { if (on) speak(text, VOICE_FOLDER, onEnd); else onEnd?.(); } and widen the say prop type. (2) in each game's clock lines (Hops.tsx:56, korora/Goes.tsx:92, pipi/Goes.tsx:92, tui/Goes.tsx:80, weka/Goes.tsx:142, :203, :273, beanstalk/Round.tsx:64) keep since.current = Date.now() and also reset it from the question line's say callback, guarded by a live flag (cleared in the effect cleanup) and a tapped flag. (3) in supabase/functions/<game>/entry.ts pass undefined, JUNIOR_QUICK_MS to recordMathsAnswers; use JUNIOR_QUICK_MS in shared/hop/server.ts, shared/korora/server.ts, shared/pipi/server.ts, shared/weka/server.ts and shared/tui/memoryServices.ts instead of quickMsForPack. (4) rebuild only those six functions (npm run build:functions -- hop korora pipi tui weka beanstalk) and commit their index.ts. (5) at most one new test (Hop: say is called with a callback and it resets the clock), then run the six games' tests, typecheck and lint. Stop and tell James before any live step; open a PR when done.
```
