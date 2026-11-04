# Quick looks (subitising): review plan

*Written 4 November 2026 for James. Quick looks went live on 21 October 2026 (see [SUBITISING-PLAN.md](SUBITISING-PLAN.md) section 13). This is a plan for checking it, not a change: nothing in the game is touched until James picks which parts to do.*

**Status: review done 4 November 2026 (James picked all eight parts). Findings below; the quick fixes are in the PR from branch `claude/project-thread-02h76d`.**

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

## Findings (4 November 2026)

Picture sheets and screenshots: project files `subitising-review/` (`quick-looks-sheet1-3.jpg` and browser screenshots).

### F. How it is being used (live data, 21 Oct to 3 Nov)
- 26 students did the starting check; only 15 went on to practise (2 to 28 answers each, about 200 answers in all). 11 stopped after the check.
- The check put 19 of 25 at stage 4 (ten-frames). Only 3 have finished all four stages.
- Flash and Identify: 83% right (ten-frames 74 to 84%). **Missing Spots: 55% right, and 16 of 61 answers were the number of counters shown, not the empty squares.** Students are mixing the two questions up.
- No times are saved (all 0), as planned. The facts map is untouched (checked by tests).

### A. Maths progression (simulations against the real code)
- **The starting check over-places.** A student who is truly at stage 2 is put at stage 3 or higher 85% of the time; a stage 3 student lands on stage 4 45% of the time; a stage 1 student lands on stage 3 or higher 35% of the time. The stages below count as finished, so they are only met again as review. *(Later: needs a design choice, see below.)*
- Practice pace is fine: nobody gets stuck within 50 sessions. Students right 90% of the time finish about one stage per session; at 60% right it takes about 12 sessions for all four.
- Stepping back works but narrows a lot: stage 3 step-back shows only five-frames 3 to 5, stage 4 only rows-filled ten-frames 5 to 8.
- Every number in each stage range appears. Stage 3 shows 6 and 7 more often than 3 to 5 (22% vs 15% each).
- Review is about 2 pictures in 12 once a stage is finished, as set.

### B. Pictures
- Passed: dot counts, no overlaps (closest dot edges 6.3 units), nothing outside the box, frames fill in the right order, dice layouts standard, Missing Spots always has a counter and a gap.
- **Fixed:** dice pips were drawn in two colours in the normal (not help) view, which gave away the grouping.
- **Fixed:** the turned dice touched the picture's border.
- **Later:** no variety for several types. line, dice, five, fiveplus, ten and tenpair always draw the same picture for a number, so a child can learn the picture rather than see the number. ten 10 and tenpair 10 are identical.
- **Later:** orange dots are 2.6:1 against the pale background (blue 4.9:1). Both stay distinct under colour-blind simulation.

### C. Timing
- Measured on screen: 1.217 s for 1.2 s and 1.016 s for 1.0 s (one frame long); at 6x CPU slowdown at most 35 ms more. Get ready 0.7 s, answer lock 1.0 s, Peek again 0.5 s. All as set.
- **Later:** the shorter "going well" flash never shows during a stage (0% of trials), because it starts at the same score that finishes the stage. It only shows in review. Stage 2's start and good times are both 1.0 s.

### D. Feedback and help
- The answer is never shown, written or spoken before the student answers.
- Feedback words are kind; the garden visibly grows in one session.
- **Fixed:** the help view (picture stays after two wrong) said nothing to screen readers.
- **Fixed:** guided mode asked "How many did you see?" while the picture is still there.
- **Fixed:** read-aloud kept talking after leaving the practice screen.
- **Fixed:** a Peek again after the buttons unlocked counted the peek as thinking time (could set off the help view).
- **Later:** "Finish for now" ends a session in one tap with no "are you sure".

### E. Accessibility
- axe: no problems on any screen. No sideways scroll at 1366, 1024, 390 and 844 wide. Reduced motion is fine (there is no animation).
- **Fixed: the answer buttons gave the answer away.** They were always centred on the answer: the middle button was right 68% of the time at stage 4, and in stage 2 always button 2 or 3. Now the answer sits at a random place in the row, and stage 4 no longer offers 11 (never right).
- **Fixed:** the keyboard could not answer 10 (now the 0 key).
- **Fixed:** focus was lost after answering (now moves to Next) and after Peek again (now the first answer button).
- **Fixed:** answer buttons were 12 px apart (now 16 px), the focus ring was about 2:1 (now darker), and on a 390 px phone the buttons wrapped 4 + 1 (now one row).
- **Later:** some small grey text is 6:1 (aim 7:1). A 5-year-old still has to read to find Training and Quick looks.

### G. Tests and bugs
- All 156 Quick looks and Training tests pass. Every key the game can make (68) is accepted and marked right by the server.
- **Fixed: settings could be wiped.** An older Training tab that never opened Quick looks saved the student without their Quick looks settings, so the starting check came back and long-finished stages could be lost. The database now keeps the saved settings in that case, and "stages finished" never goes down (migration `20261104000300`, with database tests).
- Leaving mid-session is safe: answers are saved once.
- **Later:** the Missing Spots five-frame offers 5 (never right) because 5 buttons are always shown; Missing Spots ten-frames offer 8 and 9. Ending the starting check after one answer places the student from that one answer.

### H. What to build next (ranked)
1. **(Done 4 Nov, see below.) Missing Spots wording and picture** (most students on it, 55% right, a quarter answering the wrong question): show the empty squares highlighted on the answer screen and say "How many EMPTY squares?" in big words.
2. **(Done 4 Nov, see below.) A fairer starting check**: e.g. two right in a row to go up, or 8 pictures, so stage 2 and 3 students aren't skipped ahead.
3. **More variety in pictures** (dice and frames turned or mirrored, rows filled from either end), so pictures can't be learned by shape.
4. **Stage 5 scattered dots** (the research document's next stage; most students are already at stage 4).
5. The "going well" flash: decide when it should start (e.g. after 6 of the last 8).
6. Then Compare, Same Number, teacher view (needs the teacher view plan), te reo prompts.

### Follow-ups done (4 November 2026)
- **Stage order changed** to James's seven stages (SUBITISING-PLAN.md section 15). Checked against published progressions (Clements and Sarama, NCETM Mastering Number, Glasgow subitising progression): small amounts first, structured before scattered, "how many more to make 10" after the frame is known, mixed last. They usually put dice before ten-frame to 5; James kept ten-frame to 5 first.
- **Missing Spots:** the question is now shown (and read) on the Get ready screen before the picture, the empty squares are tinted on Missing Spots pictures, and the prompt says "How many **empty squares**?" with an icon.
- **Starting check:** now 6 pictures, two per stage, a binary search over the 7 stages (first test at stage 4). Worked out exactly for a student right 90% on stages they can do and 30% above: about two thirds land on the right stage, and misses lean low (safer) instead of high. The old up/down walk put a student who could do stage 2 too high 92% of the time.
