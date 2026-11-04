# Penguin Pairs (doubles and halves) — plan

Short id `korora`. **Status: built and going live 4 Nov 2026 with clay stand-in art; final paintings in `docs/KORORA-ART-PLAN.md`.** Was called "Kororā's Mirror Pool"; the penguin is Two-Shoes (section 10). Game B in `docs/EARLY-GAMES-PLAN.md`; the parts every
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

## 9. James's answers (4 Nov 2026)

1. **Look:** clay, like Beanstalk.
2. **Fair or not?** Recorded. Shared maths gained the `oddEven` family (keys `oddeven:n`) and the ladder skill
   `odd-even` after skip-2 (PR #201). Gold days end with 2 fair-or-not goes.
3. **Name:** Penguin Pairs (code id stays `korora`).
4. **Support:** all nine ideas:
   1. Help fades with the pebbles (bronze full picture, silver faint, gold the number only).
   2. Hints build after wrong taps: wobble, then the picture comes back and Bella counts, then the hand points.
   3. Fish sit in rows of five.
   4. Tap a fish to count it.
   5. Tap to share fish between the chicks (bronze days share by themselves).
   6. A double comes just before its half (`pairUp` in `round.ts`).
   7. Full help returns for the round after 3 wrong first taps in a row.
   8. A "Hear it again" button.
   9. Teachers can set picture help to Fades, Always on or Off, and see each child's hardest facts.

## 10. James's changes (4 Nov 2026, after going live)

- The penguin is **Two-Shoes** (code id still `korora`).
- The ten magic stones are **stepping stones across the water**, left bank to right bank; whoever is crossing stands
  on the last stone that changed (`src/games/korora/Pool.tsx`).
- The aim is a **pair of dancing shoes**: each crossing (10 days) wins a pair, bronze, then silver, then dazzling gold
  after 30 days (`shoesWon` in `shared/korora/progress.ts`). Only the gold pair is an achievement, on the same day the
  Golden Fish was, so no pupil's progress changed; migration `20261105000300_korora_shoes.sql` renames the achievements.
- New pictures: flat stepping stones, the gold shoes (bronze and silver tinted from it), backgrounds with water right
  across (`back-across-*`) and a new home card (`docs/KORORA-ART-PLAN.md`).

## 11. How it was built

- Rules: `shared/korora/` (round, play, progress, server, memoryServices), tests in `korora.test.ts`.
- Game: `src/games/korora/` (Goes, Pool, KororaGame, clay SVG stand-ins in `KororaArt.tsx`), preview
  `npm run korora:single` (`preview/korora/`).
- Server: `supabase/migrations/20261105000100_korora.sql`, function `supabase/functions/korora/`, pgTAP test
  `supabase/tests/database/korora.test.sql`.
- Teacher: `src/pages/TeacherKorora.tsx` (switch, picture help, class fish, student panel with hardest facts).
- Read-aloud: Bella, `public/voice/korora/` from `scripts/voice-clips.py korora`.
- Art: `scripts/korora-art.py`, plan in `docs/KORORA-ART-PLAN.md`.
