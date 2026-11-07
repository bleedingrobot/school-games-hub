# New-game concepts for the gaps (fundamental maths review, 7 Nov 2026)

Gaps 1 to 6 are ranked in `docs/reviews/maths-review/DECISIONS.md`. For each: one to three concepts, then the pick. Every concept follows the early-game frame (`docs/EARLY-GAMES-PLAN.md` section 7, built like Tūī and Weka): a short daily challenge of about 10 goes, 30 counted days to a golden prize, help that follows the child (six levels, down after two good challenges, up after a hard one), no penalty for a wrong tap, a server that makes and marks rounds, and recording through `recordMathsAnswers` into `gem_keep_facts` (early-facts keys, first tap only). Guide birds avoid the ones already guiding a game: Kiwi (Beanstalk), Hop the frog, Two-Shoes the penguin (Penguin Pairs), Pipi, Tūī, Weka. Ruru is already planned (`docs/RURU-PLAN.md`, not built), so it is not reused for anything else. Birds that only appear as "next friends" in Tūī's and Weka's lists (Kererū, Kea, Pūkeko, which keep those names in the other lists) are still free to lead their own game; here they lead the Pigeon, Parrot and Swamp Hen games.

## Gap 1. Comparing, ordering and the number line

**Already planned:** Ruru's Number Trail (`docs/RURU-PLAN.md`) covers one more, one less, which is more and where does it go on 0 to 10 and 0 to 20, for ages 5 to 7. Build it as planned. What it leaves open is the line to 100 and 1000, reading unmarked points, zooming and nearest ten. The concepts below fill that.

- **A. Pigeon's Number Line** (a wood pigeon flies a great branch; 0 to 100 then 0 to 1000). Core mechanic: the child taps where a number goes, or reads where the arrow is, on a line whose marks fade; the maths *is* the line. Age and level: 7 to 9, NZ Phase 1 end to Phase 2 start (Years 3 to 4). Support: six levels from a ruler of ticks to just the ends with a Peek; landmarks (middle, then tens) go last. Records: `place100`, `read100`, `tens100`, `near10`, `zoom`, `place1000`, `near100` keys, plus tap distance. Size: L (the line component is the large part; it is copied from Ruru's).
- **B. Fantail's Washing Line** (a fantail pegs number cards on a line in order). Core mechanic: order three to five numbers by dragging. Age 5 to 8. Support: spacing hints fade. Records: order keys. Size: M. *Not picked:* ordering is a weaker task than placing on a proportional line, and Ruru's "which is more" and Pigeon's gold-day "order three" cover it.
- **C. Kiwi's Magnifier** (a lens zooms into 40 to 50). Core mechanic: zooming as a tool. Age 8 to 10. Size: M. *Not picked as its own game:* it becomes Pigeon's step 6 (zoom in).

**Pick: A, built on Ruru.** It extends rather than duplicates. The plan says what to do if James would rather add steps to Ruru.

## Gap 2. Equals as balance and missing numbers

- **A. Parrot's See-saw** (a mountain parrot will not stop playing until the see-saw is level). Core mechanic: drag stones until it levels, then the same with numbered weights, then the equation; the tilt *is* the meaning of `=`. Age 5 to 8, Phase 1, Years 1 to 3. Support: stones with live tilt, then numbers with a Check, then the equation with a Peek, then none. Records: `eqmiss`, `eqswap`, `eqboth`, `eqsub`, `eqtf` keys, and which slip each wrong card was. Size: M.
- **B. Swamp Hen's Mystery Bags** (a bag of unknown weight on a balance, with known weights on the other side). Core mechanic: find the unknown by balancing (`? + 3 = 8`). Age 8 to 10, early algebra. Size: M. *Not picked:* it is a second layer, and Parrot's steps 2 to 4 reach the same idea earlier. It can follow as Parrot's friend levels.
- **C. True or False Cards** (quick-fire equation judgements). Core mechanic: tap true or false. Size: S. *Not picked:* it is a quiz with a coin-flip, the very thing the review is trying to leave behind; only the idea stays as Parrot's step 5 with the see-saw.

**Pick: A.**

## Gap 3. Place value to 100 and beyond

- **A. Lizard's Bundles** (an old lizard ties sticks in tens). Core mechanic: drag sticks to a mat, tie ten into a bundle, untie a bundle; the child performs the grouping. Age 6 to 9, Years 2 to 4. Support: labelled Tens and Ones mat, then colours only, then plain, then numbers with a Peek. Records: `pvbuild`, `pvread`, `pvzero`, `pvregroup`, `pvten`, `pv3`, `pvhun`. Size: L.
- **B. Pigeon's Hundred Chart Jigsaw** (fill the missing pieces of a 100 grid). Core mechanic: fill gaps using ten more and ten less down a row. Age 6 to 8. Size: M. *Not picked:* it teaches pattern, not grouping; its idea (ten more is the next row) is in Lizard's step 5.
- **C. Fantail's Piggy Bank** (coins 1, 10, 100 swapped at a bank). Core mechanic: exchange ten for one. Age 7 to 9. Size: M. *Not picked:* it overlaps money (N6) and coins are a harder model than bundles.

**Pick: A.**

## Gap 4. Equal groups and arrays

- **A. Swamp Hen's Reed Rows** (plant a swamp garden in rows). Core mechanic: plant rows, see the total build row by row, turn the garden, cut it to use a known fact; share a heap into equal rows. Age 7 to 10, Years 3 to 4 (and into 5 for the 6, 7, 8, 9 tables). Support: neat rows with running totals, then a bar, then a mat with only the edges, then the symbols with a Peek. Records: the existing `mul:AxB` keys (so the times-tables campaign moves too) plus `rows`, `turn`, `share`, `cut`, `which`. Size: L (the largest of the five).
- **B. Egg Trays** (pack eggs into 6- and 12-hole trays for orders). Core mechanic: equal groups ("3 trays of 6"). Age 6 to 8. Size: M. *Not picked:* groups without rows do not show commutativity or the link to area; its idea (equal groups) is step 1.
- **C. Pigeon's Fruit Share** (share fruit between birds, with remainders). Core mechanic: division as sharing. Age 8 to 10. Size: M. *Not picked as its own game:* division is Swamp Hen's step 4, and remainders are a later gap.

**Pick: A.**

## Gap 5. Counting out a set

- **A. Robin's Berry Basket** (give exactly N berries, then count a scatter, then count on). Core mechanic: tap berries into a basket and stop at N; touch each berry in a scatter to mark it. The stopping *is* cardinality. Age 4 to 6, NZ Number Framework Stages 0 to 3, Years 0 to 1. Support: a basket with numbered slots and Bella counting along, then a plain basket, then a free pile; tapped berries dim, then do not. Records: `give`, `howmany`, `counton`, `countacross`, and the over, under, skipped and doubled pattern. Size: M (the smallest of the five).
- **B. Feed the Teal** (tap bread to the ducks, give N). Core mechanic: the same. Size: M. *Not picked:* same game, a less pre-reader-friendly theme (dropping bread is fast and fiddly).
- **C. Quick looks plus a count** (add a count to subitising). Size: S. *Not picked:* Quick looks is about not counting; mixing the two blurs both.

**Pick: A.**

## Gap 6. Money: NZ coins, totals and change (sketch only)

- **A. Kingfisher's Dairy** (a kingfisher keeps a dairy; pay for sweets with real NZ coins). Core mechanic: drag coins ($2, $1, 50c, 20c, 10c) onto the counter to pay exactly; later count up change from a note. NZ detail: there is no 5c coin, so a cash total rounds to the nearest 10c (a real rounding lesson). Age 6 to 10, Years 2 to 5. Support: coins labelled with how many cents, then a running total, then a plain tray with a Peek; fades with the child as the others. Records: `coin:` (recognising and valuing), `pay:` (exact amounts), `change:` (counting up) and `round10:` keys. Size: M to L (a coin tray with five coin designs and a shop scene need art and a drag interaction, and the cash rounding rule needs its own tests).
- **B. Fantail's Pocket Money** (sort and total a purse). Core mechanic: total your coins. Age 6 to 8. Size: S to M. *Not picked:* total only, no change or real use.
- **C. Market Stall** (set prices and give change as the seller). Age 8 to 10. Size: M. *Not picked for now:* a fine second game once Kingfisher's Dairy exists (its change steps are the same maths).

**Pick: A, sketch only.** Full plan to be written after N1 to N5 if James wants it (ranked last in DECISIONS.md). It uses Gap 6's priority tie-breaks: high engagement and real-life use, but it builds on nothing we already have. Money questions are already asked as quiz sums in Maths Monsters, Dragon Maths and Clan Quest (`shared/maths/skillPacks/money.ts`), so this game would sit beside them and not replace them.

## Summary of picks

| Gap | Pick | Id | Age | Size | Plan |
|---|---|---|---|---|---|
| 1 | Pigeon's Number Line (on Ruru) | `pigeon` | 7 to 9 | L | N1-number-line.md |
| 2 | Parrot's See-saw | `parrot` | 5 to 8 | M | N2-balance.md |
| 3 | Lizard's Bundles | `lizard` | 6 to 9 | L | N3-place-value.md |
| 4 | Swamp Hen's Reed Rows | `swamphen` | 7 to 10 | L | N4-arrays.md |
| 5 | Robin's Berry Basket | `robin` | 4 to 6 | M | N5-counting-out.md |
| 6 | Kingfisher's Dairy (sketch) | none yet | 6 to 10 | M to L | this file |
