# Year 5 ladder gaps: plan (26 Nov 2026 NZ), NOTHING BUILT

For Claude. James gave the NZC Year 5 Mathematics and Statistics teaching sequence (October 2025) and asked, as for Year 6
(docs/plans/ladder-y6/PLAN.md), which Year 5 content fits the ladder (fluency, memory, basic facts), whether we already cover
it, and a plan for the gaps. **James picks each skill himself. Build nothing until he has said yes to it** (project memory:
show the full list with examples and get his OK first).

## 1. The rule

Same as Year 6 and 7-8: one typed number or one of four taps in about 8 s (12 s for two-step types), friendly numbers,
instant recall. Fractions and time stay simple. Long methods go to Activities, picture-heavy things to games of their own.
Build the way docs/plans/ladder-7-8/BUILD-SPEC.md says; slot in by difficulty like Year 6 (`after`, chained runs,
`inWarmUp: false`). `LadderSkill.year` takes 6, 7, 8 today, so a Year 5 build adds 5 (and a `maths_content_years` row each).

## 2. Year 5 content the ladder already covers

| Year 5 curriculum line | Ladder skill |
|---|---|
| Multiplication and division facts 2s to 12s | `tables-2` … `tables-12` |
| Factor pairs (numbers from two factors 1-10) | `factor-pairs` |
| Rounding to 10, 100, 1000 | `round-10-100`, `round-1000` |
| Rounding to 10 000 and 100 000 | `round-huge` (Year 6 row) |
| Rounding tenths and hundredths to a whole | `round-big` |
| Counting back through zero, negatives | `count-zero` (Year 6 row) |
| Derived facts with tens and hundreds (30 × 4) | `times-tens` |
| Division with a remainder | `remainders` (Year 6 row; 278 ÷ 4 itself is written work) |
| Tenths and hundredths as fractions and decimals | `tenths`, `decimal-equivalents` (deceq:hundredths) |
| Comparing decimals to 2 places | `decimal-equivalents` (deceq:compare), `decimal-order` |
| Decimal of ½ ¼ ¾, tenths, hundredths | `decimal-equivalents` |
| 10% 25% 50% as fractions and decimals, and of amounts | `percent-basic` |
| Whole from 25% or 50% | `percent-of` (pct:whole:*) |
| ÷10 ÷100 to make decimals, ×10 ×100 with decimals | `times-decimals` |
| Families of equivalent fractions | `equivalent-fractions` |
| Adding fractions, same or related bottoms | `fraction-bonds`, `fraction-add-y6` |
| Non-unit fraction of an amount (⅔ of 24) | `fraction-of` |
| Whole from a fraction (8 is ⅖ of ?) | `whole-from-fraction` |
| Growing patterns by a constant (whole numbers) | `pattern-next` |
| True or false with = < > | `true-false-y6` |
| m and cm | `metric-y6` |
| Area of rectangles, cuboid volume by layers | `area-y6` |
| Durations with am/pm and 24-hour time | `time-24`, `elapsed`, `time-y6` |
| Likelihood words, 0 to 1 line | `chance-words`, `spinner` |

## 3. Proposed Year 5 skills (James picks each one)

| # | id | Skill | Example questions | Answer | Goes after (draft) |
|---|---|---|---|---|---|
| 1 | `place-million` | Place value to a million | In 482 316, what is the 8 worth? (80 000); 305 040 = 300 000 + ? + 40 | type | `round-1000` |
| 2 | `compare-big` | Biggest and smallest to a million | Biggest: 409 512, 490 125, 94 512, 409 125 | tap | `place-million` |
| 3 | `count-big` | Counting in 1000s, 10 000s, 100 000s | 46 300 + 10 000; 1000 less than 70 250; 23 500, 33 500, 43 500, ? | type | `compare-big` |
| 4 | `count-11-12` | Counting in 11s and 12s | 44, 55, 66, ?; 96, 84, 72, ? | type | `tables-12` |
| 5 | `mental-big` | Adding and taking away thousands in your head | 4 500 + 3 500; 7 000 − 2 400; 36 000 + 9 000 | type | `bonds-1000` |
| 6 | `times-2by1` | Times a 2-digit number by a 1-digit number in your head | 23 × 4; 15 × 6; 32 × 3 | type (12 s) | `times-tens` |
| 7 | `missing-big` | Missing numbers and < > = with big numbers | 999 999 − ? = 899 999; 45 000 + ? = 50 000; 2 456 × 2 ? 1 228 × 4 (tap =) | type / tap | `count-big` |
| 8 | `fraction-compare` | Comparing related fractions | Bigger: ¾ or ⅝? ⅔ or 5/6? | tap | `equivalent-fractions` |
| 9 | `mixed-improper` | Mixed numbers and improper fractions | 2⅓ = ?/3 (7); 11/4 = ? (tap 2¾) | type / tap | `fraction-compare` |
| 10 | `add-hundredths` | Adding and taking away hundredths | 1.31 + 0.22; 3.75 − 0.5; 0.45 + 0.3 | type with point | `decimal-bonds` |
| 11 | `money-y5` | Money: totals, change from $10/$20, nearest dollar | $3.50 + $2.25; change from $10 for $6.40; $7.65 to the nearest dollar | type with point | `add-hundredths` |
| 12 | `angle-types` | Kinds of angles | 130° is: acute, right, obtuse, reflex? (picture of an angle too) | tap | `area-y6` |
| 13 | `perimeter` | Perimeter of squares, rectangles, regular shapes | Square side 7; rectangle 6 by 4; regular hexagon side 5 | type | `angle-types` |
| 14 | `metric-mm-km` | Add mm and km to metric | 4 cm = ? mm; 3 km = ? m; 250 cm = ? m | type | extend `metric-y6` |
| 15 | `pattern-decimal` | Patterns that go up in halves and decimals | 3, 4.5, 6, 7.5, ?; 0.2, 0.4, 0.6, ? | type with point | extend `pattern-next` |
| 16 | `prism-faces` | Faces, edges and corners of prisms | Triangular prism: how many faces? (5); a cube's edges? (12) | type | `coordinates` |
| 17 | `compass-4` | Four compass points and quarter turns | Face north, quarter turn clockwise: which way? (E) | tap | `prism-faces` |
| 18 | `clock-read` | Telling the time on a clock face | Picture of a clock: tap 7:25, 7:35, 5:35, 6:25 | tap | `time-y6` |

Notes for James's choice:
- 4: the ×11 and ×12 tables already hold most of this.
- 14 and 15 are additions to existing Year 6 skills, not new rungs.
- 16 is close to "Shape from a clue", which James took off on 26 Nov 2026.
- 12, 16, 17, 18 need small pictures (angle, clock face; prisms can be words).
- 8 and 9 exist in Maths Monsters' Spark topic (banded fractions pack), not on the ladder.

## 4. Not ladder material

- **Activities:** column addition and subtraction (already the next activity), 3-4 digit × 1 digit and 2 digit × 2 digit,
  dividing 4-digit numbers, adding fractions to improper totals with working.
- **A game of its own:** transformations, nets, grid maps and grid references, parallel and perpendicular lines.
- **Not Games Hub:** measuring with tools, protractors, collecting data, tables and clustered bar graphs, chance experiments.

## 5. James's choices

James taps Yes, No or Maybe per skill on the picks page https://claude.ai/artifact/3aWAok5QfCHSJPAGyQPLdX (source
`picker.html` here). Read them with ArtifactData `list`, collection `picks` (doc id = skill id, field `choice`). Copy each answer
into this section, then build only the yeses. None yet (26 Nov 2026).
