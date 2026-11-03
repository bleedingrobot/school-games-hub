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
- **Function** `supabase/functions/beanstalk/` has four calls (as built in Stage 3):
  - `load`: Jack or Jill, the finished days, today's NZ date and the class's dots setting.
  - `choose`: Jack or Jill.
  - `start`: makes today's round from a fresh seed.
  - `finish`: replays the taps, marks them, records facts, and changes a leaf if it's the first finish today.
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

## Stage 2 results (4 Nov)

**What was built:** `src/games/beanstalk/`, plus the preview `preview/beanstalk/` (run it with
`npx vite --config vite.beanstalk-preview.config.ts`):
- **Choose:** be Jack or Jill (James, 4 Nov). Jill was painted to match Jack, in four poses.
- **Home:**
  - The farm, with the CSS stalk and the 10 magic leaves in their colours.
  - The friend waiting on a cloud, and the child waving.
  - "Day N of 30", the Play button, and the shelf of eggs.
  - After an egg, the next friend is introduced.
- **Play:**
  - Six leaves float in a tray, each with its number and a ten-frame. The dots are full on bronze days, small on silver
    days and gone on gold days.
  - Tap two leaves. A right pair flies up, a pip lights up and the stalk grows. A wrong pair wobbles back.
  - Ten pairs reach the friend.
- **Finish:** the changed leaf sparkles, or "come back tomorrow". On day 30 the scene moves to the clouds: the friend with
  its egg, the child holding the egg, and the Golden Egg on its cushion.
- **Voice:** the game talks unless "Voice off" is pressed. That setting is the game's own (`beanstalk-voice`) and doesn't
  touch the hub's read-aloud setting. It never says a pair before the child taps it.
- **Sounds** follow the hub's sound setting: a tap, a hop for a right pair, a badge for a leaf and a win for the egg.
- **The trial backend** (`backend.ts`) runs the shared rules in the browser. Its preview tools are "pretend tomorrow",
  "jump to day N" and "start again".
- **Art:** `scripts/beanstalk-art.py tidy` turns the picks into WebP files, about 0.6 MB in all. The bronze leaf is
  tinted from the silver one.

**Tests:** 6 of 8:
- 4 rule tests.
- 1 accessibility test, read from the CSS: contrast, big targets and reduced motion.
- 1 test of the whole trial game: choose, one leaf a day, refusing an unfinished round, and the egg on day 30.

**Not yet:**
- The guided first go (a hand pointing at a pair).
- The server (Stage 3).
- The teacher switch.
- Checking every screen at phone size.

## Screen check and guided first go (4 Nov)

Checked every screen in the preview at Chromebook size (1366 x 640) and phone size (844 x 390). Fixed:
- **Jill showed as Jack.** The preview server was out of date; restarting it fixed it. Nothing was wrong in the game.
- **The leaf numbers and dots stuck out above the leaves** and covered the row of pips. The leaf's bottom padding was
  worked out from the whole tray's width. It is now worked out from the leaf, and the ten-frame dots are bigger.
- **Two stalks on the play screen.** The painted farm has its own sprout on a dirt mound, and the drawn stalk grew from
  the bottom edge beside it. The stalk now grows out of the painted sprout on every screen size. `Scene.tsx` measures the
  scene so the stalk, cloud, friend and child are placed from its real size.
- **The leaf that had just changed was hidden behind the child's head.** The child now stands clear of the stalk's
  leaves, and the stalk's leaves get smaller on a short stalk (a phone).
- **On a phone, "Voice off" covered the words** on the home and finish panels. On short screens the panel now starts
  under the voice button, with slightly smaller words.
- The floating leaves can shrink to 80 px on a phone (still big for small fingers; the test asks for at least 64).

**Guided first go:** on a child's very first challenge (no finished days yet, from the saved game, so it follows them to
any Chromebook) a big hand points at a leaf, and the leaf glows. Once they tap a leaf, the hand moves to its partner. It
follows what the child does, so it can never get stuck, and it goes after the first right pair. The voice says "Start with
the leaf the hand points to", then "Now tap the leaf the hand points to". It never says the numbers. The hand is an emoji
for now (👆); a painted one can replace it later.

## Stage 3 results (4 Nov)

**Migration** `20261104000300_beanstalk.sql` (the next free number on 4 Nov; check again at go-live):
- `beanstalk_progress`: one row a pupil. Jack or Jill, the count of finished days, the NZ day a leaf last changed, and a
  version, so two tabs can't both save.
- `beanstalk_rounds`: one row a challenge. Its seed, whether it's open, and once finished the taps and the wrong pairs. A
  seed is used once per pupil, a challenge finishes once, and finished ones over 30 days old go.
- Both tables have RLS on, no policy and no grant. Pupils can't read them or call the server's functions.
- `beanstalk_finish` only lets the count of finished days stay or go up by one.
- The switch `app_settings.beanstalk_enabled` (off to start) and `beanstalk_dots` (on to start), set by
  `teacher_set_beanstalk(enabled, dots, target_class)`. Either can be left out.
- No `hub_games` row, achievement or teacher lines yet: those are Stage 4's own migration.

**Function** `supabase/functions/beanstalk/` (`handler.ts`, `entry.ts`, the built `index.ts`), with its rules in
`shared/beanstalk/server.ts`, the same file the preview runs:
- `load` gives Jack or Jill, the finished days, the last leaf day, today's NZ date by the server's clock, and the class's
  dots setting.
- `choose` saves Jack or Jill.
- `start` makes a fresh seed and keeps it (any other open challenge closes). It refuses until Jack or Jill is chosen.
- `finish` checks the challenge is the pupil's and still open, makes the round again from the seed, and replays the taps.
  Anything odd is refused, and so is an unfinished challenge. The leaf comes from `finishChallenge` with the server's NZ
  date, never anything the browser sends. Each pair tapped is recorded with `recordMathsAnswers` as `bond10:a+b`, once per
  challenge (`beanstalk:<seed>`). A wrong pair counts against the first leaf's pair.
- Every call checks the teacher's switch first. Signed out gets 401, and over 30 requests a minute gets 429.
- Load: about 3 to 4 requests a child a lesson (load, choose once, start, finish).

**The preview** now runs the server's own rules (`shared/beanstalk/memoryServices.ts` stands in for the database), so the
preview and the real game can't drift apart. Preview tools add "The teacher lets the leaves show dots".
`src/data/beanstalk.ts` is the caller for the real server, ready for Stage 4.

**Tests:** 8 of 8.
- 4 rule tests, 2 screen tests.
- 2 server tests:
  - Only a pupil's own finished challenge counts, once, with each pair recorded as a bond to 10.
  - One leaf a NZ day by the server's clock, whatever the browser sends. This includes 1 am in New Zealand, which is still
    the day before in UTC.
- Plus the "index.ts is up to date" check.
- `supabase/tests/database/beanstalk.test.sql`: 25 checks pass on a scratch copy. The copy was the local database as it
  is plus this migration, because the local copy has Sky Isles applied without its history row. `game_hooks`, `diamond`
  and `mine` also still pass on that copy.

`npm run typecheck`, `npm run test:all` (354 files, 6,017 tests), `npm run build` and the preview build all pass (4 Nov).

**Still to do (Stage 4):**
- The teacher's switch and dots on the Games table.
- The achievement per egg and the `hub_games` row.
- The home card (art pick "card").
- The game's `index.tsx` and code switch.
- A How to play page.
