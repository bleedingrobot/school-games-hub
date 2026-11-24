# Year 7 and 8 on the maths ladder: plan

**Status (24 Nov 2026):** plan only, nothing built. Waiting on James's answers (question cards in the thread "Plan Year 7 and 8 ladder content"). Answers go in section 9 as they come.

**Sources read:** NZC Mathematics and Statistics teaching sequences, Year 7 and Year 8 (October 2025), every strand. Today's ladder: `shared/maths/ladder.ts`, `docs/MATHS-FOCUS-PLAN.md` sections 3 and 12, `docs/game-guide/4-maths.md`.

## 1. The rule this plan follows

James, 24 Nov 2026: **"memory and fluency are the goals of games hub, not long drawn out working or hard questions."**

So a Year 7 or 8 skill goes on the ladder only if a pupil who knows it can answer **in their head, in about 8 seconds, with one number or one tap**. That is the same test the ladder already uses (`generated` quick time 8 s), and the same reason big-number rounding came off it on 19 Nov ("too slow for the games").

Everything else in the two documents goes to one of three other homes:

| Home | What goes there | Examples |
|---|---|---|
| **Ladder** (every older game's questions) | Facts and one-step "know it" questions | 10⁴, √81, −3 + 8, 5s + 3 = 18, 1 m³ = ? L, angles on a line |
| **Activities** (worked steps, like Order Up) | Methods with written working | long division to decimals, unlike-denominator fractions, 2.3 × 45, multi-step angle equations, budgets |
| **A game of its own** (draws its own pictures, like Pigeon's Number Line) | Things that need a picture to answer | coordinates in four quadrants, transformations, compass turns on a map, nets |
| **Not Games Hub** | Investigations, explaining, proving, choosing graphs | planning a data collection, reading media graphs, Law of Large Numbers experiments, proving angle sums |

## 2. How the ladder works today (short)

- One list, easiest first: about 42 skills on auto, from facts to 5 up to order of operations (Year 6), plus Foundational skills beside it.
- A skill is a set of mastery keys. Year 3 to 6 skills are **generated** question types (`shared/maths/skillPacks/*.ts`), each with its own Leitner box, quick time 8 s.
- A skill is secure at 70% of its keys in box 2+. Auto works on the first skill that isn't secure, with 60% focus, 30% review, 10% stretch.
- Answers are **one number** typed on the pad, or a **tap** from choices (`choiceLabels` for fractions, decimals, percentages).
- The warm-up is 10 questions, jumping 3 skills per right-and-quick answer.
- Every older game (Toon Flap, Marble Rush, Gem Keep, Archery, Clan Quest, Dragon Maths and more) asks from the pack, so **a new skill appears in every game by itself**.
- Teachers see it on the Skill map (one column per skill, short names in `skillNames.ts`), the Progress tab ladder board, and Set focus.
- Pupils' school year is known (`pupil_years`, 1 to 8 for pupils), so Year 7 and 8 pupils can be told apart from Year 4 to 6.

What's already there that covers Year 7-8 lines: squares to 144 and cubes to 125 with roots (`squares-cubes`), percentages of an amount and the whole from a percentage, the whole from a fraction, rounding decimals, FDP equivalents, order of operations without exponents.

## 3. What fits the ladder: proposed new skills

Each row is a skill: question types, an example, which year, and how it's answered. Numbers are kept small so it stays recall, not working. **Bold ids are the ones I'd build first.**

### 3a. Integers (new stage `integers`)

| id | Skill | Examples | Year | Answer |
|---|---|---|---|---|
| **`int-compare`** | Ordering negative numbers | Which is smaller: −7 or −3? −5 + ? = 0 (additive inverse). Y8: −3.4 or −3? | 7, 8 | tap / type |
| **`int-add-sub`** | Adding and subtracting across zero | −4 + 9, 3 − 7, −2 − 5, "It's −3°C and warms by 8°" | 7 | type with minus key |
| `int-negatives` | Adding and taking away a negative | 3 + −7, 5 − −2, −6 − −4 | 8 | type with minus key |

Integer × and ÷ are Year 9, so they are left out.

### 3b. Powers, primes and factors (stage `place-value`)

| id | Skill | Examples | Year | Answer |
|---|---|---|---|---|
| **`powers-10`** | Powers of ten | 10⁴ = ?, 10 000 = 10^?, 3 × 10³ = ?, 1000 ? 10⁴ (< > =) | 7 | type / tap |
| **`exponents`** | Exponent notation | 2⁵, 3³, 4³, 5 × 5 × 5 = 5^?, 6² + 1 | 7 | type |
| (existing) `squares-cubes` | Square and cube roots | √81, ∛64 shown with the radical sign | 7, 8 | type |
| **`primes`** | Prime or composite to 100 | Is 51 prime? Which is prime: 49, 53, 57, 63? | 7 | tap |
| `divisibility` | Divisibility rules 2, 3, 4, 5, 6, 8, 9, 10 | Is 738 divisible by 9? Which is divisible by 6? | 7 | tap |
| **`hcf-lcm`** | Highest common factor and least common multiple | HCF of 24 and 36; LCM of 4 and 6 | 7 | type |
| `prime-factors` | Prime factors with exponents | 36 = 2² × 3^?, 2³ × 3 = ?, pick 60 as primes | 8 | type / tap |
| `neg-powers` | Negative powers of ten | 10⁻² = ? (0.01), 0.001 = 10^? | 8 | tap / type with minus |

### 3c. Decimals, fractions, percentages, ratio, money (stage `fractions-decimals-percentages`)

| id | Skill | Examples | Year | Answer |
|---|---|---|---|---|
| **`decimal-facts`** | Decimals times a whole, from a known fact | 0.7 × 5, 0.7 × 50, 0.04 × 6, 2.4 ÷ 8 | 7 | type with point |
| `round-thousandth` | Rounding to a thousandth (adds to `round-big`) | 3.4567 to 3 dp | 8 | type with point |
| `estimate` | Estimating and benchmarks | 14.7 × 5 is between 70 and ?; 0.73 + 0.8 + 0.999 less than 3? | 7, 8 | tap |
| `fraction-add-easy` | Adding fractions with related bottoms | ½ + ¼, ⅔ − ⅙, 1½ + ¾ | 7 | tap |
| **`fraction-divide`** | Dividing by a unit fraction, a fraction by a whole | 4 ÷ ⅓ = 12, ½ ÷ 3 = ⅙ | 7 | type / tap |
| `fraction-times` | Fraction times a fraction | ⅔ × ¾ = ½, ½ × ⅗ | 8 | tap |
| **`percent-change`** | Discounts and increases, the swap trick | 20% off $40, 10% more than $30, 45% of 20 = 20% of ?, 3% is 27 so 100% is ? | 7, 8 | type |
| **`ratio`** | Ratio | 6 : 9 = 2 : ?, share 20 as 2 : 3 (bigger part?), 3 red to 7 blue with 18 red: blue? | 7, 8 | type |
| `money` | Change and cash rounding | $4.37 paid in cash is $?; change from $20 for $13.60 | 7 | type with point |

### 3d. Algebra (new stage `algebra`)

| id | Skill | Examples | Year | Answer |
|---|---|---|---|---|
| **`substitute`** | Putting a number in | 3x + 2 when x = 5; a² when a = 6; A = lw with l = 6, w = 4 | 7 | type |
| **`equations-1`** | One- and two-step equations | t + 7 = 12, 3a = 18, 5s + 3 = 18, x/4 = 6 | 7 | type |
| `like-terms` | Collecting like terms | 3a + a + a = ?a, 7b − 2b = ?b; Y8: 2(x + 3) + 1 = 2x + ?, 5x − 35 = 5(x − ?) | 7, 8 | type |
| **`patterns-rule`** | Linear pattern rules | 4, 7, 10, 13: next? Rule t = 3n + 4: the 10th term? Which rule makes 5, 9, 13? | 7, 8 | type / tap |
| `true-false-sentences` | True or false with < ≤ = | 0.8 × 12 ≤ 8 × 0.5 + 8? | 7 | tap |
| `equations-2` | Equations and inequalities with negative or decimal answers | t + 7 = 6.5, 2x + 9 = 1, t − 3 ≥ −5 so t ≥ ? | 8 | type with minus / point |

### 3e. Measurement and geometry facts (new stage `measurement-geometry`)

| id | Skill | Examples | Year | Answer |
|---|---|---|---|---|
| **`metric`** | Metric conversions | 3.5 km = ? m, 450 g = ? kg, 2.4 L = ? mL, 85 mm = ? cm | 7 | type with point |
| `metric-area-volume` | Area and volume units | 1 m² = ? cm², 1 mL = ? cm³, 2 m³ = ? L | 8 | type |
| `time-convert` | Time conversions | 2 h 15 min = ? min, ¾ h = ? min, 150 min = 2 h ? min | 7, 8 | type |
| **`formulas`** | Area, perimeter and volume with the formula | Rectangle 6 × 4: area? Triangle base 8, height 5: area? Cube side 3: volume? Square perimeter 36: side? Y8: parallelogram, trapezium, triangular prism | 7, 8 | type |
| **`angle-facts`** | Missing angles | Triangle 50° and 60°: third? On a line with 115°? Around a point? Isosceles base 70°: top? | 7 | type |
| `polygon-angles` | Polygon angle sums | Exterior angle of a regular hexagon? Interior sum of a pentagon? | 7, 8 | type |
| `compass-degrees` | Compass points in degrees | N to SE clockwise = ?°; NE is ?° from N | 7 | type |
| `circle-parts` | Radius and diameter | radius 7: diameter? | 8 | type |

Angle and shape questions can be written in words first. Small pictures would be better: see question 6.

### 3f. Data and chance facts (new stage `data-chance`)

| id | Skill | Examples | Year | Answer |
|---|---|---|---|---|
| `averages` | Mean, median, mode, range of up to 5 small numbers | 3, 7, 7, 9, 4: median? range? mean of 2, 4, 9? | 7, 8 | type |
| **`probability`** | Probability as a fraction, decimal or % | a bag of 3 red, 5 blue: P(red)? P(not 6) on a die? P(rain) = 0.3, P(no rain)? | 7, 8 | tap / type |

That is about 34 new skills (18 marked to build first). Order on the ladder: Year 7 skills first, Year 8 after, each strand's easiest first, and a skill only after the ones it needs (`exponents` before `prime-factors`, `int-add-sub` before `equations-2`).

## 4. What doesn't fit the ladder

**Activities (worked steps, Order Up style).** Each could be its own Activity later:
- Order of operations with exponents and integers: already Order Up stage 4 (needs new `bedmas` keys; the ladder's `bedmas` gets them too).
- Dividing with remainders as decimals or fractions (327 ÷ 15 = 21.8 or 21⅘), long multiplication, 2.3 × 45.
- Adding and subtracting fractions with unlike bottoms and mixed numbers, multiplying mixed numbers.
- Multi-step angle equations (supplementary, vertical, adjacent), parallel lines and transversals.
- Finance plans: weekly, monthly and yearly budgets, phone plans, "buy now, pay later".
- Reading timetables and duration charts; map scales and grid references.
- Expanded form with powers of ten (34 506 = 3 × 10⁴ + …), making a formula's subject.

**A game of its own (needs a picture).**
- Coordinates in four quadrants, plotting from a table (a "battleships" or treasure-map game).
- Transformations: translate, reflect, rotate by 90° (a puzzle game).
- Integers on a number line (Pigeon's Number Line could grow a below-zero part: temperature, lifts, sea level).
- Classifying triangles, parts of a circle, 2D faces of 3D shapes, nets.
- Probability by experiment: a Class Showdown-style class game where everyone's rolls add up and the bars settle towards the true chance (Law of Large Numbers you can watch).

**Not Games Hub:** planning and collecting data, choosing and drawing graphs, interpreting media graphs and misleading graphs, skew and outliers in context, proving the triangle angle sum, generalising polygon rules, drawing nets.

## 5. What has to change in the shared maths (for the build cards)

1. **Minus key.** `Question.input` gets `'integer'` (and `'integer-decimal'`); `QuestionModal` shows the minus key (the number pad already has one, used by `PracticalAsk`); the server's answer parsing takes negatives. Games with their own question display (Marble's gates) must handle it: rule 4 in `4-maths.md`.
2. **Powers and roots on screen.** A part like `'10^4'` drawn as 10⁴, `'√81'` and `'∛64'`, and `'10^?'` with a blank exponent. Spoken text too ("10 to the power of 4").
3. **Letters in a question.** Parts like `'3x'`, `'?a'` are just text, so most algebra works now. Check every game's display shows them well.
4. **Units in a question.** `'? cm²'`, `'?°'`, `'$?'` as a part after the blank.
5. **Quick time.** Most new types fit 8 s. Two-step ones (`equations-1` two-step, `ratio`, `percent-change`) may need a longer quick time per type, not per pack. See question 4.
6. **Curriculum tags.** Year 7 and 8 IDs (`MS.Y7.NUM.NS.P1` style) from James's alignment tool, if it has Years 7 and 8.
7. **Teacher views.** Short names for every new skill (`TINY`, 20 characters); Skill map and Set focus grouped by the new stages; the Progress tab ladder board gains the new stages.
8. **Placement.** The warm-up's 10 questions with 3-skill jumps can't reach 76 skills. Start the warm-up from the pupil's year (a Year 7 starts near the top of Year 6) or give each part of the ladder its own warm-up. See questions 2 and 9.
9. **Progress numbers.** Adding 34 skills to one list drops every pupil's "x of 42" overnight. See question 2.
10. **Tests.** `ladder.test.ts` and `shared/archery/server.test.ts` already run every ladder skill through marking, so each new type gets checked by the server in every way-A game.

## 6. Build cards (draft, order after James's answers)

| # | Card | Size |
|---|---|---|
| Y1 | Shared display: minus key, powers and roots, units; every game's question display checked | M |
| Y2 | Ladder shape (question 2), placement and progress numbers, new stages in Set focus, Skill map and Progress tab | M |
| Y3 | Integers: `int-compare`, `int-add-sub`, `int-negatives` | M |
| Y4 | Powers and primes: `powers-10`, `exponents`, `primes`, `divisibility`, `hcf-lcm`, `prime-factors`, `neg-powers` | M |
| Y5 | Fractions, decimals, percent, ratio, money | L |
| Y6 | Algebra quick-fire | M |
| Y7 | Measurement and angle facts | M |
| Y8 | Data and chance facts | S |
| Y9 | Ideas list for Activities and new games (section 4) on the Prompts board | S |

Each card: question types in `shared/maths/skillPacks/`, ladder rows, short names, curriculum tags, tests, `docs/MATHS-FOCUS-PLAN.md` and this file updated, live.

## 7. Risks

- **Too hard for the games.** A Year 4 playing Toon Flap must never meet a Year 8 equation by accident: the ladder's stretch (10%) only reaches one skill ahead, and Year 7-8 skills would sit behind the Year 6 top (question 3).
- **Reading load.** Word questions (temperature, ratio, money) are slower to read. Keep them to one short line, with Bella reading where the game reads aloud.
- **Picking instead of knowing.** Two-choice questions (prime? yes or no) can be guessed. Use four choices where possible, and count a two-choice type as secure only after more right answers.
- **Long ladder on teacher screens.** 76 columns on the Skill map. Grouping by stage and "skills in use" (K2) already help.

## 8. Questions for James

Asked on question cards in the thread. Summary:

1. Who will use Year 7-8 skills: Year 7-8 pupils here, top Year 5-6 pupils, another school?
2. One ladder made longer, or a second "senior path" that starts after the Year 6 top?
3. Should a Year 4-6 pupil who finishes the ladder carry on into Year 7-8 skills?
4. Quick time for two-step questions: 8 s, 12 s, or untimed?
5. Negative answers: a minus key everywhere, or tap only?
6. Angles and shapes: words only, small pictures, or leave to a game of their own?
7. Which strand first?
8. Data and chance facts on the ladder?
9. Where does a new Year 7-8 pupil start?
10. Longer methods (section 4) as Activities later?

## 9. James's answers

1. **Who uses it (24 Nov): both.** Year 7-8 pupils start on these skills, and strong Year 5-6 pupils can reach them.
2. **Ladder shape (24 Nov): one longer ladder.** The Year 7-8 skills go on top of today's list; everyone's "x of 42" becomes "x of about 76". Card Y2 adds a pupil-facing line so the drop doesn't read as going backwards.
3. **Finishing the Year 6 top (24 Nov): carry on by themselves.** Auto moves a Year 4-6 pupil on to the first Year 7 skill once the Year 6 top is secure; no teacher switch.
4. **Quick time (24 Nov): 12 seconds for two-step types.** One-step types keep 8 s; two-step types (two-step equations, ratio, percent change) get 12 s, set per question type (card Y1 adds a per-type quick time).
5. **Negative answers (24 Nov): tap from four choices only.** No minus key: any question whose answer is negative is always multiple choice (`choiceLabels`, so it can only be picked), with wrong choices from known slips (sign flipped, distance from zero, adding instead of subtracting). Card Y1 shrinks to powers, roots and units on screen.
6. **Angle and shape questions (24 Nov): small pictures from the start.** `Question` gets an optional `figure` (a small described drawing: triangle with two marked angles, a straight line, angles round a point, a labelled rectangle or prism). `QuestionModal` draws it as SVG; the server stores the figure with the question so marking never trusts the browser. Card Y1 builds the figure part; Y7 uses it. `spoken` still describes the picture in words.
7. **First strand (24 Nov): integers, powers and primes.** After Y1 (display) and Y2 (ladder shape), build Y3 then Y4 first.
