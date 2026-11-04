# Quick looks (subitising): review plan

*Written 4 November 2026 for James. Quick looks went live on 21 October 2026 (see [SUBITISING-PLAN.md](SUBITISING-PLAN.md) section 13). This is a plan for checking it, not a change: nothing in the game is touched until James picks which parts to do.*

**Status: plan only. Waiting for James to pick parts.**

## What gets reviewed

Code: `shared/subitising/` (config, patterns, engine, trials, placement, keys, saved), `src/subitising/` (FlashRunner, PictureSvg, Garden, SubitisingApp, CSS), the Quick looks parts of `shared/training/save.ts` and the `training` function. Live data: Quick looks rows in `training_answers` (keys `sub:`, `gap:`, `subh:`, `gaph:`) and `training_students.typing.q`, read only.

## The review, in eight parts

Each part ends with a short list of findings (fix now / later / leave) added to this file. Fixes are a separate step James says yes to.

### A. Maths progression
- Stage ranges and picture types against James's research document (section 3 of the build plan).
- Does each stage actually reach every number in its range? (For example, stage 3 `five` stops at 5 and `fiveplus` is only 6 to 7.)
- The starting check: 6 pictures, up one stage when right, down when wrong, from stage 3. Simulate every answer pattern to see where students land. Early look (worked out exactly): a student who is right half the time lands on stage 4 a quarter of the time and stage 1 a quarter of the time, so the last answer or two decides a lot. A student right 80% of the time lands on stage 3 or below about a quarter of the time.
- Stage finishing (7 of the last 8, each type seen twice) and stepping back (below 60% over 5: the first picture type only, the smaller half of the numbers). Is it too easy or too hard to move on? Simulate students at 60%, 75%, 90% right.
- Review pictures (a fifth from finished stages): does that feel right once a student has finished all four stages?

### B. Dot layouts (the pictures)
- Every picture type at every number, drawn on one sheet to look at: no overlaps, no counters touching the frame edge, dice faces drawn the standard way, ten-frames filled in the right order.
- Missing Spots: frames always have at least one gap and at least one counter.
- Do two pictures of the same number look different enough that students can't learn the picture instead of the number?
- Colour pairs: readable for colour-blind students (check with a simulator).

### C. Timing
- Flash times per stage (1.2 s to 0.6 s). Early look: the shorter "going well" time only kicks in at the same 85% that also finishes the stage, so students almost never see it. Decide if that is wanted.
- Measured flash length in a real browser at normal speed and at 6x CPU slowdown (never done; the build plan lists it). The clock starts in `requestAnimationFrame`, then uses `setTimeout`.
- The 0.7 s "get ready", 1 s answer lock and 0.5 s Peek again: do they feel right?

### D. Feedback and help
- Right and wrong feedback words, the help view (picture stays with groups outlined), Peek again, guided mode ("keep the picture on the screen").
- Struggle trigger (two wrong in a row, or more than 4 s thinking): does it come too often for a slow but careful student?
- Garden growth: does it visibly move in a normal 12-picture session?
- The answer is never shown or said before the student answers (including read-aloud and the screen-reader line).

### E. Accessibility and young students
- Axe check on every screen, keyboard only, a screen reader pass, reduced motion, contrast (the research document asks for 7:1), button sizes (48 px minimum, 54 px on tablets).
- Early look: number keys only take 1 to 9, so a keyboard user can't answer 10 or 11 on ten-frames.
- Read-aloud on a real Chromebook and phone voice.
- A 5-year-old's path in: sign in, find Training, find Quick looks, with no reading. The build plan says this is word-based today.
- Phone on its side: the hub's top bar scrolls sideways (known, outside Quick looks).

### F. Saved data and teacher use (read only)
- How many students have used Quick looks since 21 October, how many sessions, which stages they reached, right-share per stage and picture type, how often help view comes up. No names in the write-up.
- Any answers refused by the server, any stuck in queues, any students asked to redo the starting check (missing settings).
- Check the facts map is still untouched by Quick looks answers for a few real students.
- Is there anything a teacher should see (stage only, never times)? This needs the teacher view (TEACHER-VIEW-PLAN.md), so it is a "later" note.

### G. Bugs and code health
- Run the Quick looks tests and the Training save tests; look for gaps (placement spread, flash time switch, keyboard 10, review once all stages finished).
- Play through as a test student on the live site: starting check, a session with wrong answers, help view, Peek again, guided mode, leaving mid-session, reload on a second device.
- Missing Spots answer buttons: early look, a five-frame gap can offer 5 even though the answer is never more than 4.

### H. What's next (from the research document)
- What is still not built: stages 5 and 6, scattered dots, Compare, Same Number, Make the Target, Look-Group-Select, finger and koru cards, te reo prompts, teacher view.
- A short ranked list of which to build next, so James can pick.

## How it would run

- Parts A, B, C, F and G can be done by helper agents (simulations, picture sheet, tests, read-only queries); the main thread checks their results.
- Parts D and E need a real browser with screenshots; a real Chromebook and phone check is for James.
- Output: findings added below each part here, the picture sheet in project files (`subitising-review/`), and one PR with any fixes James approves.

## Findings

*(Empty until the review runs.)*
