# Basic facts check: plan

*A fixed check of the same basic facts every 4 weeks, so we can tell whether pupils' basic facts are really improving. Asked for by James on 15 Nov 2026 NZ ("From the data we have, is there any actual evidence that basic facts are improving?" then "Yes please" to setting up a proper measure).*

**Status: built 15 Nov 2026 (migration `20261115000100_facts_check.sql`, PR on branch `claude/project-thread-ma1x0i`). Live once that PR is merged: pupils get their first check the next time they open Training.**

## 1. Why

On 15 Nov the coordinator looked at Training's answers: 69 pupils with 60+ answers had flat accuracy (91.7% → 91.0%) and speed (4.1 s → 4.1 s) between the first and second halves of their answers. That doesn't show facts are flat: Training moves each pupil on to harder facts as they improve, so its own numbers hide the gain, and records only start on 17 Oct with no starting point. A fixed set asked again and again is the only fair before-and-after.

## 2. What pupils do

- **Who:** pupils in Year 3 and up, or with no year set (`CHECK_CONFIG.fromYear`). Teachers and Years 0 to 2 are never asked.
- **When:** at the start of Training, when they have never done one or their last was 28 or more days ago (`everyDays`). A pupil's first check waits until they have finished 3 Training sessions (`firstAfterSessions`, 17 Nov 2026), so a brand-new pupil starts with easy wins and a filling facts map, not a hard test. "Facts check" replaces the Today's session button until it is done. A maths warm-up still comes first if their class needs one. **Retest weeks** (`retestRounds`, 27 Nov 2026): from each listed date, any pupil whose last check is from before it and at least 7 days old (`roundMinGapDays`) is due again, checked in the browser (`retestRoundDue`, src/data/factsCheck.ts) on top of the server's 28-day rule. First round: week of 30 Nov 2026 NZ, because school ends before the 28-day retests (13-24 Dec) fell due.
- **What:** Training's typing warm-up, then the same 24 facts (`CHECK_FACTS` in `shared/training/check.ts`): 16 times and 8 division, easy to hard across ×2 to ×12. Shuffled order, always shown the same way round. No right/wrong shown, no picture help, no clock on screen. "Not sure yet" moves on, and so does 30 seconds with no answer.
- **At the end:** "You got 18 of 24 right" and one kind line: more quick facts or more right than last time, or "Keep training and watch your facts grow". Never seconds, never "fewer".
- **Counts as a Training session:** it opens the games (Training before games) and counts towards Training trophies, so it isn't an extra job before games.

## 3. The measure

- **Right:** out of 24.
- **Quick:** right with under 3.5 s of thinking time (answer time minus the pupil's typing time, Training's "Quick thinking" line). The headline number, because accuracy is already about 90% and can't show much growth.
- **Usual thinking time:** the middle thinking time of the right answers.
- Compared per pupil, **first check against latest**. Only checks of the same `CHECK_VERSION` are compared: never change the set in place, make version 2.

## 4. Teachers

The Progress tab has a "Basic facts check" panel for the class: the change for pupils with two or more checks (quick facts and right, first → latest on average, how many have more quick facts and how many fewer, usual thinking time), the five facts fewest got right in their latest checks, and a row per pupil (first check, latest, change in quick facts, usual thinking time). Teachers see seconds; pupils don't.

## 5. How it works

- `shared/training/check.ts`: the set, `CHECK_CONFIG`, marking (`scoreCheck`), the queue item check (`checkCheckItem`), the pupil's end line.
- Saving goes through the Training queue (item type `check`, `src/data/training.ts` `enqueueCheck`), so a check finished offline isn't lost. The `training` function marks it again from the set and calls `record_facts_check()`, which saves it once (by its id) and adds a `training_sessions` row (kind `facts`, seed = minus the check's row id).
- Reading: `my_facts_check(version, every_days, from_year)` for the pupil (`src/data/factsCheck.ts`); `teacher_facts_checks(class, version)` for the Progress tab (`src/teacher/progress/FactsCheckPanel.tsx`).
- Cost: one request per pupil per check, about 70 a month for the school.

## 6. Reading the results

The first checks are the baseline (from 15 Nov 2026). The first comparisons come from the retest week of 30 Nov 2026 (a 1-2 week gap after each baseline, so expect smaller gains than a 4-week gap). For whole-school numbers: `select version, count(*), avg(quick_count) ... from facts_checks` grouped by each pupil's first and latest check.

## 7. Later, if wanted

- An early-facts version (bonds and facts to 20) for Years 0 to 2.
- A per-class switch, or a teacher button to ask everyone now.
