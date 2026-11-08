# S23: Teacher view catches up with the longer ladders

**Game:** Hop, Penguin Pairs, Beanstalk (teacher view)
**What's wrong:** The teacher view has names for only some levels. Hop shows 3 steps of 6, Penguin Pairs shows 4 levels of 5. A child on the longer part shows no level name, and "top level" is wrong.
**What done looks like:** Every level a child can reach in Hop and Penguin Pairs has a name in the teacher view. "Top" means the real top. A test fails if a game gains a level without a name. Beanstalk shows its sum.
**Size:** S to M
**Impact on learning:** High
**Waits for:** nothing (S21 adds the Beanstalk stage; do the Beanstalk part after it)

## 1. The problem

R8 made the ladders longer. The teacher words did not follow (`src/teacher/foundational/config.ts:44-50`).

- Hop saves `reached` as a step value. The steps are 10, 5, 2, 3, 4 and 200 (`HOP_STEPS`, `shared/hop/round.ts:41-48`). The teacher words name only 10, 5 and 2 and say `top: 2` (`config.ts:45`). Steps 3, 4 and 200 show no name. A child on 2 is called "top" although there are three steps after it.
- Penguin Pairs has levels 1 to 5 (`shared/korora/round.ts:34-45`, `TOP_LEVEL = 5`). Level 5 (near doubles) has no name and `top: 4` (`config.ts:46`).
- The "top" flag is computed as `g.level === words.top` (`src/teacher/foundational/flags.ts:34`) and the name as `words.levels[g.level] ?? null` (`flags.ts:33`).
- Beanstalk has no levels (`config.ts:44`). Its "Bonds to 100 and 1000" columns read the fact keys, but the teacher cannot see which beanstalk a child is on. (`src/teacher/foundational/ideas.ts:44-49`.)
- The class view in `supabase/migrations/20261107000100_foundational_teacher_views.sql` (lines 27-80) already sends `reached` as `level` for Hop, Penguin Pairs and Pipi, so no database change is needed for those.

## 2. The rule behind it

- Rule 9: record evidence a teacher can use. A level with no name, or a wrong "top", tells the teacher nothing.

## 3. The change

1. Hop: add names for 3 (`Counting in threes`), 4 (`Counting in fours`) and 200 (`Counting in tens past 100`). Set `top: 200`. Keep the order words in `HOP_STEPS` (`word` field) as the source if it is exported to the browser.
2. Penguin Pairs: add `5: 'Near doubles'` and set `top: 5`.
3. Do not hand-write the lists twice where the game already has them. Read the level lists from the games (`HOP_STEPS`, `LEVELS`) in a test and compare.
4. Add one test in `src/teacher/foundational/foundational.test.tsx`: for Hop, Penguin Pairs, Pipi, Tūī and Weka, every level the game can reach has a name in `GAMES[...].levels`, and `top` is the highest of them.
5. Beanstalk, after S21 is merged: show the sum a child is on (10, 20, 100, 1000) as the level name. Send the saved `stage` as `level` in the class view (needs a small new migration, see section 5). Set the names for 0 to 3 and `top: 3`.
6. Check the "same level for 5 or more days" alert text (`src/teacher/foundational/alerts.ts:43-46`) still reads well with the new names.

Kit part used: `shared/kit/teacherGrid.ts` (flags rules). Not changed.

## 4. Files affected

- `src/teacher/foundational/config.ts`, `foundational.test.tsx`, possibly `flags.ts`.
- `src/games/beanstalk/teacher.ts` and a migration (Beanstalk part only).
- No kit or shared change.

## 5. Database / migration needs

Hop, Penguin Pairs: none. Beanstalk part: one new migration (next free number, `node scripts/migration-numbers.mjs`) that adds the Beanstalk `level` to the class view function, like the other games in `20261107000100_foundational_teacher_views.sql`. James applies it by hand at go-live.

## 6. Test steps

Automated (2 tests):
1. Every reachable level of each foundational game has a teacher name, and `top` is the highest.
2. A pupil on Hop step 200 shows "top" and its name; a pupil on step 3 shows its name and not "top".

By playing: open the teacher Foundational view with a test class that has a child on Hop 4 and on Penguin Pairs 5 and read the level names.

## 7. Size and impact

S to M: words and a test, plus a small migration for Beanstalk. High: teachers read these names to decide who needs help.

## 8. Session prompt (ready to paste)

```text
Branch: create teacher-longer-ladders from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S23-teacher-view-longer-ladders.md first.
Steps: in src/teacher/foundational/config.ts add the Hop names for steps 3, 4 and 200 with top 200, and the Penguin Pairs name for level 5 with top 5; add the test that every reachable level has a name (compare with HOP_STEPS in shared/hop/round.ts and LEVELS in shared/korora/round.ts); check alerts.ts wording. Only if S21 is merged: send the Beanstalk stage as level in a new migration (next free number) and add its names. Never touch shared/maths, src/maths, src/styles.css or src/components.
Tests: the 2 tests in the plan. Check the teacher view by playing the preview.
Stop and tell James before any live step. Open a PR when done.
```
