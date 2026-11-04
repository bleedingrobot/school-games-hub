# Weka's Stepping Stones (making ten to add within 20) — plan

Short id `weka`. **Status: Stage 0, plan only (4 Nov 2026).** Game D in `docs/EARLY-GAMES-PLAN.md`; the parts every early
game shares are in section 7 there and aren't repeated here. Best built after Tūī's Ten Tree, which it leans on.

## 1. The game in plain words

Weka, a cheeky brown bird that can't fly, wants to cross a stream on stepping stones to reach a picnic. In the middle of
the stream is one big flat rock: stone 10.

- **Today's challenge.** "Weka is on 8. Hop on 5." On bronze days the child first taps where Weka lands on the big rock
  (8 + 2 → 10), then the rest of the hops (+3 → 13). On silver and gold days the child just taps the answer, 13, on a
  stone. Weka hops there, stopping on the big rock first. A wrong one wobbles back. About 10 goes.
- **The magic things.** 10 big stones on the far bank, bronze, silver then gold.
- **The win.** The Golden Picnic Basket (weka are famous for pinching things). Then a new friend's stream.

## 2. The maths

- **Skill:** adding within 20 by making ten (8 + 5 = 8 + 2 + 3). NZ Year 2 (`MS.Y2.NUM.OP.P1`); NCETM's "adding across
  10". It needs bonds to 10 (Beanstalk, Pipi) and teen numbers (Tūī).
- **Probably no new shared maths.** Uses the existing `add:a+b` keys (a ≤ b) where both are 9 or less and the total is 11
  to 18: 20 facts, in the ladder skill `facts-20`. The game shows the bigger number first (Weka starts on 8, not 5).
- **Levels:**
  1. Starting on 9 (9 + 2 to 9 + 9).
  2. Starting on 8.
  3. Starting on 7 and 6.
  4. Mixed.
- **Taking away across 10** (13 − 5: hop back to the big rock, then on) on gold days. Stage 1 checks whether the `add`
  family's records can hold a take-away version. If not, it is either recorded as its matching add fact or needs a small
  shared-maths branch (`sub:13-5` keys). James to choose.
- **The two-step tap on bronze days** (to 10, then on) is recorded only as the final answer. The first step is help.
- **Wrong choices:** one more, one less, the answer if counted from the wrong stone (one less), and 10 + the second
  number.

## 3. Rules (`shared/weka/`)

- `round.ts`: `levelFor` and `makeRound`, from the 20 bridging `add` keys.
- `play.ts`: replays taps, including the bronze-day two-step tap.
- `progress.ts`: as Hop.

## 4. Help that fades

- **Bronze:** numbered stones 0 to 20 in a line, the big rock marked 10, the two hops drawn (+2, +3), and the child taps
  the big rock first.
- **Silver:** stones show only every 5th number; the big rock still stands out; one tap.
- **Gold:** no stones, just "8 + 5 = ?".

## 5. The look (open, James to choose)

The stones must read as a straight line (this is a number line in disguise).

1. **Clay**, like Beanstalk and Hop's pond.
2. **Paper cut-out:** a bush stream in layers, round grey paper stones.
3. **Bright flat cartoon**, like the Marble Rush cards.

Pictures: Weka (wait, hop, land, grab, cheer), a stone, the big rock, the stream background (morning, silver, golden), 10
far-bank stones in 4 colours, the Golden Picnic Basket (alone, on a cushion), home card, splash and sparkle. About 28.

## 6. Guided first go

The first question is always 9 + 2. The hand points at the big rock (one hop), then at 11.

## 7. Achievements

One per Golden Picnic Basket, per friend.

## 8. Stages

0. This plan. 1. Rules and tests (and the take-away check). 2. Play screen with stand-ins, preview. 3. Server. 4. Hub,
settings, guided first go, prize. 5. Go live.

## 9. Questions for James

1. Which look?
2. Gold-day taking away: leave it out, record it as the matching add fact, or add `sub` keys (small shared-maths branch)?
3. Name: "Weka's Stepping Stones"?
