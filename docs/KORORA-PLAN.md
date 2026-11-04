# Kororā's Mirror Pool (doubles and halves) — plan

Short id `korora`. **Status: Stage 0, plan only (4 Nov 2026).** Game B in `docs/EARLY-GAMES-PLAN.md`; the parts every
early game shares are in section 7 there and aren't repeated here.

## 1. The game in plain words

Kororā, a little blue penguin, lives by a still rock pool. Whatever sits on the edge of the pool shows again in the water.

- **Today's challenge.**
  - **Doubles:** some fish land on the rock (say 4). The pool shows the same 4 upside down. "How many fish now?" The
    child taps 8 on a pebble.
  - **Halves:** a pile of fish (say 12) has to be shared fairly between two kororā chicks. "How many does each chick
    get?" The child taps 6, and the fish slide across, one each in turn, to show it is fair.
  - A right answer: Kororā gulps a fish and flaps. A wrong one wobbles back. About 10 goes.
- **The magic things.** 10 big pebbles around the pool, bronze, silver then gold.
- **The win.** The Golden Fish. Then a new friend's pool.

## 2. The maths

- **Skill:** doubles to 10 + 10 and halves of even numbers to 20. NZ Years 1 to 2 (`MS.Y1.NUM.OP.P2`,
  `MS.Y2.NUM.OP.P2`). It leads to near doubles (6 + 7) and the ×2 table.
- **No new shared maths.** Uses the existing `dbl:` and `half:` keys in `earlyFacts.ts` (families `dblHalf10`, `dblHalf20`)
  and the ladder skills `dbl-half-10` and `dbl-half-20`, both already built.
- **Levels:**
  1. Doubles of 1 to 5.
  2. Halves of 2 to 10.
  3. Doubles of 6 to 10.
  4. Halves of 12 to 20.
- **Gold days add "fair or not?"** (odd and even): 7 fish; can the chicks share them fairly? This has no record of its
  own, so it is played for fun and not recorded. (If James wants it recorded, it becomes a small shared-maths branch: an
  `oddEven:7` family.)
- **Wrong choices** from the shared family: one more and one less, two more and two less, and n + 1 (doubles) or n
  (halves).

## 3. Rules (`shared/korora/`)

- `round.ts`: `levelFor(records, reached)` and `makeRound`; questions built with the shared family's `make`, so the
  wording and wrong choices match the rest of the hub.
- `play.ts`, `progress.ts`: as Hop.

## 4. Help that fades

- **Bronze:** the reflection is clear, each fish and its mirror are joined by a faint line, and halves slide one by one.
- **Silver:** the reflection is rippled and faint; halves show the pile only.
- **Gold:** no reflection, only "Double 7" or "Half of 14" and the number.

## 5. The look (open, James to choose)

A still pool needs a clear mirror line and objects that read well upside down.

1. **Clay**, like Beanstalk: chunky clay penguin, fish and rocks.
2. **Paper cut-out:** a coastal rock pool in layered paper; the reflection is the same cut-outs, flipped and tinted.
   Easy to make clear.
3. **Bright flat cartoon**, like the Marble Rush cards: bold colours, simple shapes.

Pictures: Kororā (wait, dive, gulp, cheer), two chicks (wait, happy), fish, the pool background (day, sparkling silver,
golden evening), 10 pebbles in 4 colours, the Golden Fish (alone, on a cushion), home card, splash and sparkle. About 28.

## 6. Guided first go

The first question is always "double 2". The hand points at the 2 fish, then the 2 in the water, then the 4 pebble.

## 7. Achievements

One per Golden Fish, per friend.

## 8. Stages

0. This plan. 1. Rules and tests. 2. Play screen with stand-ins, preview. 3. Server. 4. Hub, settings, guided first go,
prize. 5. Go live. **No shared-maths branch**, so this is the quickest of the five.

## 9. Questions for James

1. Which look?
2. Record "fair or not?" (odd and even), which needs a small shared-maths branch, or play it unrecorded?
3. Name: "Kororā's Mirror Pool"?
