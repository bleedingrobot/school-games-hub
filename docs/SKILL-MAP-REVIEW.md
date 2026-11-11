# Skill map review: making the maths ladder readable

*Review only, 11 November 2026, from `main` and James's screenshot of Teacher > Maths > Skill map for class "Riley" (31
pupils) on a laptop. No code was changed. James's screenshot and the mock-ups are in the project files folder `skill-map/`.
The step-by-step plan with copy-ready prompts is in [docs/plans/skill-map/HANDOVER.md](plans/skill-map/HANDOVER.md) and on
the "Skill Map Plan" artifact page: https://claude.ai/artifact/8pmT7dEjGECiDBvAbDxqJU.*

## Summary for James

- **A laptop screen shows about 8 skills and 4 pupils, almost all blank.** With every stage open the map has 62 skill columns.
  Each column is wide, its full name wraps over up to 4 lines and carries a "Set focus" link; each pupil row is about 90px
  tall because it holds the name, email name and another "Set focus" link.
- **Most of what's on screen is empty.** A class uses a handful of the 62 skills at a time. 20 of the 26 Early number facts
  skills are practised only by the Foundational games, so a class like Riley sees rows of "Not started".
- **Scrolling loses your place.** The stage names, the "On the ladder" column and the header's Student cell scroll away
  sideways; the class totals are at the bottom, 31 rows down; tapping a cell opens its detail under the whole table.
- **It never answers the teacher's real questions:** where is most of the class, who is behind or stuck, who is nearly ready to
  move on, who has stopped practising, and who should I focus on next.
- **The plan is 8 cards, K1 to K8.** K1 alone (a tidy, sticky, one-line-per-pupil grid) takes a laptop from 8 × 4 to about
  13 skills × 14 pupils. K2 shows only the skills in use. K3 makes a cell open a side drawer with focus buttons. K4 adds
  "who needs a look" pills. K5 (the only database change) records when a pupil first met a skill so "stuck 2+ weeks" works.
  K6 adds a By skill view for iPads. K7 ties the page to Progress, Foundational skills and Students. K8 closes it out.

## 1. What the page is

`/teacher/:classId/maths/skills` (`src/pages/SkillMap.tsx`, `src/pages/skill-map.css`). One database call,
`teacher_class_skill_map` (newest body in `20261111000600_fact_wrong_answers.sql`), returns each pupil's ladder info and every
`gem_keep_facts` row in the ladder packs. All levels are worked out in the browser by `shared/maths/skillMap.ts`:

- Rows: one per pupil, sorted by name. Columns: "Student", "On the ladder" (Now, Furthest, Warm-up), then one column per
  ladder stage (Early number facts 26 skills, Times tables 5, Place value 13, Rounding 4, Order of operations 1, Fractions,
  decimals and percentages 13; 62 in all). A closed stage shows "secure of counted" per pupil; an open stage shows one cell
  per skill with L, S or F.
- Footer: "Secure or fluent: N of 31" per column. A cell opens a detail panel under the table with the facts table and a
  "Set a focus" button.

## 2. What's hard today (from the screenshot and the code)

1. **Too big per item.** Skill headers are 78-120px wide (`.skill-map__skill`) and show the full label
   ("The equals sign: two numbers each side, and taking away"), plus a "Set focus" link in every header and every row.
2. **Tall rows.** Name, email name and "Set focus" stack, so a row is ~90px; 4 pupils fit under the header.
3. **Sticky parts are half done.** Only `tbody th` and `tfoot th` are sticky. The header row isn't sticky (scroll down and the
   skill names go), the header's Student cell isn't sticky (skill names slide under pupil names, as in the screenshot), the
   "On the ladder" column scrolls away, and the stage band label scrolls off with its first column so the band above the
   skills is blank.
4. **Blank by design.** Every skill is a column whether or not anyone has started it. In a junior class nearly every cell is
   "Not started", which looks the same as an empty table.
5. **The class picture is at the bottom.** The "N of 31" totals are in the footer.
6. **The detail opens out of sight.** `CellDetail` renders after the table, so the page jumps 31 rows and the teacher loses
   the cell they tapped.
7. **No "who needs a look".** The data can already show who is nearly ready (share secure on their Now skill), finding it hard
   (many answers, low share), behind the class, and gone quiet (`lastSeen`). Only "stuck for N days" needs new data: the table
   keeps when a fact was last answered, never when it was first answered.
8. **iPad.** Sideways scrolling with the same wide columns; portrait is close to unusable.
9. **Overlap with the other progress pages.** Progress (live 11 Nov) shows each Foundational game's step; Foundational skills
   shows 13 ideas from fact mastery; the Skill map shows the maths ladder used by Maths focus and the auto games, which also
   includes the 20 Foundational-only early skills. The Skill map doesn't say which games follow the ladder, and an empty class
   gets no pointer to Progress.

## 3. The design

- **Grid of skills in use** (`mock-1-grid-laptop.png`, `mock-3-grid-ipad-landscape.png`): one 30px line per pupil, short
  skill names with a class bar and "N of 31" in the header, sticky header and sticky Pupil and Now on columns, a coloured stage
  band, the pupil's Now cell outlined. Skills nobody has started fold into one hatched "nobody yet" column. Sorted by ladder
  place so pupils who are behind are at the top.
- **"Who needs a look" pills** above it with the Progress tab's words: Most are on, nearly ready to move up, finding it hard,
  stuck 2+ weeks (after K5), behind the class, gone quiet. A pill filters the rows.
- **Side drawer** (`mock-2-detail-laptop.png`): the facts behind a cell, how long they've been on it, the class line, and
  "Set a focus for this pupil" / "Focus for all 9 on this skill" / "Open pupil page".
- **By skill view** (`mock-4-by-skill-ipad-portrait.png`) for iPad portrait and phones: a card per skill in use with name
  chips for who is on it now and who has slipped back.

The numbers in the mock-ups are made up; only the layout matters.

## 4. The plan

| # | Card | Size | SQL | Waits for |
|---|---|---|---|---|
| K1 | Tidy the grid so a screen shows a class | S | no | nothing |
| K2 | Show only the skills the class is using | S | no | K1 |
| K3 | Tap a cell: a side drawer, with focus buttons | S | no | K1 |
| K4 | Who needs a look: pills, filter and sort | M | no | K2 |
| K5 | How long on this skill, and who is stuck | M | yes (add a column) | K4 |
| K6 | By skill view for iPad and phones | M | no | K4 |
| K7 | Fit with Progress, Foundational skills and Students | S | no | K2 |
| K8 | Guide matches, check live, close the review | S | no | K1 to K7 |

Each card's full detail and ready prompt is in [plans/skill-map/HANDOVER.md](plans/skill-map/HANDOVER.md).

## Decisions for James

James chose on 11 Nov 2026:

1. **What a laptop shows first:** the grid of skills in use (K1 + K2). By skill stays one tap away.
2. **Early number facts skills that only Foundational games practise** (20 of 26): show them only when a pupil in the class
   has started them. K2's "skills in use" rule already does this, so K7 adds nothing for it.
