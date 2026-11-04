# Ruru's Number Trail (number line, one more and one less, comparing) — plan

Short id `ruru`. **Status: Stage 0, plan only (4 Nov 2026).** Game E in `docs/EARLY-GAMES-PLAN.md`; the parts every early
game shares are in section 7 there and aren't repeated here. The biggest of the five: most new maths, and a new "close
enough" mark.

## 1. The game in plain words

Ruru, the morepork owl, flies along a moonlit trail of fence posts at night, delivering moths to her owlets. The posts
are in a straight line, numbered in order.

- **Today's challenge.** Questions about the trail:
  - "Fly to the post **one more** than 12." The child taps post 13.
  - "Fly to the post **one less** than 20."
  - "Which nest is **bigger**: 15 or 51?" The child taps one of two nests.
  - Gold days: "Land where **7** goes" on a trail with only 0 and 10 marked. Close enough counts.
  Ruru swoops to the post. A wrong one wobbles back. About 10 goes.
- **The magic things.** 10 lanterns on the posts, bronze, silver then gold.
- **The win.** The Golden Moon. Then a new friend's trail.

## 2. The maths

- **Skill:** the number line (where numbers sit and how big they are), one more and one less, comparing. NZ Years 1 to 2
  (counting forwards and backwards, comparing and ordering); NCETM's "linear number system"; Clements and Sarama's
  comparing and number-line trajectories. Siegler and Ramani's research found short linear number games like this help
  young children's number sense noticeably.
- **Levels (the trail gets longer):**
  1. 0 to 10.
  2. 0 to 20.
  3. 0 to 100 (posts every 10 on silver and gold days).

### Shared maths needed (its own small branch, live before the game)

New families in `earlyFacts.ts`:
- `more1:n` and `less1:n`, n from 0 to 20, then tens to 100 (`more10:n`, `less10:n` for "ten more").
- `cmp:a-b`: which is bigger. Chosen pairs, not all of them: neighbours (13, 14), swapped digits (15, 51), and teens
  against tens (17, 70). About 40 keys.
- `line10:n`, `line20:n`: place n on an empty line. **New kind of mark:** the answer is a place, right if within a set
  distance (1 on 0 to 10, 2 on 0 to 20). The shared question shape has one right number, so this needs `answer` plus a
  `tolerance`, or the game marks it with its own rule and records a plain right or wrong. Stage 1 of the shared branch
  decides, with a test.
- Ladder skills `more-less-20` and `number-line-20` before `facts-10`, `inWarmUp: false`; `more-less-100` near
  `skip-10`.

## 3. Rules (`shared/ruru/`)

- `round.ts`: `levelFor` and `makeRound`: 10 questions mixing the kinds, weakest first.
- `play.ts`: replays taps; a "place it" tap is a position on the line, marked with the tolerance.
- `progress.ts`: as Hop.

## 4. Help that fades

- **Bronze:** every post numbered; "one more" shows a small arrow to the next post.
- **Silver:** every 5th post numbered (every 10th on 0 to 100).
- **Gold:** only the ends numbered, and "place it" questions join in.

## 5. The look (open, James to choose)

A night scene, but the numbers must stay easy to read on a Chromebook: light posts with dark numbers.

1. **Clay**, like Hop's night pond, so the two night games look related.
2. **Paper cut-out:** layered dark-blue hills and a cut-out moon, light paper posts.
3. **Soft painted storybook** with glowing light, like the Quick looks garden at dusk.

Pictures: Ruru (perch, fly, swoop, cheer), owlets, a post, nests, a moth, the trail background (night, silver frost,
golden moonrise), 10 lanterns in 4 colours, the Golden Moon (alone, on a cushion), home card, sparkle. About 30.

## 6. Guided first go

The first question is always "one more than 3" on the 0 to 10 trail. The hand points at post 3, then 4.

## 7. Achievements

One per Golden Moon, per friend.

## 8. Stages

0. This plan.
1. **Shared maths branch:** the new families, the "close enough" mark, and the ladder skills. Live on its own, first.
2. Rules and tests. 3. Play screen with stand-ins, preview. 4. Server. 5. Hub, settings, guided first go, prize. 6. Go
live.

## 9. Questions for James

1. Which look?
2. Keep "place it" (estimating), which needs the new "close enough" mark, or leave it for later?
3. Go to 100 in this game, or stop at 20 and leave 100 for a later game?
4. Name: "Ruru's Number Trail"?
