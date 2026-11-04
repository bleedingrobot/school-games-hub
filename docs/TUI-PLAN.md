# Tūī's Ten Tree (teen numbers as ten and some more) — plan

Short id `tui`. **Status: Stage 0, plan only (4 Nov 2026).** Game C in `docs/EARLY-GAMES-PLAN.md`; the parts every early
game shares are in section 7 there and aren't repeated here.

## 1. The game in plain words

Tūī loves the nectar of kōwhai flowers (or berries). On the Ten Tree, every full branch holds exactly 10 flowers.

- **Today's challenge.** A full branch of 10 and some loose flowers float to Tūī. "How many flowers?" The child taps the
  number on a nest (10 and 4 → 14). Other days it goes the other way: "Tūī needs 16. Here is a full branch. How many more
  flowers?" (6). A right answer: Tūī sings and the flowers go to the nest. A wrong one wobbles back. About 10 goes.
- **The magic things.** 10 big flowers on the Ten Tree, bronze, silver then gold.
- **The win.** The Golden Nest. Then a new friend's tree.

## 2. The maths

- **Skill:** the teen numbers are ten and some more. 10 + 4 = 14, 16 − 10 = 6, 10 + ? = 17. NZ Year 1
  (`MS.Y1.NUM.OP.P6`); NCETM's "structure of numbers 10 to 20". This is the step before making ten (Weka) and tens and
  ones.
- **No new shared maths.** Uses the existing `tenand:1` to `tenand:9` keys and the ladder skill `ten-and`. The family
  already asks four ways: 10 + n, n + 10, 10 + ? = 1n, and 1n − 10. The game shows each with the branch picture.
- **Only 9 facts.** A round of 10 has repeats, so each round mixes the four ways. A child is "secure" when all nine are
  box 2 or higher; after that the game keeps going with the four ways mixed, weakest first.
- **Gold days add 20:** two full branches. Not recorded (no key), just the finale of the round.
- **Wrong choices** from the shared family: one more, one less, ten more, and the teen number swapped (41 for 14 is a
  common slip; check the family has it, otherwise add it to the game's own extra choices).

## 3. Rules (`shared/tui/`)

- `round.ts`: `makeRound(seed, records)`: 10 questions from the nine `tenand` keys, weakest first, each with its way.
- `play.ts`, `progress.ts`: as Hop.

## 4. Help that fades

- **Bronze:** every flower shows, the full branch in a ten-frame; the number under it says "10".
- **Silver:** the full branch is one bar marked "10"; loose flowers still show.
- **Gold:** numbers only: "10 + 4".

## 5. The look (open, James to choose)

The full branch must read as "ten" at a glance, and the loose ones must be easy to count.

1. **Clay**, like Beanstalk.
2. **Paper cut-out:** a big kōwhai tree in layered paper, flowers as yellow cut-outs.
3. **Soft painted storybook**, like the Quick looks garden, so Training and this game feel related.

Pictures: Tūī (wait, sip, sing, cheer), a full branch (10 flowers in a 2×5 shape), a loose flower, the tree background
(spring, silver morning, golden evening), 10 magic flowers in 4 colours, the Golden Nest (alone, on a cushion), home card,
sparkle. About 26.

## 6. Guided first go

The first question is always 10 and 2. The hand points at the full branch ("ten"), the 2 loose flowers, then 12.

## 7. Achievements

One per Golden Nest, per friend.

## 8. Stages

0. This plan. 1. Rules and tests. 2. Play screen with stand-ins, preview. 3. Server. 4. Hub, settings, guided first go,
prize. 5. Go live. **No shared-maths branch.**

## 9. Questions for James

1. Which look?
2. Later, grow it into tens and ones to 100 (several full branches)? That needs new shared maths.
3. Name: "Tūī's Ten Tree"?
