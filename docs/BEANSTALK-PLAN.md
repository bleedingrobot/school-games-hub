# Kiwi's Beanstalk (Bond Builder) — plan

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

## 9. Decisions (James, 4 Nov)

1. Words are read aloud with the device's voice, with a mute button.
2. No hub points. The Golden Egg is the reward, plus one achievement per egg.
3. A wrong pair just wobbles back. There is no penalty and the answer isn't shown, because the dots are the help.
4. The home card name is **Kiwi's Beanstalk**.
5. Still open: if `makeFocusPack` can't make "pick two leaves" questions as it stands, it gets a small separate
   `shared/maths` branch (recommended), checked in Stage 1.

## Stage 1 results (4 Nov)

**What was built:** `shared/beanstalk/`:
- `round.ts` makes the day's 10 pairs from a seed. All five pairs come up and 5+5 only once. It also replays the taps.
  Six leaves float at once, and each pair made lets the next pair in. Any two leaves that make 10 count, and what is left
  can always still be paired.
- `progress.ts` works out the leaf colours, the dots level, the eggs and the friend, all from the count of finished days.
  `finishChallenge` gives one leaf per NZ day.

**Maths:** no change to `shared/maths` is needed. `makeFocusPack` can't promise 10 bond10 questions: it mixes in `add:`
facts and follows each child's own focus. So the server makes the round itself, then records plain `FactAnswer`s with
`recordMathsAnswers`, the way Mine does:
- A right pair is recorded as `bond10:a+b`.
- A wrong pair counts against the first leaf's pair, because that is the partner the child was after. It is never recorded
  as `add:` (decided 4 Nov).

**Tests:** 4 of the game's 8 are in `beanstalk.test.ts`:
- 200 seeds can be finished.
- How a wrong pair is marked.
- The leaf colours.
- The day rule.

`npm run typecheck` passes.

**Art:**
- Painted (style B, clay): the set, plus the friends for later beanstalks. Picks are in
  `docs/beanstalk-art/picks.json`. The tries are in `~/dragon-art-inbox/beanstalk-art/set/b/`.
- Drawn in code, because the clay model keeps adding blobs: the sparkle, the empty sky and the stalk tile.
- The bronze leaf is tinted from the silver leaf in the tidy step. Seven bronze tries all came out part matt clay, and
  tinting keeps the shape the same as the other leaves.
- The friends for later beanstalks are painted, waiting and cheering: tūī, kererū, wētā, ruru and takahē. The takahē
  reads as a generic blue bird, so it is weak. The painted sparkles on the cheer poses stay in.
- Still to do: a `tidy` step that turns the picked tries into small WebP files for the game, like Diamond Drop's.

**Next, Stage 2:** the play screen, local only.
