# Bond Builder (Jack and the Beanstalk) — plan

Short id `beanstalk`. Branch `beanstalk`, worktree `~/games-hub-beanstalk`. Stage 0 (plan), started 4 Nov 2026.

**For younger children (about 5 to 7)**, not the usual Year 4 to 6. Much of the guide still applies (server in charge, the
shared maths focus, switches, going live one step at a time). Some of it is changed on purpose for this age group, as
section 9 sets out.

## 1. The game in plain words

A kiwi is stuck on top of a long white cloud at the top of a giant beanstalk. Kiwi can't fly, so it needs a trail of gold
leaves to climb down.

- **Today's challenge.** Green leaves float at the bottom of the screen, each with a number from 1 to 9. The child taps
  two leaves that make 10. A right pair floats up, sticks to the stalk, and the stalk grows a little towards Kiwi. A wrong
  pair wobbles and drifts back, with no penalty. Ten pairs finish the challenge, and by then the stalk reaches Kiwi.
- **The magic leaves.** The beanstalk has 10 big leaves. On each day a child finishes the challenge, one leaf changes
  colour, and it stays changed:
  - Days 1 to 10 turn the leaves bronze.
  - Days 11 to 20 turn them silver.
  - Days 21 to 30 turn them gold.
- **The win.** When all 10 leaves are gold, Kiwi hops down the gold trail and the child gets **the Golden Egg**. The egg
  goes on their shelf. Next time they play, a new New Zealand friend (tūī, kererū, wētā and so on) is stuck on a fresh
  beanstalk, and the 30 days start again. (James, 4 Nov)
- **Days are counted, not dates.** A child can miss days and nothing is lost. One leaf changes per NZ day at most
  (`nzDate`, server clock). They can play again on the same day for fun, but no extra leaf changes.

At 3 to 4 days a week, one Golden Egg takes about 8 to 10 weeks, roughly one school term.

## 2. What children see first

The beanstalk scene, with Kiwi waving from the cloud, Jack beside the stalk, and a big green **Play** button. The first
time they play, a guided go shows a hand pointing at two leaves that make 10. Words are few and large, and spoken aloud
where the device can (the browser's built-in voice, which James can turn off). Section 9 asks about this.

## 3. The maths

- Only **bonds to 10**: the focus family `bond10` (`shared/maths/skillPacks/earlyFacts.ts`), fact keys like
  `bond10:3+7`. It feeds the ladder skill `facts-10`. Pairs 1+9 to 5+5 are used, and 0+10 is not.
- **Support dots (James, 4 Nov):** each leaf shows its number and that many dots in a ten-frame. The dots shrink as the
  beanstalk advances:
  - Bronze days: full dots.
  - Silver days: small faint dots.
  - Gold days: no dots.

  A teacher can turn the dots off for the class.
- **Questions follow the guide's way A.** The server makes each day's round from the child's focus with `makeFocusPack`
  and a seed: 10 pairs, with the leaves on screen at any time drawn from them. Each tap of a pair is sent with the round,
  and the server marks it. Answers are recorded with `recordMathsAnswers`. A pair counts as one `bond10` fact, right or
  wrong.
- To be decided in Stage 1, after reading `makeFocusPack`: whether a "pick two leaves" go maps cleanly onto its question
  shape. It may need a small addition in `shared/maths`. Section 9 asks about this.

## 4. Rules as pure functions (`shared/beanstalk/`)

- `round.ts`: given a seed and the focus, gives the 10 pairs and the order the leaves float in. The same seed always
  gives the same round.
- `play.ts`: given a round and the taps, gives the pairs made, the mistakes, and whether the round is done.
- `progress.ts`: given the days completed, gives each leaf's colour, the dots level and the egg count. Day 30 means an
  egg, and the 31st day starts the next friend.

## 5. Server, tables, switches

- **Tables:**
  - `beanstalk_progress`: one row per child. It holds the days completed, the last NZ day a leaf changed, the eggs, and
    the current friend.
  - `beanstalk_rounds`: the server-made rounds, each claimed once.
- **Function** `supabase/functions/beanstalk/` has three calls:
  - `start`: makes or returns today's round.
  - `finish`: replays the taps, marks them, records facts, and changes a leaf if it's the first finish today.
  - `state`: returns the leaf colours and eggs.
- **Switches:** a code switch `BEANSTALK_ON`, plus the per-class teacher switch `beanstalk_enabled`, which is off by
  default. A teacher turns it on for junior classes (James, 4 Nov). The teacher can also turn the dots off with
  `beanstalk_dots`.
- **Load:** about 3 requests per child per lesson (state, start, finish). For a class of 25 that is about 75.
- Group `easy-maths` in the registry. Points and achievements: section 9 asks.

## 6. Art (ComfyUI on the gaming PC, `scripts/beanstalk-art.py`)

**Style B, clay** (James, 4 Nov). Metal leaves must look vivid and shiny, the friend on top is a kiwi, and everything has
a New Zealand look: a farmhouse with a red roof, a pōhutukawa, silver ferns, sheep and a snowy mountain.

The set:
- 4 leaf colours
- 5 kiwi poses
- 4 Jack poses
- the Golden Egg (on its own and on a cushion)
- the stalk tile and the stalk top
- 3 stacked backgrounds: farm, open sky, top of the cloud
- the home card
- small extras

Tries go to `~/dragon-art-inbox/beanstalk-art/`. The kiwi's long beak is hit and miss in clay, so there are extra tries.
Still to paint later: the other NZ friends for later beanstalks.

## 7. Shared files touched (at the end, one line each)

`src/games/registry.ts` and its test, `hub_games` registration, and the teacher settings list. Possibly `shared/maths`,
as its own small branch (section 3).

## 8. Stages

1. **Rules.** `shared/beanstalk/` and its tests.
2. **Play screen.** Floating leaves, the stalk growing, the dots, local only.
3. **Server.** Migration, function, maths recording, and the day rule.
4. **Progress screen.** The leaves changing colour, the egg moment, the shelf, the next friend, and the guided first go.
5. **Teacher switch and dots setting.** Preview for James.
6. **Go live**, one step at a time.

## 9. Questions for James (recommended answer first)

1. Words read aloud with the device's voice? Recommended: yes, with a mute button. Most 5 year olds can't read
   instructions.
2. Hub points and achievements? Recommended: no points, because the Golden Egg is the reward. One achievement per egg.
3. A wrong pair: just wobble back (recommended), or show the right partner after two misses?
4. If `makeFocusPack` can't make "pick two leaves" questions as it stands: a small separate `shared/maths` branch
   (recommended), or make the pairs in the game from `bond10` facts only?
5. Name on the home card: "Bond Builder", or "Kiwi's Beanstalk"?
