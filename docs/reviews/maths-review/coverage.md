# Coverage matrix: fundamental maths skills against every game in the hub

Written 7 Nov 2026. Read only: no code or branches were changed. Skills come from Part 2 of `research-maths.md` (ages about 5 to 10, NZ Years 1 to 6).

## 1. Method (short)

- I took every folder in `src/games/*` plus Quick looks (`src/subitising`, `shared/subitising`), and read each game's rules file header, round/question maker and the screens that ask maths.
- **C (covered)** = the game's own mechanic is the maths: the child has to do the skill to play or win.
- **P (partly)** = the skill appears only as a bolted-on quiz question (a "Hold on!" question, a gate, a shop sum), or the mechanic touches it but never makes the child do the whole skill, or only one slice of the skill is there.
- **-** = not there. (Where I could not find it, I searched `shared/`, `src/games/` and the skill packs for the topic.)
- Every C and P has a one-line reason and a file:line in section 3.

### What the shared maths focus system can ask (one row-source: "FQ")

`docs/MATHS-FOCUS-PLAN.md` sections 1 to 3. The path is: teacher's focus, the student's own choice, or auto, then `makeFocusPack` (`shared/maths/focus.ts:202`) then `AutoPack`. With no focus and no ladder it falls back to **times tables only** (`focus.ts:205`). The skills it can serve are the ladder in `shared/maths/ladder.ts:88` onward:

- Early facts: parts of numbers to 5 and 10, bonds to 10, doubles and halves to 10 and 20, "ten and" teen facts, bonds and adding within 20, skip counting 10s, 5s, 2s (next, up, back), odd and even (`shared/maths/skillPacks/earlyFacts.ts:25, 52, 75, 132, 180, 219`).
- Times tables with missing factor and division facts (`skillPacks/timesTables.ts:22-24`).
- Generated skills: pairs that make 100 and 1000, rounding (10, 100, 1000, big, million), times with tens and hundreds, factor pairs, squares and cubes, fractions of an amount, fraction bonds, tenths, decimal bonds and equivalents, percentages, equivalent fractions and simplifying, finding the whole, and order of operations (`ladder.ts:106-144`, `skillPacks/generated.ts`).

Every focus question is **a text or number question with a number or pick-one answer** (`Question.parts`, `shared/maths/serverQuestions.ts:46-64`). There are no pictures, no ten-frames, no number lines in a focus question. So FQ is a quiz, and I mark it P at best everywhere.

What FQ does **not** have: place-value digit worth and partitioning (`pv:*`), "10 more / 10 less", comparing numbers, two-digit add and subtract (carry, borrow, bridging), money, patterns, comparing fractions. Those exist only in the older banded packs (`skillPacks/placeValue.ts:145-157`, `addSub.ts:101-253`, `fractions.ts:47-184`, `decimals.ts:74-121`) used by Maths Monsters and Dragon Maths, and in `money.ts` / `patterns.ts` used by Dragon Maths only (`shared/maths/skillPacks/index.ts:48-52`).

**Games that use FQ** (via `makeRunQuestions`, `makeSpacePack`, `makeFocusPack` or `QuestionModal`): Wormholes & Black Holes (`src/games/space/SpaceSolo.tsx:172`), Gem Keep (`src/games/gem-keep/ui/GemKeepCampaign.tsx:85`), Marble Rush (`shared/marble/questions.ts:5-9`), Mine Runner (`shared/mine/maths.ts:121`), Archery Challenge speed round (`shared/archery/speed.ts:108`), Diamond Drop (`shared/diamond/server.ts:117`), Royal Decree (`shared/decree/server.ts:137`), Sky Isles (`shared/isles/server.ts:467, 614`), Kingdom Keeper (`shared/kingdom/server.ts:75`; its card is off), Star Trader (`shared/trader/questions.ts:35`), Clan Quest Battle Cry (`shared/clans/actions.ts:508, 550`), the placement check (`src/pages/Placement.tsx:192`). Bond Match records to the focus system but its mechanic is its own (`shared/bond-match/`).

**Other question sources**: Maths Monsters and Dragon Maths use the older banded topic packs (`src/games/monsters/BattleScreen.tsx:376`, `src/games/lord/useAsk.tsx:59`; Dragon Maths adds money and patterns). Clan Quest also has "practical" questions (percent of, tax, change, area, perimeter, ratio, negative numbers, better buy; `shared/maths/practical.ts:17-34`).

### Column key

| Code | Source |
|---|---|
| BS | Kiwi's Beanstalk (foundational) |
| HOP | Hop's Glow-worm Pond (foundational) |
| PP | Penguin Pairs / Kororā (foundational) |
| PIPI | Pipi's Hidden Shells (foundational) |
| TUI | Tūī's Ten Tree (foundational) |
| WEKA | Weka's Stepping Stones (foundational) |
| QL | Quick looks, subitising (foundational) |
| BM | Bond Match (easy) |
| FQ | **Focus questions**, used by: Wormholes, Gem Keep, Marble Rush, Mine Runner, Archery (speed round), Diamond Drop, Royal Decree, Sky Isles, Kingdom Keeper, Star Trader, Clan Quest (Battle Cry) |
| MON | Maths Monsters (banded topic packs, not the focus ladder) |
| DM | Dragon Maths (banded packs plus money and patterns packs, number guess) |
| CQ | Clan Quest practical questions |
| OTH | Mechanics in other games with a maths side effect: Star Trader (chart, trading), Archery (aim angle), Kingdom Keeper (feeding and land), Chess and Checkers (board squares). Card 101, Power Clash, Sky Isles building: nothing found. |

## 2. The matrix

| Skill | BS | HOP | PP | PIPI | TUI | WEKA | QL | BM | FQ | MON | DM | CQ | OTH |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **NUMBER** | | | | | | | | | | | | | |
| Counting sequence, one-to-one, cardinality | - | P | - | - | - | - | P | - | - | - | - | - | - |
| Subitising (to 5, then structured to 10) | - | - | - | - | - | - | C | - | - | - | - | - | - |
| Comparing and ordering numbers; one more / one less | - | - | - | - | - | - | - | - | - | P | P | - | - |
| Number to 20, teen numbers as ten and some | - | - | - | - | C | P | P | - | P | - | - | - | - |
| Bonds to 10 and 20 | C | - | - | C | P | C | P | C | P | P | P | - | - |
| Part-whole / missing part | P | - | - | C | P | P | P | P | P | - | - | - | - |
| Add / subtract strategies (count on, make ten, near doubles, through ten) | - | - | - | - | - | C | - | - | P | P | P | - | - |
| Place value to 100, 1000 and beyond | P | P | - | - | P | - | - | P | P | P | P | - | - |
| Skip counting (2s, 5s, 10s, then 3s, 4s) | - | C | - | - | - | - | - | - | P | - | P | - | - |
| Doubles, halves, near doubles | - | - | C | - | - | - | - | - | P | - | P | - | - |
| Equal groups, arrays; multiplication meaning | - | - | P | - | - | - | - | - | P | - | P | - | P |
| Multiplication and division facts | - | - | - | - | - | - | - | - | P | P | P | P | - |
| Sharing and grouping (division meaning, remainders) | - | - | P | - | - | - | - | - | P | P | P | P | - |
| Fractions: halves, quarters, unit fractions, equivalence | - | - | P | - | - | - | - | P | P | P | P | - | - |
| Decimals and percentages | - | - | - | - | - | - | - | P | P | P | P | P | - |
| Estimation and reasonableness | - | - | - | - | - | - | - | - | - | - | P | - | P |
| **ALGEBRA** | | | | | | | | | | | | | |
| Repeating patterns (colour, shape, sound) | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Growing number patterns, rules | - | P | - | - | - | - | - | - | - | - | P | - | - |
| Equals as "same amount" (balance) | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Missing numbers (? + 3 = 8) | P | - | - | C | C | P | P | - | P | P | P | - | - |
| Inverse operations | - | - | - | - | P | P | - | - | P | P | P | - | - |
| Number properties (commutative, order of operations) | - | - | - | - | P | - | - | - | P | - | - | - | - |
| **MEASUREMENT** | | | | | | | | | | | | | |
| Comparing length, mass, capacity | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Measuring with units (cm, m) | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Reading scales (rulers, jugs, scales) | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Time (o'clock, half past, minutes, calendar) | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Money (coins, totals, change, NZ$) | - | - | - | - | - | - | - | - | - | P | P | P | P |
| Perimeter, area, volume | - | - | - | - | - | - | - | - | - | - | - | P | - |
| Temperature and other scales (incl. negative numbers) | - | - | - | - | - | - | - | - | - | - | - | P | P |
| **GEOMETRY** | | | | | | | | | | | | | |
| Naming, sorting, describing 2D and 3D shapes | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Properties of shapes | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Position and direction (grids, maps, coordinates) | - | - | - | - | - | - | - | - | - | - | - | - | P |
| Symmetry, reflection, rotation, translation | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Composing and decomposing shapes | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Angle (turns, right angle, measure) | - | - | - | - | - | - | - | - | - | - | - | - | P |
| **STATISTICS AND PROBABILITY** | | | | | | | | | | | | | |
| Sorting and classifying by attribute | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Picture graphs, tally charts, bar graphs | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Questions about data / PPDAC | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Chance and simple probability | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Mean, median, mode | - | - | - | - | - | - | - | - | - | - | - | - | - |

Reading the table: the **only mechanic-level (C) coverage in the whole hub** is bonds, part-whole/missing part, teen numbers, make-ten, skip counting, doubles and halves, and subitising, all in the six foundational games, Quick looks and Bond Match. Everything from Year 3 up is quiz-only (P) or absent. Measurement (except money and area as quiz sums), geometry, statistics and probability, and the algebra ideas of repeating patterns and equals-as-balance are absent from every game.

## 3. Evidence for every C and P

Marks use the column codes above. "Quiz" means the maths is a question asked in the game, not the mechanic.

### Number

**Counting sequence / cardinality**
- HOP P: counts in steps along lily pads, but each pad is a skip step, not one-to-one counting. `shared/hop/round.ts:1-14`.
- QL P: child says how many dots after a flash, which is cardinality without counting; no counting task. `shared/subitising/config.ts:44-52`.

**Subitising**
- QL C: seven stages of timed flashes (dots, dice, five-frames, ten-frames), answer locked 1 s so a tap cannot be a guess. `shared/subitising/config.ts:44-52`, `:80-100` (answerLockMs).

**Comparing / ordering / one more, one less**
- MON P and DM P: "10 more and 10 less" and "which fraction/decimal is bigger" as battle or riddle quiz questions. `shared/maths/skillPacks/placeValue.ts:147`, `fractions.ts:47`, `decimals.ts:121`. Not on the focus ladder, so FQ is "-". No whole-number comparing or ordering to 100 anywhere.

**Teen numbers**
- TUI C: each go is a full ten and some more ("10 and 4"), with four ways (how many, turn it round, how many more, take the ten away) and a help level that fades from every berry counted down to numbers only. `shared/tui/round.ts:1-22`.
- WEKA P: teens are the answer to 8 + 5 but the target is bridging, not reading teens. `shared/weka/round.ts:1-18`.
- QL P: ten-frame stages to 10 only, not teens. `shared/subitising/config.ts:47-49`.
- FQ P: "ten and" facts as a number question (10 + 4). `shared/maths/skillPacks/earlyFacts.ts:75`.

**Bonds to 10 and 20**
- BS C: tap two leaves that make 10, then 100, then 1000; a wrong pair wobbles; dots as help. `shared/beanstalk/round.ts:1-12`; `src/games/beanstalk/Round.tsx:1-4`.
- PIPI C: 7 altogether, 4 showing, how many hiding (part-whole to 10). `shared/pipi/round.ts:1-20`.
- WEKA C: how many to fill the ten, then what is left; hop-back goes. `shared/weka/round.ts:1-18, 23`.
- BM C: match pairs that add to a target (wholes, decimals, fractions). `shared/bond-match/bonds.ts:1-8, 33, 41, 49`.
- TUI P: "10 + ? = 14" is the complement to ten, in one of four ways. `shared/tui/round.ts:1-22`.
- QL P: Missing Spots stage counts the empty squares in a ten-frame, which is the bond to 5 or 10 seen as a picture, but not as a number sentence. `shared/subitising/config.ts:50, 117-120`.
- FQ P, MON P, DM P: bonds and add/subtract within 20 as typed questions (a + ? = 10, 10 − 3 = ?). `earlyFacts.ts:25-47`, `addSub.ts:56`.

**Part-whole / missing part**
- PIPI C: hidden amount is the missing part; three kinds of go (hiding, altogether, two tides). `shared/pipi/round.ts:1-20, 35`.
- BS P: pairs are part-whole seen as dots, but the child taps matching leaves, not "part of a whole". `shared/beanstalk/round.ts:1-12`.
- TUI P, WEKA P, QL P: part-whole is how the picture is built (ten and some; split to ten; five and some), not the task. `shared/tui/round.ts:1-22`, `shared/weka/round.ts:14-18`, `shared/subitising/config.ts:47-49`.
- BM P: pairs that make a whole. `shared/bond-match/bonds.ts:33`.
- FQ P: "part7:4" facts as questions. `earlyFacts.ts:180`.

**Add / subtract strategies**
- WEKA C: the child splits to make ten, then adds the rest, with the help fading by fact; hop-back goes (13 − 5) on gold days. `shared/weka/round.ts:1-18, 23`.
- FQ P: only the answer is asked, never the method (`add:7+8`-type keys); the bridging and 2-digit kinds are banded-only. `shared/maths/ladder.ts:94-101`, `addSub.ts:56`.
- MON P, DM P: bridge-ten, two-digit with carry and borrow, three-digit, near 100 as battle/riddle quiz. `shared/maths/skillPacks/addSub.ts:139-253`. Near doubles: nowhere.

**Place value to 100, 1000 and beyond**
- BS P: same bonds in tens and hundreds (30 + 70, 300 + 700), but only the sum matters. `shared/beanstalk/round.ts:12-14`.
- HOP P: a hundreds board opens as an optional helper. `src/games/hop/HundredsBoard.tsx:1-5`; `src/games/hop/Hops.tsx:110`.
- TUI P: tens and ones inside the teens only. `shared/tui/round.ts:1-22`.
- BM P: bond sets to 100 and 1000 as numerals. `shared/bond-match/bonds.ts:33`.
- FQ P: pairs that make 100/1000, times with tens, rounding, squares as questions. `shared/maths/ladder.ts:106-144`.
- MON P, DM P: digit worth, partitioning (362 = 300 + 60 + 2), rounding as quiz. `placeValue.ts:145-157`.
- No game has the child build or read a 2- or 3-digit number with blocks or a place-value chart.

**Skip counting**
- HOP C: ten hops per day on a row of lily pads with one missing; the child picks the glow-worm number; steps 10, 5, 2 move on at 70 percent; counting back on gold days. `shared/hop/round.ts:1-24, 51-53`.
- FQ P: next, up and back counting questions in text. `earlyFacts.ts:132`; ladder `ladder.ts:96-99`.
- DM P: "next number" patterns, counting on and back by 2 to 10. `shared/maths/skillPacks/patterns.ts:19-52`.
- Counting in 3s, 4s, 6s, 7s: only inside patterns questions; no game.

**Doubles, halves, near doubles**
- PP C: ten goes at the mirror pool, doubles and halves, levels from the child's records, "fair or not" on gold days. `shared/korora/round.ts:1-12, 23-33`.
- FQ P: `dbl:7` and `half:14` as questions. `earlyFacts.ts:52`. DM P: "double" patterns. `patterns.ts:54`.
- Near doubles: not in any game (the early facts pack has no near-double family).

**Equal groups, arrays, multiplication meaning**
- PP P: two equal groups (double) and sharing between two chicks. `shared/korora/round.ts:1-5`. No arrays.
- FQ P, MON P: times tables as facts. `timesTables.ts:22-24`.
- DM P: "3 pies at 12 gold each". `money.ts:44`.
- OTH (Kingdom Keeper) P: feeding people means people times 20 bushels, and land is 10 acres per person; rules are in config but the card is off. `shared/kingdom/config.ts:13-17`.

**Multiplication and division facts**
- FQ P: the default, and most used, question source in the hub, but always a quiz question (gate, shot, council question). `shared/space/mathsQuestion.ts:12-13`; `shared/maths/serverQuestions.ts:104-125`.
- MON P, DM P: times tables and division topics in battle or healer moments. `shared/lord/maths.ts:25-38`.
- CQ P: times and division kinds in Clan Quest. `shared/maths/practical.ts:17-34`.

**Sharing and grouping (division meaning, remainders)**
- PP P: halves as sharing fairly. `shared/korora/round.ts:3-4`.
- FQ P: division facts only (remainders are not on the ladder). `shared/maths/ladder.ts:106-144`.
- MON P, DM P: remainders and missing-number division. `skillPacks/division.ts:86-98`.
- CQ P: share-whole and share-left kinds. `practical.ts:17-34`.

**Fractions**
- PP P: "half of 12 fish" as a number only. `shared/korora/round.ts:3-4`.
- BM P: fractions that make 1 (fraction shelf). `shared/bond-match/bonds.ts:49`.
- FQ P: unit fraction of an amount, fraction bonds, equivalent fractions, simplifying. `ladder.ts:111-141`.
- MON P, DM P: compare, add, mixed numbers. `fractions.ts:36-184`.
- No game shows a fraction as an area, set or line model.

**Decimals and percentages**
- BM P: decimal shelf (0.7 + 0.3). `shared/bond-match/bonds.ts:41`.
- FQ P: tenths, decimal bonds, percent. `ladder.ts:119-135`.
- MON P, DM P: tenths, money, hundredths, comparing. `decimals.ts:34-216`.
- CQ P: percent of an amount, price with tax. `practical.ts:17-20`.

**Estimation and reasonableness**
- DM P: the inn's number guess (pick 1 to 100, find it in 7 tries by halving) is a reasoning game, no estimating of quantities. `shared/lord/maths.ts:114-115`.
- OTH (Star Trader) P: pupils judge which planet pays best from prices shown, but the game works out the profit for them. `shared/trader/priceGuide.ts:1-8`.

### Algebra

**Growing patterns and rules**
- HOP P: the rule "add 10 / 5 / 2 each time" on a row of pads. `shared/hop/round.ts:1-14`.
- DM P: next, missing, step, growing and rule patterns in riddles. `patterns.ts:19-125`. Not available to FQ.

**Missing numbers**
- PIPI C: hidden amount is the unknown. `shared/pipi/round.ts:1-20`.
- TUI C: "10 + ? = 14" is one of the four ways asked. `shared/tui/round.ts:1-22`; `earlyFacts.ts:74`.
- BS P, WEKA P, QL P: the missing partner or the gap is asked as a picture task, not as an equation. `shared/beanstalk/round.ts:1-12`, `shared/weka/round.ts:14-18`, `shared/subitising/config.ts:50`.
- FQ P, MON P, DM P: "a + ? = total", "missing factor", "? ÷ 4 = 7". `earlyFacts.ts:25-47`, `timesTables.ts:23`, `division.ts:86`.

**Inverse operations**
- TUI P: take the ten away (14 − 10), mixed with the add ways at step 5. `shared/tui/round.ts:7-12`.
- WEKA P: hop back (13 − 5). `shared/weka/round.ts:23`.
- FQ P, MON P, DM P: missing factor and bond questions in both directions. `earlyFacts.ts:25-47`.

**Number properties**
- TUI P: "turn it round" asks 4 + 10 as well as 10 + 4, which is commutativity shown but never named. `shared/tui/round.ts:7`.
- FQ P: order of operations as typed expressions. `ladder.ts:144`; `skillPacks/bedmas.ts:166`.

### Measurement

**Money**
- MON P, DM P: shop, healer and bank questions (change, totals, cost of several, which is better value, adding money in dollars and cents). `skillPacks/money.ts:25-182`, `decimals.ts:74-88`, `shared/lord/maths.ts:25-33`. Gold is a whole number in Dragon Maths; there are no coins.
- CQ P: change, price with tax, budget. `practical.ts:17-34`.
- OTH (Star Trader) P: credits earned from buy-low sell-high, with the profit shown by the game. `shared/trader/priceGuide.ts:1-8`.
- Not in FQ: money kinds are not on the ladder.

**Perimeter, area, volume**
- CQ P: `area` (w × h) and `perimeter` as typed number questions, no shape drawn. `shared/maths/practical.ts:224-246`.

**Temperature and scales (negative numbers)**
- CQ P: `negative` kind. `practical.ts:461`.
- OTH (Star Trader) P: star chart coordinates run through negative values. `shared/trader/galaxy.ts:33`, `trader.test.ts:50-55`.

### Geometry

**Position and direction**
- OTH P: Star Trader's chart uses (x, y) coordinates, with distance and fuel; Chess and Checkers use named squares. `shared/trader/galaxy.ts:33-43`; `src/games/chess/moveText.tsx`. Neither teaches left/right, turns or route-giving.

**Angle**
- OTH (Archery) P: the child sets a launch angle in degrees (0 to 180) on the aim dial. `src/games/archery/DuelScreen.tsx:527`, `src/games/archery/FightScreen.tsx:514`; `shared/archery/aim.ts:1-4`. It is a tuning dial; angle ideas (right angle, turns) are not taught.

## 4. Gaps: every skill that is not covered or only partly covered

**Scoring.** The table below is in rough order of work-up, not final rank: the ranked list after it is the one to use. Importance = how much later learning depends on it (from the research map "Later dependence", Part 2). Suitability = how well it fits a short (2 to 5 minute) game with checkable answers (the research map's "Game fit"). High = 3, Medium = 2, Low = 1; Priority = Importance × Suitability, and ties are ranked by importance first, then by the Year of first teaching (earlier first). "Now" says what exists: none = not anywhere, quiz = only P as questions. Skills that already have a C game (bonds, part-whole, teen numbers, subitising, make ten) are not listed.

Importance and suitability copy the research map where it gave a rating. Where it gave a range ("Med-High"), I used the lower end for suitability and the higher end for importance. Where the research map had no row (e.g. "Number properties"), I used my judgement and marked it (j).

| # | Gap | Now | Importance | Suitability | Priority |
|---|---|---|---|---|---|
| 1 | Equals as "same amount" (balance, true/false equations) | none | High 3 | High 3 | **9** |
| 2 | Comparing and ordering numbers, one more / one less | quiz (MON, DM) | High 3 | High 3 | **9** |
| 3 | Place value to 100 and 1000: building and reading numbers with tens and ones | quiz | High 3 | High 3 | **9** |
| 4 | Growing number patterns and rules | quiz (DM only) | High 3 | High 3 | **9** |
| 5 | Counting sequence, one-to-one, cardinality (count out N, stop at N) | tiny (HOP, QL) | High 3 | High 3 | **9** |
| 6 | Money: coins, totals, change in NZ$ (as a game, not a gold sum) | quiz (3 games) | Med-High 3 | High 3 | **9** |
| 7 | Missing numbers as number sentences (? + 3 = 8) with a model | mixed (PIPI, TUI C) | High 3 | High 3 | **9** |
| 8 | Repeating patterns (colour, shape, sound) | none | Med 2 | High 3 | **6** |
| 9 | Add and subtract strategies: near doubles, counting on, through ten for subtraction, bridging any decade (28 + 5) | quiz (FQ) and WEKA C for to 20 | High 3 | Med 2 | **6** |
| 10 | Equal groups and arrays (multiplication meaning) | quiz | High 3 | Med-High 2 (j) | **6** |
| 11 | Fractions as shapes and sets: halves, quarters, equivalence with area models | quiz | High 3 | Med-High 2 | **6** |
| 12 | Sharing and grouping (division meaning, remainders) as pictures | quiz | High 3 | Med 2 | **6** |
| 13 | Time: o'clock, half past, quarter past, minutes, calendar | none | Med 2 | High 3 | **6** |
| 14 | Position and direction: left/right, grid, route, coordinates | OTH (Trader P) | Med-High 3 | High 3 | **9** |
| 15 | Symmetry, reflection, rotation, translation | none | Med 2 | High 3 | **6** |
| 16 | Composing and decomposing shapes (tangram, tiling) | none | Med 2 | High 3 | **6** |
| 17 | Naming, sorting and describing 2D and 3D shapes | none | Med 2 | High 3 | **6** |
| 18 | Sorting and classifying by attribute | none | Med 2 | High 3 | **6** |
| 19 | Picture graphs, tally charts, bar graphs (read and make) | none | Med-High 3 | High 3 | **9** |
| 20 | Inverse operations (add/subtract, multiply/divide) shown as a pair | quiz | High 3 | Med-High 2 | **6** |
| 21 | Reading scales (rulers, jugs, scales) | none | Med-High 3 | Med-High 2 | **6** |
| 22 | Measuring with non-standard then standard units | none | High 3 | Med 2 | **6** |
| 23 | Perimeter and area with tiles (shown, not as a typed sum) | quiz (CQ) | Med-High 3 | Med 2 | **6** |
| 24 | Properties of shapes (sides, corners, faces) | none | Med-High 3 | Med-High 2 | **6** |
| 25 | Skip counting from non-multiples, backward, then 3s and 4s | partial (HOP C for 10s, 5s, 2s) | High 3 | High 3 | see note |
| 26 | Doubles, near doubles, halves of larger numbers (tens and ones) | PP C to 20 | Med-High 3 | High 3 | see note |
| 27 | Decimals and percentages as models (tenths, hundredths) | quiz | High 3 | Med 2 | **6** |
| 28 | Multiplication and division facts (understanding first, then fluency) | quiz in 10+ games | High 3 | High 3 | **9** |
| 29 | Estimation and reasonableness | tiny (DM guess) | Med-High 3 | Med 2 | **6** |
| 30 | Comparing length, mass, capacity | none | Med 2 | Med 2 | **4** |
| 31 | Number properties (commutative, order of operations) | quiz (FQ) | Med-High 3 | Med 2 | **6** |
| 32 | Angle (turns, right angle, measure) | OTH (Archery P) | Med 2 | Med 2 | **4** |
| 33 | Chance and simple probability (likely, fair) | none | Med 2 | Med 2 | **4** |
| 34 | Mean, median, mode | none | Med 2 | Med 2 | **4** |
| 35 | Temperature and other scales (negative numbers) | quiz (CQ), chart | Low-Med 2 | Med 2 | **4** |
| 36 | Asking and answering data questions (PPDAC) | none | Med-High 3 | Low-Med 1 | **3** |

Note for 25 and 26: those skills are covered by a C game for the basics, so they are not gaps; only the extensions are, and they rate 6 to 9. I put them at the bottom of their score tier instead of re-ranking.

### Ranked list (score, then importance, then earlier Year first)

**Priority 9** (high importance, high suitability, ranked by earliest Year):

1. Counting sequence, one-to-one, cardinality (Y0-1): only Hop and Quick looks touch it, and neither asks the child to count out a number or stop at N.
2. Comparing and ordering numbers, more/less, one more / one less (Y1-2): not in any game's mechanic; "10 more / 10 less" is a Monsters or Dragon Maths question only.
3. Equals as "same amount", balance and true/false equations (Y1-3): absent. The research notes it as the misconception that blocks algebra.
4. Missing numbers with a model (Y1-4): Pipi and Tūī cover the early version; nothing continues it past 20 or into `8 = ? + 5` forms.
5. Position and direction: left/right, grid, route (Y1-6): chart coordinates and chess squares only by side effect.
6. Place value to 100 and 1000: build and read numbers (Y2-5): the teen game ends at 20; everything else is a quiz.
7. Money: coins, totals, change (Y1-5): only as gold or dollar-and-cent quiz sums in Dragon Maths, Monsters and Clan Quest.
8. Growing number patterns, rules (Y2-5): Dragon Maths riddles only; not available to the focus system.
9. Picture graphs, tally charts, bar graphs (Y1-5): absent from every game.
10. Multiplication and division facts, understanding first (Y3-6): the most-asked content in the hub is a quiz inside ten or so games; no game shows why 6 × 4 = 24 (arrays, equal groups).

**Priority 6**, in this order (importance 3 first, then earlier Year):
11. Repeating patterns (Y0-2). 12. Add and subtract strategies beyond ten (near doubles, bridging 28 + 5, through ten for subtraction) (Y2-4). 13. Equal groups and arrays (Y2-4). 14. Inverse operations shown as a pair (Y2-5). 15. Sharing and grouping, remainders (Y3-5). 16. Fractions as shapes and sets (Y1-6). 17. Reading scales (Y2-5). 18. Measuring with units (Y1-4). 19. Time (Y1-5). 20. Estimation (Y2-6). 21. Number properties (Y2-6). 22. Properties of shapes (Y2-6). 23. Perimeter and area with tiles (Y3-6). 24. Decimals and percentages as models (Y5-6). Then, importance 2: symmetry (Y2-6), composing shapes (Y0-4), naming shapes (Y0-3), sorting and classifying (Y0-2).

**Priority 4 and 3**: comparing length, mass, capacity; angle; chance; mean/median/mode; temperature and scales; and last, the full statistical investigation cycle (needs real data collection, low suitability).

### Judgement calls to check

- I scored a skill with a good foundational game plus quiz questions in other games (bonds, skip counting, doubles) as "not a gap". Fluency in the focus system may still be worth keeping, but it is not a teaching gap.
- Several research ratings are ranges. Where the range crossed a boundary (e.g. "Med-High" game fit for equal groups) I used the lower end for suitability and the higher end for importance; ranks 10 to 12 would move up one tier if you read them the other way.
- No game was played. Marks come from code and shared files; whether Bond Match's fraction cards show fraction pictures (so BM would be C rather than P for halves) needs a play-through (`shared/bond-match/bonds.ts:49`, `src/games/bond-match/Card.tsx`, `Value.tsx`).
- Card 101, Power Clash, Chess, Checkers and Sky Isles building have no maths of their own that I found; Sky Isles gets its questions from FQ.
