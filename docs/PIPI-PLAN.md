# Pipi's Hidden Shells (part-whole within 10) — plan

Short id `pipi`. **Status (4 Nov 2026): LIVE (all stages, painted art); shared maths LIVE first (PR #189), the game in PR #193..
Bella's voice clips recorded (`scripts/voice-clips.py pipi`; pipi is said "pee-pee").** Game A in `docs/EARLY-GAMES-PLAN.md`; the parts every early
game shares (30 counted days, fading help, way A, voice, guided first go, switches, stages) are in section 7 there and
aren't repeated here.

## 1. The game in plain words

A family of pipi live on a sandy beach. Each day the tide comes in, and some pipi dig down under the sand (or a shell
covers them). The child works out how many are hiding.

- **Today's challenge.** The child sees how many pipi there are altogether ("7 pipi"), shown as a big number and as
  pipi in a row. A wave washes over and some of them dig in. The ones still showing stay. The child taps how many are
  hiding (choices 0 to 10 on shells along the bottom). A right answer: the sand lifts and the hiding pipi pop up and wave.
  A wrong one wobbles back. About 10 goes.
- **The magic things.** 10 big shells along the high-tide line, bronze, silver then gold.
- **The win.** The Golden Pearl. Then a new friend's beach (a kororā chick, a tuatara and so on).

## 2. The maths

- **Skill:** composition, the part-whole idea. 7 is 4 and 3. NZ Year 1 (`MS.Y1.NUM.OP.P1` covers "facts to 10"); NCETM
  Mastering Number's "composition" strand. It sits under bonds to 10: once a child knows every way to split 10, Beanstalk
  is easy.
- **Levels (the child moves up when ready):**
  1. Wholes 3 to 5.
  2. Wholes 6 to 7.
  3. Wholes 8 to 10.
  Splits include 0 hiding and all hiding ("7 and 0") at a low rate, because "none" is a real answer.
- **Question kinds:**
  - **How many hiding?** 7 altogether, 4 showing → 3. (All days.)
  - **How many altogether?** 4 here, 3 popped up → 7. (Silver and gold, now and then.)
  - **Two tides** (gold only): the hiding ones come up and the others hide; "now how many hiding?" (the other part). This
    is the "if 4 and 3, then 3 and 4" idea.
- **Wrong choices:** one more and one less, the number showing, and the whole.

### Shared maths needed (its own small branch, live before the game)

- New family `part` in `shared/maths/skillPacks/earlyFacts.ts`. Key `part7:4` = 7 altogether, 4 showing, answer 3. Wholes
  3 to 10, showing 0 to the whole. 4 + 5 + … + 11 = 60 keys (all splits of 3 to 10). The question as parts:
  `["7", "=", "4", "+", "?"]` so other games can ask it too.
- New ladder skills `parts-5` (wholes 3 to 5) and `parts-10` (6 to 10), `stage: 'early-facts'`, `inWarmUp: false`, placed
  before `facts-10`. Curriculum tag `MS.Y1.NUM.OP.P1` (check the exact code).
- About 1 test (`earlyFacts` already has a test file that checks every family).

## 3. Rules (`shared/pipi/`)

- `round.ts`: `levelFor(records, reached)` (the first level under 70% secure), `makeRound(seed, records, { reached,
  colour })` gives 10 questions, weakest first, with the whole, the showing count, the kind and four choices.
- `play.ts`: replays the taps.
- `progress.ts`: copied from Hop.

## 4. Help that fades

- **Bronze:** the pipi sit in a five-frame (wholes to 5) or ten-frame, and the hiding ones leave an outline in the sand.
- **Silver:** the frame is gone and the outlines are faint.
- **Gold:** no outlines; the child only sees "7 altogether" and the ones still showing.

This is the bridge from Quick looks: the frame lets them see the missing part.

## 5. The look (open, James to choose)

The game needs a calm beach, a row of 10 slots, a wave that covers some, and a row of number shells for answers.
Three looks to choose from:

1. **Clay**, like Beanstalk: a soft clay beach and chunky pipi with faces. Matches the junior pair.
2. **Paper cut-out:** layered paper sand, dunes, waves and pōhutukawa, flat colours. Calm, very clear on a Chromebook.
3. **Watercolour picture book:** soft washes, outlined creatures. Gentle, a bit less bold for the numbers.

Pictures (any look): pipi (sit, dig, pop up, wave), the friend (wait, cheer, wave), a wave, the beach background (low
tide, high tide), 10 magic shells in 4 colours, the Golden Pearl (alone, on a cushion), a home card, small extras (sand
puff, sparkle). About 30 pictures.

## 6. Guided first go

The very first question is always 3 altogether with 2 showing. The hand points at the outline in the sand, then at the
right shell. The voice says "Three pipi. How many are hiding?"

## 7. Achievements

One per Golden Pearl, per friend: Pipi's, Kororā's, Tuatara's, Wētā's, Kiwi's, Tūī's (names checked in Stage 4).

## 8. Stages

0. This plan.
1. **Shared maths branch:** the `part` family and two ladder skills. Live on its own, first.
2. Rules in `shared/pipi/` and tests.
3. Play screen with stand-ins, preview.
4. Server: migration, function, records, day rule.
5. Hub, teacher settings (help on/off), guided first go, pearl moment.
6. Go live.

## 9. James's answers (4 Nov 2026)

1. Look: **paper cut-out** (layered paper sand, dunes, waves and pōhutukawa, flat colours).
2. Name: **Pipi's Hidden Shells**.
3. No teacher cap on small wholes: levels move up on their own.

Also: the game goes in the **Foundational skills** group at the top of the home page (not Easy maths); read-aloud in
**Bella's** voice (public/voice/pipi/lines.json, `scripts/voice-clips.py pipi`); James paints the art on the gaming PC
(`scripts/pipi-art.py`).

## 10. How it was built (notes for the next stages)

- **Shared maths:** families `parts5`/`parts10`, ladder skills `parts-5`/`parts-10` before facts-10 with `inWarmUp: false`
  and a new `inAuto: false` (beside the ladder: never a student's current skill or auto review, not counted, left out of
  the student's path card; a teacher can choose them as a focus).
- **Rules** (`shared/pipi/`): `round.ts` (`levelFor`, `makeRound`, `showGo`), `play.ts`, `progress.ts` (`beachAfter`,
  copied from Hop), `server.ts` (`handlePipi`: load/start/finish; saves `reached` level and `played` count, the guided go
  while `played` is 0), `memoryServices.ts`. Two tides records the split as it is after the swap; altogether records the
  same part key as the split shown. Four shells to choose from (not 0 to 10).
- **Play screen** (`src/games/pipi/`): `PipiGame`, `Goes` (the wave, the five-/ten-frame on bronze days, faint outlines on
  silver, no marks and the spots closing up on gold or with help off), `Beach`, `PipiArt` (paper stand-ins), trial
  backend in `backend.ts`, preview `preview/pipi`.
- **Server and hub** (stages 4 and 5): migration `20261104001400_pipi.sql` (tables `pipi_progress` and `pipi_rounds`,
  `pipi_load/start/round/finish`, switch `pipi_enabled` and help setting `pipi_help`, both on by default,
  `teacher_set_pipi`, hub hooks, six pearl achievements, teacher lines), function `supabase/functions/pipi`,
  `src/data/pipi.ts`, game card in Foundational skills (`src/games/pipi/index.tsx`, switch `PIPI_ON`), teacher drawer
  and student line in `src/pages/TeacherPipi.tsx`. DB tests in `supabase/tests/database/pipi.test.sql`.

## 11. Old questions for James

1. Which look (section 5)?
2. Name: "Pipi's Hidden Shells", or something else ("Hide and Seek Pipi")?
3. Should a teacher be able to keep a child on small wholes (3 to 5) for longer?
