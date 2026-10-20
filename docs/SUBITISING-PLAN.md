# Quick looks (subitising): plan

*A picture-flash practice inside Basic facts Training, where students learn to see how many at a glance instead of counting. Written 21 October 2026 for James, from his research document "Subitising Practice Design Plan" (Google Doc 1WF34d0sqY-5gayF3ogjNpvHQAmQ6GV1mbMX3_USpjHA). Every number below was read from the document, including the ones that were equation pictures.*

**Status: planned and answered (section 10). Nothing is built. James said (21 Oct 2026) the website is now for all primary ages, so the document's ages (5 to 8) apply directly.** Stop for James after each step in section 9.

## 1. The idea in one paragraph

A picture (dots, a dice face, a five-frame, a ten-frame) flashes for a short moment and goes. The student taps how many they saw. There is no clock on answering, and speed is never scored. If a student struggles the picture stays on screen with groups drawn round the dots. Progress is by stage, shown as a growing garden, never as speed colours. It lives inside Training, next to "Today's session", as a "Quick looks" button.

## 2. Where it fits

- **Inside Training**, not a new game. Training is live; answers go through `shared/training/save.ts`, the `training` server function and the `training_answers` table (own records, separate from the games).
- It is the picture half of Training's planned **T.4 Early facts** (ten-frames, bonds, a garden), so they share art. See [TRAINING-PLAN.md](TRAINING-PLAN.md).
- **No clocks, no leaderboards, no red** (James's Training rules) match the document.
- **No database change for the first release.** `training_answers.fact_key` must match `^[a-z0-9]{1,12}:[0-9a-z/+-]{1,20}$`, so keys like `sub:ten-8` fit. The answer is one whole number, which the server can mark from the key.
- Random pictures come from `shared/seededRandom.ts` or `shared/maths/serverQuestions.ts`' `seededRandom` (not a new Mulberry32).

## 3. The six stages (from the document)

| Stage | Pictures | Range | Flash (new → good) | Mastered at |
|---|---|---|---|---|
| 1 Very small | dots in a line or cluster, single hand | 1 to 3 | 1500 → 800 ms (start 1200) | 90% over 10 in a row, under 1.5 s thinking |
| 2 Dice and fingers | dice faces (4 square, 5 quincunx), finger cards | 4 to 5 | 1000 ms | 85% mixed dice and finger |
| 3 Five-frames | 1×5 five-frame, two-colour counters | 3 to 7 (doc text says "anchor 5") | 1000 → 600 ms | right on total and missing spots, 8 trials |
| 4 Ten-frames | 2×5 ten-frame, row then pairwise then scattered | 5 to 10 (text says 6 to 10) | 1000 ms (≤ 800 ms later) | 85% on random ten-frames at ≤ 800 ms |
| 5 Unstructured | scrambled dots, two colours fading to one, koru | 4 to 10 (5 to 8 in the timing table) | 1200 → 600 ms | 80% on one-colour arrays |
| 6 Double ten-frame | 10-frame plus partial frame, rekenrek, two dice | 11 to 20 | 1500 → 1000 ms (example 1000 ms) | 85%, under 2 s |

Document ages: stage 2 is 5 to 6, stage 3 is 5.5 to 6.5, stage 4 is 6 to 7, stage 5 is 6.5 to 7.5, stage 6 is 7 to 8.

**Numbers in the document that disagree with each other** (to settle when building, then written here): stage 3's range ("3 to 7" vs "5 to 7" vs "anchor 5"), stage 4's range (5 to 10 vs 6 to 10), stage 5's range (4 to 10 vs 5 to 8 in the timing table), and the stage 1 flash (1200 ms vs 1500 ms → 800 ms). My picks, until James says otherwise: stage 3 = 3 to 7, stage 4 = 5 to 10, stage 5 = 4 to 10, stage 1 starts at 1200 ms.

## 4. Practice rules (from the document)

- **Window of 8 trials per picture type.** Advance at 85% or better over 8, with steady answers.
- **Three picture types** (for example ten-frame, dice, colour clusters) must be mastered before a higher quantity stage.
- **Step back** if accuracy falls below 60% over 5: fewer dots, or an easier picture (scattered back to ten-frame).
- **Review:** 20% of sessions' trials come from stages already mastered.
- **Struggling** = two wrong in a row, or thinking time over 4 s. Then: the flash pauses and the picture stays, grouping loops show, colours split the dots, and a "Peek again" button (500 ms) appears.
- **Anti-guessing:** answer buttons are locked for 1 s after a flash, and at least 5 buttons show. Fast wrong answers trigger the static guided mode.
- **Answering is untimed.** Timing is only used to spot struggle. The document warns that speed scoring is wrong and teachers should never see raw milliseconds.
- **Guided mode toggle** (no flashing at all) for anxious or neurodivergent students.

## 5. The six activities

1. **Flash and Identify**: flash, then tap how many. *(first release)*
2. **Look, Group and Select**: tap the total, then tap the sum card that matches how the dots were split (4+3, not 5+2).
3. **Missing Spots**: a frame with some dots; the student gives how many are missing (dual input in the document: the visible part and the missing part). *(first release)*
4. **Compare**: two pictures flash together; more, less or equal. Equal is 20 to 25% of trials.
5. **Make the Target**: drag two or three tiles to make a number, with a Check button.
6. **Same Number, Different Picture**: pick all cards with the same number as the top card (1 to 3 right).

Flash is 1000 to 1200 ms depending on the stage. Feedback is gentle: right → chime and the picture reappears with a green outline; wrong → no buzzer, the picture returns with group outlines ("Let me show you those dots again!").

## 6. Pictures, access and tech (from the document)

- **SVG pictures**, made from a seed (student + activity + trial), so a picture can be remade. Scattered dots use **Poisson-disk spacing**: minimum gap = 2 × dot radius + padding, so dots never overlap.
- **Targets** at least 48 × 48 px (54 × 54 on tablets), 16 px apart. WCAG 2.2 AA targets (24 px) are the floor, not the goal. Contrast 7:1.
- **Reduced motion:** instant on and off, no slide or fade.
- **Screen reader:** a polite live region says "a picture is showing", but never the answer.
- **Voiced prompts** in English, and later te reo Māori ("E hia ngā teke?"). With young users, read-aloud may come earlier.
- **Koru pattern cards** and finger cards come in later steps.
- **Teacher view** (later): stage status only (Mastered, In progress, Needs support), no raw times. Needs Training T.8.

## 7. Keys and saving (first release)

- Flash and Identify: `sub:<picture>-<n>` where `<picture>` is `dot`, `dice`, `five`, `ten` and `<n>` is the number. The answer is `n`.
- Missing Spots: `gap:<picture>-<n>` with the answer = missing count. Dual input from the document becomes two answers, each its own saved row.
- The server marks from the key. Saving uses the existing queue and `training_answers`. `typing_ms` is 0 for tap answers.
- A student's stage progress is **worked out from saved answers** (last 10 per key), never stored separately, so there is nothing to wipe or get out of step.
- A new season does not clear this (learning data, like the rest of Training).

## 8. Risks

- The site covers all primary ages now, so words and art suit a 5-year-old without talking down to a Year 6.
- Young children may not read well or type. All answers are big tap buttons, with a voice prompt option. Check that sign-in works for the youngest students before any go-live.
- Changing `shared/training/save.ts` means redeploying the `training` function. No other function changes.
- Flash timing in a browser isn't exact on slow Chromebooks. Use `requestAnimationFrame`, and test at 6× CPU slowdown.
- Training docs still say "Years 4 to 6". Update them in the merge step.

## 9. Steps (stop for James after each)

- **S.0 This plan.** Branch `subitising` (worktree `~/projects/school-games-hub-subitising`).
- **S.1 Pictures and rules, browser only.** `shared/subitising/` (config, patterns, stages, trials, engine) and `src/subitising/` (SVG renderer, flash screen, Missing Spots, gentle feedback, Guided mode, starting check, garden). Tests for no overlap, same seed same picture, mastery, step back. A preview page for James's phone.
- **S.2 Saving and the Training card.** `sub:` and `gap:` keys in `shared/training/save.ts`, a "Quick looks" button on the Training home, rebuild only the `training` function. Go-live only on James's yes, switch off first.
- **S.3 Later.** Stages 5 and 6 and scattered dots, Compare, Same Number, Make the Target, Look-Group-Select, koru and finger cards, te reo audio, teacher view, and an array version for times tables (my idea, not in the document).

## 10. James's answers (21 October 2026)

1. **Everyone sees Quick looks**, placed by a short starting check.
2. **Progress by stages and a growing garden**, no speed colours.
3. **First release = stages 1 to 4**, with Flash and Identify and Missing Spots.
4. **My number picks are fine**: stage 3 = 3 to 7, stage 4 = 5 to 10, stage 5 = 4 to 10, stage 1 starts at 1200 ms.
