# Quick looks (subitising): plan

*A picture-flash practice inside Basic facts Training, where students learn to see how many at a glance instead of counting. Written 21 October 2026 for James, from his research document "Subitising Practice Design Plan" (Google Doc 1WF34d0sqY-5gayF3ogjNpvHQAmQ6GV1mbMX3_USpjHA). Every number below was read from the document, including the ones that were equation pictures.*

**Status: S.1 and S.2 built on branch `subitising` (section 11 and 12); nothing is live. James said (21 Oct 2026) the website is now for all primary ages, so the document's ages (5 to 8) apply directly.** Stop for James after each step in section 9.

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

## 11. S.1 results (21 October 2026, branch `subitising`, nothing live)

**Built (browser only, no database, no server change):**
- `shared/subitising/` (pure): `config.ts` (stages, flash times, every rule number), `keys.ts` (`sub:ten-8`, `gap:ten-7`, answer worked out from the key), `patterns.ts` (12 picture types as plain data, never touching), `engine.ts` (stage progress replayed from answers, finished stays finished, step back, struggle, garden growth), `trials.ts` (builds a picture from a seed), `placement.ts` (the starting check). 30 tests.
- `src/subitising/`: SVG pictures, `FlashRunner` (get ready 0.7 s, flash, buttons locked 1 s, answer, gentle feedback, help view, Peek again), `Garden`, `SubitisingApp` (home, starting check, session, summary), `store.ts` (browser storage for the preview). 5 screen tests.
- Preview: `npm run subitising:preview` and `preview/subitising/`. Private test page: https://claude.ai/artifact/MAT8CfpBRkorrmxra9KBAc (progress stays in that browser; test buttons at the bottom of the home screen).

**Decisions made while building:**
- A stage is finished at 7 right of the last 8 (85%), with each of its three picture types seen at least twice in the last 24. Finished stays finished.
- The starting check is 6 pictures, starting at stage 3: right goes up a stage, wrong goes down. Where it ends is where practice starts. Its answers don't count as practice.
- Struggling (two wrong in a row, or thinking over 4 s) makes the next picture stay on screen with its groups outlined and two colours. Those "helped" answers don't count towards a stage. The picture after that flashes again with a Peek again button (0.5 s, once).
- "Keep the picture on the screen" (guided mode) never flashes, and its answers do count.
- Stage 2 has dice, a 45-degree dice and a dot cluster. Fingers and koru cards come later (S.3).
- Stage 3 five-frame types: a five-frame (3 to 5), a full five plus extra counters (6 to 7) and two colour groups (3 to 7). Missing Spots uses the five-frame (1 to 4 filled) and the ten-frames (3 to 9 filled).
- Review: a fifth of pictures come from finished stages (never in the first picture of a session).

**Checked in a real browser:** flash 1.0 s and 1.2 s as set, buttons locked for 1.0 s, help view and Peek again appear, fits 1366 x 640 and 844 x 390 with no scrolling, no console errors, axe clean on home, get ready, flash, locked, answering and feedback screens.

**Not done yet (S.2):** saving answers, the button on the Training home, voice prompts, a teacher view. Stage progress will be worked out from the last 10 saved answers per key, so S.2 must check that a finished stage isn't forgotten when older answers drop off (it may need a small stored "furthest stage").

## 12. S.2 results (21 October 2026, branch `subitising`, nothing live)

**What was built**
- **Saving, no database change.** Quick looks answers are ordinary Training answers (`training_answers`), saved through the same queue and the same `training` function. `checkItem()` (`shared/training/save.ts`) now accepts `sub:<type>-<n>` and `gap:<type>-<n>` keys and marks them from the key alone (`correctAnswerFor` = a times-table fact, else `parseKey`). Every times-table check is unchanged. A tap answer must have `typingMs` 0, and the same Quick looks answer twice in one batch counts once (the batch id already stops a whole batch counting twice). Picture numbers must fit their stage (`sub:line-99`, `gap:five-5`, `sub:ten-08` are refused).
- **Help view goes in the key.** There is no spare column, so an answer given with the picture on screen after a struggle is saved as `subh:` / `gaph:` (same picture, same marking). It can't count towards a stage, and it never uses up the 30 answers kept for the real ones. The time is saved as 0 for every Quick looks answer: nothing about speed is kept.
- **The facts map is untouched.** `rebuildState` skips Quick looks keys, so records, colours, the "this week" line and review dates are exactly as before (test: a student with both kinds of answers gets an identical map to one with only times tables). The Quick looks code reads the same saved answers through `quickAnswersFrom`.
- **Settings follow the student, no database change.** The starting-check result, the stage reached and "keep the picture on the screen" are saved as `typing.q` = `{p, s, f, g}` inside the Training student row's existing `typing` column (a free-form JSON column; the longest possible value is about 300 of the 600 characters allowed). The data layer splits it back out, so Training only ever sees typing times. Sent only once a student has used Quick looks.
- **A finished stage can be forgotten, so it is stored (section 3 of the S.2 prompt).** The database keeps the newest 30 answers of each picture. With the real numbers: a simulation of 400 sessions at 90% right never lost a stage, but a student who then got 70% wrong for about 270 sessions did lose stage 2 (a test builds that case exactly). So the number of stages finished in a row (`f`) is saved with the student and used as "finished" (`progressFrom(..., finishedBefore)`), and it never goes down. It is also worked out from the answers, whichever is further.
- **The Training home** has a "Quick looks" button next to "Today's session" (shown whenever Training is, so it is behind `src/training/switch.ts`; no new switch, no points, no game links). Quick looks replaces Training's page frame while open (no second main area) and has "Back to Training". The answers go into Training's queue (send every 8 answers, at the end of a session or the starting check, when leaving, when the Wi-Fi returns). The browser-only preview still works with its test buttons.
- **Read aloud** (`src/speech.ts`, the browser's own voice): "Get ready", "How many did you see?", "How many empty squares?", the help prompt and the feedback line. Off until switched on (a tick box on the Quick looks home and a button on the practice screens, remembered on that device only). The answer is only ever said in the feedback line, after the student has answered.
- **Limits checked, none changed.** Per picture the database keeps 30 (a stage with 9 pictures keeps up to 270). 600 answers a day is plenty (10 Quick looks sessions = 120 plus 10 times-table sessions = about 300). 60 answers per batch, 20 requests a minute and 40 items per request are far above one 12-picture session. The student `typing` column holds up to 600 characters and the biggest possible value is about 300.
- `npm run build:functions -- training` rebuilt `supabase/functions/training/index.ts` only.

**Decisions**
- Helped answers get their own key prefix rather than a new column. Starting-check answers are not saved (only where it put the student).
- Read-aloud is off by default and is its own setting, not the site's sound setting (the sound button is for effects; a read-aloud voice on a shared Chromebook would surprise a class). James can flip the default.
- No Quick looks answer saves a time: "no clocks" holds all the way to the database.
- A student whose Quick looks settings are missing (an old Training tab saved over them) is asked to do the starting check again; their stages come back from their answers.

**Tests**
- Shared: `shared/subitising/saved.test.ts`, `shared/training/quicklooks.test.ts`, `shared/training/save.test.ts` (Quick looks keys, bad keys, a full gap, a made-up type, silly numbers, duplicates, settings, the 600-character limit), `supabase/functions/training/handler.test.ts` (marked from the key, a bad key dropped and the rest kept, the same batch twice counts once, settings), `src/data/training.test.ts`, `src/subitising/*.test.tsx`, `src/pages/TrainingPage.test.tsx`.
- In a real browser against the local database with the new function code: the starting check and a session with wrong answers and help view, going offline mid-session and back (all 12 answers saved once), a second browser profile showing the same garden and starting stage, the facts map and "this week" line identical before and after Quick looks answers, opening with the server unreachable (garden and settings from the saved copy), 1366 x 640 and 844 x 390, and the axe check clean on the Quick looks home, get ready, flash, locked, answering, feedback and summary screens.

**Not tested / rough**
- Not tried on a real Chromebook, a real phone, or with a real voice (the browser voice differs a lot between devices). Flash timing at 6x CPU slowdown not measured.
- The hub's own top bar is wider than a phone on its side (844 px): the whole site scrolls sideways there (not Quick looks).
- Training's own page has two main areas (the hub's and its own), which axe reports; Quick looks does not. Left alone (Training is live).
- A second device that is open while another finishes a stage only learns it on its next open.
- Young students: sign-in is the school Google account button (needs a Google password the first time on a device), the dashboard and Training home are word-based (a 5-year-old has to find "Training", then "Quick looks", by reading), and the home screens of Quick looks are not read aloud (only the practice prompts). Quick looks itself needs no reading or typing: big number buttons, and the read-aloud covers the words.

**Go-live steps (only when James says "go live")**
1. No migration, no change to the real database. (Quick looks rows go into `training_answers`; the settings go into the existing `training_students.typing` column.)
2. Deploy the `training` function from this branch (`supabase functions deploy training`, the same way as before). Do this first: until it is deployed the old function refuses `sub:` keys and Quick looks answers would pile up in the browser queue (they are kept and sent later, nothing is lost).
3. Merge `subitising` into `main` so the website build has the button. Training is already on (`TRAINING_ON = true`), so every student who can open Training sees "Quick looks" straight away; there is no separate switch. There is no separate Quick looks switch; if James wants one, it is a small addition (ask first).
4. Try it as a test student: starting check, a session, reload on another device, check the facts map.

## 13. Went live (21 October 2026)

- **Deployed:** the `training` function only (no database change, no migration). An unsigned request answers 401 "Please sign in again."
- **Merged to `main`** (push of `subitising`, merge commit 2419543). "Test and publish" passed: build, database tests and deploy all green.
- **What students see:** a "Quick looks" button next to "Today's session" on the Training home, for everyone who can open Training. No separate switch. Read-aloud is off until a student switches it on.
- **Not yet checked live:** signing in as a student and doing a session on the real site (needs a school Google account). James to try it.
- **Turning it off:** hide the button in `src/training/TrainingApp.tsx` and publish. Answers already saved stay in `training_answers` and do not affect the times-table map.
