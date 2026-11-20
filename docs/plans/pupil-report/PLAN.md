# Pupil report: plan

**Status:** planned 20 Nov 2026. Nothing built yet.

## The goal

A teacher can pick **any pupil in the school**, or **their whole class**, and see one page per pupil that says everything the hub has learned about that pupil: what they can do, what they find hard, how they practise, and what to teach next. They press **Print** and choose **Save as PDF**. Each pupil fits on **one A4 page**. A class report is a cover page followed by one page per pupil.

Test pupils: the two pupils with the most play, called **pupil M** and **pupil K** here. James's local copy (`PLAN.local-full.md`, not in git) and project memory name them. Each has about 1,000 fact answers since late October.

## James's decisions (20 Nov 2026)

| Question | Decision |
|---|---|
| Who can open a pupil's report | **Every teacher at the school**, read only. Today only school admins can see pupils outside their own classes. |
| How insights are written | **Fixed rules only, never AI.** Pupil data never leaves the school's database and browser. |
| How the PDF is made | **Browser print** (Print, then Save as PDF), the same way as the Badge sheet. No PDF library. |
| Name at the top | **Real name big** (school email before the @), game name small underneath. |

## What the hub already knows about a pupil

Checked on live for the two test pupils, 20 Nov 2026.

| Source | What it tells us | Notes |
|---|---|---|
| `training_answers` | every times-table and division fact answered: fact, answer given, right or wrong, time to answer, typing time, day | The richest source: about 1,000 answers each for the test pupils. The wrong answer given makes error patterns possible. |
| `gem_keep_facts` | per fact and pack: Leitner box (0 to 4), attempts, correct, average time, last three wrong answers, quick days | Covers add-sub, division, early facts, fractions, decimals, money, place value, patterns. New Season clears it. |
| `facts_checks` | the 24-question facts check: answer, time, think time, mark 0/1/2 | A clean snapshot, not practice. |
| `ladder_places`, `ladder_placements` | where the pupil is on the maths ladder, and the placement test | Show the date. One test pupil's place was last moved two weeks ago, while they now practise much harder facts. The report must say "last moved …" so a stale place is visible. |
| `maths_focus_results` | questions on the teacher-set focus: answers, correct, quick | |
| `student_maths_focus`, `maths_focuses` | what focus the teacher set, and when | |
| `question_log` | every question shown in every game: game, spot, time on screen, skipped | Has no right or wrong. Use it for skips, time on screen, where and when they play. |
| `page_away` | left the tab or window during a game, and for how long | Long tab-aways are usually a game left open, not a worry. |
| `scored_games` | every finished game: game, kind (solo, bot, pupil), bot level, result, opponent | **Solo "won" is always won** (a test pupil has every solo game won), so only bot and pupil games mean anything as results. |
| per-game rounds (`*_rounds`, `*_progress`) | Foundational games: steps, stuck, nearly ready | Juniors only. Reuse the Progress tab's words (`docs/game-guide/2-steps-and-progress.md`). |
| `achievements`, `trophies`, `pupil_badges`, `quest_*` | rewards, badges, class quests | A small line, not a section. |
| `pupil_years` | year level | **Set by the pupil**, so show it as "says Year 6". |
| `class_members`, `class_events` | class, when they moved in | |

## The A4 page

A4 portrait with 10 mm margins gives about 190 × 277 mm. Everything is sized in mm for print. The screen shows the same page. Every section has a fixed most-lines limit, so the page can never run over (see "Fitting on one page").

1. **Header** (1 line): real name, game name small, class, "says Year 6", report date, and the data window ("22 Oct to 20 Nov: 30 days played").
2. **At a glance** (4 tiles): days played in the last 4 weeks, questions answered, accuracy, typical answer time. Each tile has a small trend against the 4 weeks before.
3. **Strengths** (up to 4 lines) and **Next steps** (up to 4 lines), side by side. Each line comes from a rule and ends with its evidence in grey ("97% of 131, about 1.3 s").
4. **Times tables and division grid**: a 12 × 12 colour grid. Each cell is one fact: fluent, secure, shaky, often wrong, or not seen yet. Under it is a row per table with % right and typical time, and division beside multiplication. This is the biggest picture on the page.
5. **What the wrong answers tell us** (up to 3 lines): error patterns. See "Rules".
6. **Other maths** (up to 4 lines): ladder place and when it last moved, maths focus results, facts check, and Gem Keep packs (add-sub, fractions, place value and so on) as secure, learning or new.
7. **How they practise** (up to 4 lines): home or school, days per week, how long a sitting lasts, skipping, leaving the page, favourite games, and keeping going after losses.
8. **Talking points for the teacher** (up to 3 lines): what to try next, for example "Set the focus to the 6s and 7s" or "Try 2 ÷ 1, 5 ÷ 1 and 7 ÷ 7 with counters".
9. **Footer** (1 line): rewards in one line, and "Made by fixed rules from hub data. A line shows only when there is enough evidence."

**Juniors** (Foundational games, ages 5 to 8): the grid becomes their early-facts picture (bonds, teens, skip counting) from the Foundational data. "Other maths" lists their steps in each junior game: on step, stuck, nearly ready.

## Rules (no AI)

Rules are pure functions in `shared/report/`. Each takes the pupil's numbers and returns sentences that carry their evidence. A rule stays quiet when there is too little data. Rule words come from one file so they read the same everywhere.

**Thresholds.** A fact needs at least 3 answers before it counts. A table or pack needs at least 10. A pattern needs at least 3 matching wrong answers. Time uses the median and ignores answers over 20 s (distraction, not thinking). Every rule has a test at each threshold.

**Fact levels** match the skill map words already in the hub:
- **Fluent**: right, and quick on 3 different days
- **Secure**: at least 90% right over the last 5 answers
- **Shaky**: 60% to 89%
- **Often wrong**: under 60%
- **Not seen yet**

**Strengths:**
- the tables that are fluent or secure and quick
- big improvement on a table since its first week
- a facts check above the year's goal
- steady practice, if they practised on most school days
- persistence: keeps playing bot or pupil games after losses

**Next steps:**
- shaky or often-wrong tables
- tables barely seen yet ("only 6 goes at the 6s": not known, not weak)
- division well behind multiplication on the same facts
- slow but right, meaning secure but not quick yet
- ladder place not moved for 2 weeks while practising
- falling accuracy over the last 2 weeks

**Error patterns.** Each wrong answer is matched to a pattern:

| Pattern | Test | Example |
|---|---|---|
| Neighbour fact | the answer is a × (b ± 1) or (a ± 1) × b | 4 × 9 → 32, 7 × 8 → 49 |
| Off by one | the answer is right ± 1 (counting on, not recalling) | 40 ÷ 5 → 9, 4 × 7 → 29 |
| Dividing by 1 or by itself | the fact is n ÷ 1 or n ÷ n, and the answer is 1 or n the wrong way round | 2 ÷ 1 → 1 |
| Added, not multiplied | the answer is a + b, or the dividend − divisor | |
| Place value slip | the answer is right × 10 or ÷ 10 | |
| Turned around | for division, gave the divisor instead of the answer | |
| Other | none of these | not reported unless one fact keeps going wrong |

**Habits:**
- home or school, using school hours Mon to Fri 8:45 to 3:00 NZ (the tracker's rule)
- skip rate per game, flagged when over 15% in a game
- tab-aways over 10 minutes, reported as "left a game open", not as a worry
- time on screen per question
- favourite games by number of plays
- keeps trying after losses (bot or pupil games only)

**Not used:** solo-game results, pupil-set year level as fact, ranking against classmates (the guide's rule), and anything from chat or names.

## Worked examples

Both test pupils already give lines in every section: strong and weak tables, division behind multiplication, each of the first three error patterns, a stale ladder place, skipping in fast games, tab-aways and persistence after losses. The real lines are in James's local copy only. R2's fixtures are made up to the same shape and must produce the same kinds of lines. Test fixtures are never copied from real pupils.

## The class report

**Cover page:**
- class name, date and how many pupils played in the last 4 weeks
- a table with one row per pupil, by real name, showing days played, accuracy, the next table to learn and one flag (quiet, stuck or ready to move up). It is ordered by name, never by score.
- **suggested groups**: pupils who share a next step ("Ready for the 6s and 7s: …", "Neighbour-fact mix-ups: …"), so the teacher can plan a group lesson

**Pupil pages:** one A4 page per pupil, ordered by real name. Pupils with no play in the window get a short page that says so.

## How it is built

- **Access.** New `public.require_school_teacher(student)` checks that the caller is a teacher in the same school as the pupil. Existing `require_teacher_of` stays as it is for everything else. Every report read by a teacher who does not teach that pupil is written to `admin_log` ("viewed report"), so the school can see who looked. `docs/PRIVACY-SUMMARY.md` gets a line.
- **Data.** One SQL function `teacher_pupil_report(students uuid[], since date)`, security definer, at most 40 pupils per call. It returns already-added-up numbers per pupil, not raw rows: per-fact counts, last-5 accuracy, median times and wrong answers with counts, per-table and per-pack summaries, weekly totals, home and school counts, skips per game, tab-aways, bot and pupil results, ladder, focus, facts check, year level and rewards count. Doing the adding up in SQL keeps a class report to one quick call. A second function, `teacher_school_pupils(search text)`, feeds the "any pupil" picker (real name, game name, class).
- **Rules.** Pure TypeScript in `shared/report/`: `facts.ts` (levels and grid), `errors.ts` (pattern matcher), `strengths.ts`, `habits.ts`, `talkingPoints.ts`, `words.ts`, and `report.ts` that builds the page from them and enforces the line limits. No database or browser code, so it is fully unit tested.
- **Screens.** `src/teacher/report/`:
  - **Report** tab in the teacher shell (`teacher/:classId/report`): the class cover, then pupil pages
  - a **Pick any pupil** search (`teacher/report/:studentId`)
  - a **Print** button
- **Print.** `@page { size: A4; margin: 10mm }`. Each pupil is a `.report-page` with a fixed height of 277 mm, `break-after: page`, and colours printed exactly (`print-color-adjust: exact`). The grid is SVG so it prints sharply.

## Fitting on one page

- Every section has a most-lines limit, and `report.ts` cuts to it, keeping the lines with the most evidence first.
- The fullest-possible fixture (every section at its limit, long names) is a test. A Playwright check prints it to PDF at A4 and fails if any pupil takes more than one page. The same check runs on the two test-pupil-shaped fixtures and on a junior fixture.

## Stages

One stage per session, in order. Merging is pre-approved. Before R1's migration, run `git fetch && node scripts/migration-numbers.mjs`; the next free number on 20 Nov was `20261120001800`.

| # | Stage | Database | Done when |
|---|---|---|---|
| R1 | Access and data: `require_school_teacher`, `teacher_school_pupils`, `teacher_pupil_report`, admin_log line, SQL tests (same school yes, other school no, pupil no, 40-pupil limit) | yes | live, and run as James for the two test pupils returns their numbers |
| R2 | Rules: `shared/report/` with tests at every threshold and every error pattern, plus fixtures shaped like the two test pupils, a junior and the fullest case | no | each worked-example kind of line comes out of the fixtures |
| R3 | One pupil on screen: Pick any pupil search, report page, link from the Students page | no | James opens both test pupils from his class and a pupil from another class |
| R4 | Print: A4 layout, SVG grid, print button, the one-page Playwright check | no | both test pupils' PDFs are one page each and readable in black and white |
| R5 | Class report: cover page, suggested groups, all pupils, one print | no | James's whole class prints as cover + one page each |
| R6 | Juniors: Foundational version of the grid and steps | no | a junior class prints well |
| R7 | Live check and write-up: try it as James on live, update the teacher help, the game guide (new games add their data to the report the way they add a Progress column), memory, and plan status | no | done |

A new game later adds its numbers to `teacher_pupil_report` and, if it has its own maths, a line in `habits.ts`. R7 writes this into `docs/game-guide/2-steps-and-progress.md`.

## Open for later (not now)

- A term-on-term comparison once there is a full term of data.
- A one-click "set this as their focus" from a talking point.
- A parent version. That needs its own privacy decision.
