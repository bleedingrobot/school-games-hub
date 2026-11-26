# Year 4 ladder gaps: plan (26 Nov 2026 NZ)

For Claude. James gave the NZC Year 4 Mathematics and Statistics teaching sequence (October 2025) and asked, as for Year 5
(docs/plans/ladder-y5/PLAN.md) and Year 6, which Year 4 content fits the ladder (fluency, memory, basic facts), whether we
already cover it, and a plan for the gaps. **James picks each skill himself. Build nothing until he has said yes to it and says
go** (project memory: show the full list with examples and get his OK first).

## 1. The rule

Same as Years 5-8: one typed number or one of four taps in about 8 s (12 s for two-step types), friendly numbers, instant
recall. Long methods go to Activities, picture-heavy things to games of their own. Build the way
docs/plans/ladder-7-8/BUILD-SPEC.md says; slot in by difficulty like Years 5 and 6 (`after`, chained runs, `inWarmUp: false`).
`LadderSkill.year` takes 5 to 8 today, so a Year 4 build adds 4 (and a `maths_content_years` row per question type; the
table's check takes 5-8, so the migration widens it to 4-8). Add a free **Help me** (shared/maths/hint.ts `helpKind`,
QuestionModal) wherever a sign, word or picture needs explaining (James asked for this on Year 5).

## 2. Year 4 content the ladder already covers

| Year 4 curriculum line | Ladder skill |
|---|---|
| Rounding to the nearest 10, 100, 1000 | `round-10-100`, `round-1000` |
| Rounding tenths to the nearest whole | `round-big` (round:tenth:*) |
| Counting in 2s, 3s, 4s, 5s, 10s (also from a start) | `skip-2/3/4/5/10`, `skip-from`, and the tables |
| Multiplication and division facts 2s to 10s | `tables-2` … `tables-10` (with division) |
| Derived facts with tens and hundreds (30 × 4, 300 ÷ 5) | `times-tens` |
| 2-digit × 1-digit | `times-2by1` (Year 5 row, easy numbers) |
| Tenths as fractions and decimals, decimal of ½ | `tenths` |
| ÷10 to make tenths, ×10 with tenths | `tenths` (tenth:divide), `times-decimals` |
| Adding and taking away one-place decimals | `add-tenths` |
| Equivalent fractions | `equivalent-fractions` |
| Fractions to a whole, same bottoms | `fraction-bonds`, `fraction-add-y6` (fa6:same) |
| Improper fractions and mixed numbers | `mixed-improper` (Year 5 row) |
| Unit fraction of an amount, whole from a unit fraction | `unit-fraction-of`, `whole-from-fraction` (whole:unit) |
| Mental adding and taking away (pairs to 100 and 1000, thousands) | `bonds-100`, `bonds-1000`, `mental-big` |
| Growing patterns that add a constant | `pattern-next` |
| Perimeter of polygons | `perimeter` (Year 5 row) |
| Area of rectangles, cuboids by blocks | `area-y6` |
| Angles against 90° and 180° | `angle-types` (Year 5 row, with Help me) |
| Hours, minutes, seconds (1 h 30 min = 90 min, 3 min = 180 s) | `time-y6` |
| Clock to five minutes | `clock-read` (Year 5 row, clock picture) |

## 3. Proposed Year 4 skills (James picks each one)

| # | id | Skill | Example questions | Answer | Help me |
|---|---|---|---|---|---|
| 1 | `place-10000` | Place value to 10 000 | In 4 382, the 3 is worth? (300); 6000 + 400 + 5 = ? (6405); 7050 = 7000 + ? (50) | type | |
| 2 | `compare-10000` | Biggest and smallest to 10 000 | Biggest: 3405, 3540, 4035, 3054 | tap | |
| 3 | `count-4digit` | Counting in 10s, 100s and 1000s to 10 000 | 3456 + 100; 1000 less than 7205; 4380, 4390, 4400, ? | type | |
| 4 | `count-25-50` | Counting in 25s and 50s | 25, 50, 75, ?; 350, 300, 250, ?; 125, 150, ?, 200 | type | |
| 5 | `count-back` | Counting back in 6s, 7s, 8s and 9s | 63, 56, 49, ?; 54, 48, 42, ? | type | |
| 6 | `times-0-1` | Times and divide by 0 and 1 | 7 × 0; 1 × 9; 8 ÷ 1; 0 × 54 | type | |
| 7 | `divide-2digit` | Dividing a 2-digit number in your head | 65 ÷ 5; 84 ÷ 4; 72 ÷ 3 | type (12 s) | |
| 8 | `double-half-big` | Doubling and halving bigger numbers (recipes) | Double 35; half of 140; double 250; half of 76 | type | |
| 9 | `open-sentences` | Missing numbers and true or false | 4200 − ? = 4001; ? ÷ 10 = 12; 11 × 7 = 78: true or false? | type / tap | |
| 10 | `pattern-times` | Patterns that double, triple or go down | 3, 6, 12, 24, ?; 2, 6, 18, ?; 50, 45, 40, ? | type | |
| 11 | `tenths-compare` | Comparing and ordering tenths | Bigger: 0.7 or 0.4?; smallest: 3/10, 0.8, 0.5, 6/10 | tap | |
| 12 | `fraction-compare-same` | Comparing fractions with the same top or bottom | Bigger: 3/8 or 5/8?; bigger: 1/3 or 1/5? | tap | fraction bars |
| 13 | `fraction-add-same` | Adding fractions with the same bottom, past a whole | 5/8 + 6/8 = ?/8; 3/4 + 3/4 = 1 ?/4; 7/5 − 3/5 = ?/5 | type | |
| 14 | `money-y4` | Money in whole dollars: totals and change | $4 + $7 + $3; 3 books at $5; change from $20 for $13; 20c coins in $1 | type | |
| 15 | `metric-mixed` | Mixed units: m and cm, L and mL, kg and g | 1 m 23 cm = ? cm; 2 L 500 mL = ? mL; 3 kg = ? g | type | |
| 16 | `turns-degrees` | Turns and degrees | A quarter turn is ?° (90); a half turn?; 270° is a ? turn (tap) | type / tap | turn pictures |
| 17 | `time-past-to` | Minutes past and minutes to | 7:50 is ? minutes to 8 (10); quarter to 4 is 3:?; 25 past 3 (tap 3:25) | type / tap | clock past/to halves |
| 18 | `clock-minute` | Clock to the nearest minute | Clock picture: tap 4:37, 4:43, 5:37, 7:20 | tap | (clock picture) |
| 19 | `time-days-weeks` | Days, weeks and hours | 3 weeks = ? days; 48 hours = ? days; 2 days = ? hours; 90 s = ? min | type | |
| 20 | `polygon-sides` | Shape names up to 12 sides | Sides on an octagon? (8); a 6-sided shape is a? (tap hexagon) | type / tap | shape names |

Notes for James's choice:
- 5: counting up in these steps is the times tables; this is the backwards half.
- 7, 8: no remainders (the Year 6 remainders skill has those).
- 9: the Year 5 `missing-big` skill is the big-number version.
- 11, 12: easier than the Year 5 "comparing related fractions" James said No to.
- 18: uses the Year 5 clock picture, with minutes not just fives.
- 20: only names and sides, not "Shape from a clue" (taken off 26 Nov).

## 4. Not ladder material

- **Activities:** column addition and subtraction to 4 digits (already the next activity), 3-digit × 1-digit written.
- **A game of its own:** fractions on a number line, irregular area by squares, 3D shapes from other views, transformations,
  grid references, lines of symmetry (picture work; close to "Rotational symmetry" taken off 26 Nov).
- **Not Games Hub:** measuring with tools, thermometers, benchmarks, collecting data, dot plots and bar graphs.

## 5. James's choices

James taps Yes, No or Maybe per skill on the picks page https://claude.ai/artifact/RUu5UnQGKdMdFWESqEMagZ (source `picker.html` here). Read
them with ArtifactData `list`, collection `picks` (doc id = skill id, fields `choice`, `comment`). Copy each answer into this
section, then build only what he says go to.
