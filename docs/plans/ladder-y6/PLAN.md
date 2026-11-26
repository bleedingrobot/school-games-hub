# Year 6 ladder gaps: plan (25 Nov 2026), built 26 Nov 2026 NZ

For Claude. James gave the NZC Year 6 Mathematics and Statistics teaching sequence (October 2025) and asked which Year 6
skills, concepts and facts Games Hub doesn't cover yet, then for short fluency and memory skills to add to the ladder. James said build all six cards (25 Nov 2026).

## 1. The rule

Same as the Year 7-8 plan (docs/plans/ladder-7-8/PLAN.md section 1): "memory and fluency are the goals of games hub, not
long drawn out working or hard questions". A skill goes on the ladder only if it's one typed number or one of four taps in
about 8 s (12 s for two-step types). Build each card the way docs/plans/ladder-7-8/BUILD-SPEC.md says.

## 2. What Year 6 already has on the ladder

Factor pairs, rounding decimals, fractions as decimals, decimals to make 1, 10% 25% 50%, fractions of an amount, ×10 ×100
with decimals, equivalent fractions and simplifying (improper and mixed too), squares and cubes, fractions decimals and
percentages, percentages of an amount and the whole from a percentage, the whole from a fraction, and order of operations
(the ladder plus the Order Up activity).

Year 7 skills that hold Year 6 content (angle-facts, metric, time-convert, formulas, averages, probability,
true-false-sentences, patterns-rule, fraction-add-easy, int-compare, int-add-sub) start off behind the Year 7-8 "Taught"
switches, so Year 6 pupils don't get them on auto.

## 3. Proposed Year 6 skills

James, 25 Nov 2026: skills that Year 7 already has get **easier Year 6 copies** (smaller numbers, only the Year 6 parts).
The Year 7 skills stay as they are. New ids end in `-y6` where a Year 7 skill has the same topic.

| # | id | Skill | Examples | Answer | Card |
|---|---|---|---|---|---|
| 1 | `round-huge` | Rounding to 10 000 and 100 000 | 368 412 to the nearest 10 000 | type | L1 |
| 2 | `thousandths` | ×÷ 1000 and thousandths | 4.7 × 1000, 36 ÷ 1000, 0.035 = ?/1000 | type with point | L1 |
| 3 | `decimal-order` | Decimals to 3 places in order | biggest of 0.45, 0.405, 0.5, 0.054 | tap | L1 |
| 4 | `remainders` | Division with a remainder | 38 ÷ 5 = 7 r ?, ⅙ of 31 = 5 and ?/6 | type | L1 |
| 5 | `count-zero` | Counting through zero | from −6 back in 2s: next? 4 − 7, 3° warms by 5° | tap when negative | L2 |
| 6 | `time-24` | 24-hour time | 15:40 = ? (tap 3:40 pm), 9:15 pm = ? (tap 21:15) | tap | L2 |
| 7 | `elapsed` | Time across the hour | 2:53 pm to 3:28 pm = ? min | type | L2 |
| 8 | `time-y6` | Time units (copy of time-convert) | 2 h 30 min = ? min, 3 min = ? s | type | L2 |
| 9 | `metric-y6` | m and cm, g and kg, L and mL (copy of metric) | 10 kg 500 g = ? kg, 3.2 m = ? cm | type with point | L3 |
| 10 | `area-y6` | Rectangle and right-angled triangle area, box volume | 6 × 4 rectangle, triangle base 8 height 5, 2 × 3 × 4 box | type | L3 |
| 11 | `angles-y6` | Angles on a line, at a point, vertically opposite | 115° on a line: other? | type | L3 |
| 12 | `shape-clue` | Shape from a clue | one pair of parallel sides: trapezium; kite, rhombus, parallelogram; triangle types | tap | L4 |
| 13 | `rot-symmetry` | Order of rotational symmetry | square 4, rectangle 2, equilateral triangle 3 | tap | L4 |
| 14 | `coordinates` | Coordinates (x, y) | start at (2, 3), move 4 right: (?, 3); one marked point, what is its x (or y) value? (was "which point is on the x-axis?", changed by James 26 Nov 2026) | type / tap | L4 |
| 15 | `chance-words` | Chance words and the 0 to 1 line | rolling a 7 on a dice: impossible; P = 0.5 is even chance | tap | L5 |
| 16 | `spinner` | Chance on a spinner | 3 of 8 parts red: P(red)? all chances add to 1 | tap | L5 |
| 17 | `mean-range-y6` | Mean and range (copy of averages) | range of 3, 9, 4, 7; mean of 2, 4, 6 | type | L5 |
| 18 | `true-false-y6` | True or false with ≤ and ≥ | 8 × 7 ≤ 8 × 5 + 42? | tap | L5 |
| 19 | `pattern-next` | Growing patterns (copy of patterns-rule) | 4, 7, 10, … the 10th? | type | L5 |
| 20 | `fraction-add-y6` | Adding related fractions (copy of fraction-add-easy) | ½ + ¼, ⅔ − ⅙ | tap | L5 |

Rounding to a million is left out: it was taken off the ladder on 19 Nov 2026 (`FORMER_SKILLS` in shared/maths/ladder.ts).

New pictures needed (shared/maths/figure.ts): kite, rhombus, a small coordinate grid with one dot, a spinner, a 0 to 1 line.
The rest use figures that exist already.

## 4. Not ladder material

- **Activities (worked steps, Order Up style):** column addition and subtraction (already the next activity), 542 × 12,
  dividing five-digit numbers, remainders as decimals, reading bus and train timetables, plotting a table of values.
- **A game of its own:** transformations and tessellation, grid references and map scales, time-series graphs and trends.
- **Not Games Hub:** measuring with a ruler, scales or protractor, estimating with benchmarks, collecting data, choosing a graph.

## 5. Build cards (draft)

| Card | What | Size |
|---|---|---|
| L0 | Where Year 6 skills sit (question 1), `year: 6` rows, Set focus, Skill map and Progress tab, "x of N" counts with Stop at Year 6 | M |
| L1 | Number: skills 1 to 4 | M |
| L2 | Negatives and time: skills 5 to 8 | M |
| L3 | Measurement and angles: skills 9 to 11 | M |
| L4 | Shapes and coordinates, with new pictures: skills 12 to 14 | L |
| L5 | Chance, data, algebra and fractions: skills 15 to 20 | M |

Every older game asks from the ladder, so each card shows up in every game by itself. One Artifact page per card showing the
new questions as pupils see them, like the Year 7-8 cards.

## 6. Where each skill goes (James, 25 Nov 2026: slot in by difficulty)

Each new skill goes where it fits on the ladder, straight after the skill its row names (`after` in
shared/maths/skillPacks/y6Row.ts; a run chains, each naming the one before):

| After | New skills, in order |
|---|---|
| `round-1000` | `round-huge` |
| `factor-pairs` | `remainders`, `count-zero`, `time-y6`, `time-24`, `elapsed` |
| `times-decimals` | `thousandths`, `decimal-order`, `metric-y6` |
| `equivalent-fractions` | `fraction-add-y6` |
| `squares-cubes` | `area-y6`, `angles-y6`, `shape-clue`, `rot-symmetry`, `coordinates` |
| `fdp-equivalents` | `chance-words`, `spinner` |
| `percent-of` | `mean-range-y6` |
| `whole-from-fraction` | `pattern-next` |
| `bedmas` | `true-false-y6` (needs the order of operations) |

They stay out of the placement warm-up (`inWarmUp: false`), so its ten questions still reach as high as before.

## 7. Pupils already past a new skill

Auto works on the first skill that isn't secure, but never below the pupil's floor (their placement or the furthest place
they have reached, shared/maths/place.ts). So a pupil whose place is already past a new skill has it as "passed over": it
comes up in their review and shows on the Skill map, but doesn't become their current skill. A pupil below it meets it as
their current skill when they get there. Every older game asks from the ladder, so the skills show up everywhere by
themselves.

## 8. Questions for James

1. Where the new skills go. **Answered 25 Nov 2026: slot in by difficulty** (section 6).
2. Build all six cards in one go, or L0 and L1 first. **Answered 25 Nov 2026: all six.** James also asked (25 Nov) that fractions and time
   questions stay simple instant recall (friendly numbers, round times, nothing to work out slowly).

## 9. Built (26 Nov 2026 NZ)

All cards L0 to L5 built in one PR: shared/maths/skillPacks/y6.ts gathers y6Number, y6Time, y6Measure, y6Shape and y6Chance;
shared/maths/y6/*.oracle.ts and *.picks.ts check every roll (shared/maths/y78.test.ts covers Year 6 too). New pictures in
shared/maths/figure.ts: `shape`, `grid`, `spinner` (with a colour), and `triangle-area` with `right`. Long tap choices get
smaller text (QuestionModal `choicesSize`). Pupils' news line `ladder-year6-2026-11-26`.

Tagged as Year 6 in the database (James, 26 Nov 2026): one row per question type in `maths_content_years` (migration
20261126000600), kept in step by shared/maths/y78.test.ts. A new Year 6 question type needs its row in a new migration.

## 10. Two skills taken off (26 Nov 2026 NZ)

James asked to take `shape-clue` and `rot-symmetry` off the ladder. Their rows are gone from SHAPE_LADDER (`coordinates` now
follows `angles-y6`), and both ids are in `FORMER_SKILLS` (shared/maths/ladder.ts) with no new skills, so saved focuses drop
them and a saved place on either reads as `coordinates`. Their question types (`shp:*`, `rot:order`) stay in SHAPE_FAMILIES and
their `maths_content_years` rows stay, so answers pupils already gave still read back. Nothing was deleted.
