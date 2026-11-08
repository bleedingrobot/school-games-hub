# S34: Twelve games: save and show the kind of mistake (rule 9)

**Game:** Beanstalk, Hop, Penguin Pairs (korora), Pipi, Tūī, Weka, Quick looks, Pigeon, Parrot, Lizard, Swamp Hen, Robin
**What's wrong:** Most games know what kind of wrong answer a child chose (too many, one off, swapped digits) but never save it, and no teacher page shows it. Only Robin and Parrot save a "usual slip", and each misses some kinds. Beanstalk files all bonds to 100 under one key and all bonds to 1000 under one key, so the teacher cannot see which pair is hard.
**What done looks like:** Each child's page in every one of the twelve games says "usual slip: ..." in plain words once there is enough evidence, and says "no single slip stands out yet" otherwise. Beanstalk keeps one key per pair. Old saved keys and old rounds still work.
**Size:** M (four parts; each part is S to M)
**Impact on learning:** Med to High (the teacher learns what to teach, not just who is stuck)
**Waits for:** S17 (Part 4 only: the five newer games need the teacher view S17 adds). Parts 1 to 3 wait for nothing.

## 1. The problem

LEARNING-DESIGN rule 9 says to save the kind of wrong choice and show it to the teacher. What the code does now:

- **The kind is worked out in the game but thrown away.** Each game tags every wrong tap with a kind: Hop `HopMistake` (`shared/hop/round.ts:180`, `:204`), Weka `LandKind` (`shared/weka/round.ts:161`), Penguin Pairs `WrongKind` (`shared/korora/round.ts:148`), Pipi `WrongKind` (`shared/pipi/round.ts:131`), Tūī `TuiKind` (`shared/tui/round.ts:246`), Pigeon `Slip` (`shared/pigeon/round.ts:222`), Beanstalk `MistakeKind` (`shared/beanstalk/round.ts:145`). The server saves only the raw taps (`{pick, ms}`) in `<game>_rounds.taps`. The teacher pages for Hop, Penguin Pairs, Pipi, Tūī, Weka and Beanstalk (`src/pages/TeacherHop.tsx`, `TeacherKorora.tsx`, `TeacherPipi.tsx`, `TeacherTui.tsx`, `TeacherWeka.tsx`, `TeacherBeanstalk.tsx`) show days done, step reached and last played, and nothing about mistakes (`src/data/hop.ts:70-76` is the shape; the others match).
- **Robin and Parrot do save it.** `slipsOf(round, taps)` (`shared/robin/play.ts:20-36`, `shared/parrot/play.ts:20-36`) gives the kind of each go's first wrong tap (null when right). It is saved in a `slips jsonb` column (`20261108000100_robin.sql:46`, `20261107000500_parrot.sql:46`) and the teacher SQL returns the commonest kind of the last 10 finished challenges. The pages show it (`src/pages/TeacherRobin.tsx:58`, `:87`; `TeacherParrot.tsx:50`, `:79`). The gaps: the Parrot SQL only counts three kinds ('copy', 'total', 'all') and its word list has the same three (`TeacherParrot.tsx:41`), so the other Parrot kinds never show. Robin's word list leaves out 'near' (`TeacherRobin.tsx:46-49`).
- **Lizard and Swamp Hen work it out on the teacher's screen.** The teacher call returns the last three challenges with their taps (`recent`, `20261107001100_swamphen.sql:318`) and the page replays them (`shared/swamphen/teacher.ts`, `shared/swamphen/play.ts:41-53`, `shared/lizard/play.ts:27-69`, `shared/lizard/teacher.ts`; pages `src/pages/TeacherSwamphen.tsx:59-60`, `TeacherLizard.tsx:79-91`). This needs no new column and works on old rounds.
- **Pigeon shows distance only.** Its pupil page gives average distance off and a "squashed" line (`shared/pigeon/teacher.ts`), though every wrong carries a `Slip` kind.
- **Quick looks** saves the answer the child gave (`training_answers.given`, `shared/training/save.ts:30-35`, `:147`) under keys like `sub:<type>-<n>`, but the teacher sees only stage and per cent (`src/teacher/StudentPage.tsx` QuickLooksPanel from line 194; `src/teacher/foundational/FoundationalSkills.tsx:116-126`).
- **Beanstalk's keys are too coarse.** `bondKey` (`shared/beanstalk/round.ts:94-101`) gives `bond10:3+7` and `bond20:8+12` per pair, but for 100 and 1000 only `bond100:tens` and `bond1000:hundreds`. So 30 + 70 and 60 + 40 count as one fact (`:98-99`). `factKeys` (`:104-105`) and the "is this step secure" test (`src/games/beanstalk/signpost.ts`) use the same keys.

## 2. The rule behind it

LEARNING-DESIGN **rule 9**: record the evidence per question (key, right at the first tap, time, kind of wrong choice, help level) and show it to the teacher. The best example is already in Beanstalk: `mistakeKind` and `hasNearMiss` in `shared/beanstalk/round.ts`. The kit already has the shared pieces: `Wrong`, `tagWrongs`, `kindByUnits` and `hasNearMiss` in `shared/kit/mistakes.ts`.

## 3. The change

**One way for everyone: save the kind with the round; show the commonest.** Follow Robin and Parrot (a `slips jsonb` column and a teacher SQL line), because it is cheap on the teacher page and does not send every tap to the browser. Lizard and Swamp Hen keep their screen-side replay (it works on old rounds); they only get the shared word list and the "enough evidence" rule.

1. **A shared slip helper in the kit** (new file `shared/kit/slips.ts`, no game words in it): `slipsOf(goes, taps)` returns, per go, the kind of the first wrong tap or null; `topSlip(slips, min)` returns the commonest kind only if it was seen at least `min` times (suggest 3 in the last 10 challenges, the same idea as Swamp Hen's `SLIP_MIN`), else null. Each game's own `play.ts` gives it its goes and taps. The existing Robin and Parrot `slipsOf` become thin calls to it.
2. **Plain words per game** in each game's own `words.ts` (a `SLIP_WORDS` table, one short phrase per kind, e.g. Beanstalk `over`: "adds past the target", `under`: "stops short", `close`: "one away", `digit`: "mixes up the digits"; Hop `off1`: "lands one off"). The teacher page prints "Usual slip: <phrase>", or "No single slip stands out yet" when `topSlip` is null. Fix the gaps: every Parrot kind gets a phrase and is counted in the Parrot SQL; Robin gets 'near'.
3. **Save it in the finish.** Each older game's server builds the slips from the round and the taps at finish and writes them to a new `slips jsonb` column on `<game>_rounds` (Hop, Weka, Penguin Pairs, Pipi, Tūī, Beanstalk, Pigeon). `teacher_<game>_student` returns `slip` (commonest in the last 10 finished challenges). Old rounds have no slips; the page says "No single slip stands out yet" until new rounds come in. An optional one-off script may replay old rounds to fill them (not required).
4. **Quick looks:** no new column. At read time compare `given` with the key's answer and call the miss "too many", "too few" or "one away" (`src/teacher/StudentPage.tsx` QuickLooksPanel).
5. **Beanstalk: one key per pair.** `bondKey` returns `bond100:30+70` and `bond1000:300+700` (lower first, as `bond10:lo+hi` does). The fact-key format already allows it (`RECORD_KEY = /^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$/`, `shared/maths/skillPacks/generatedKit.ts:15`, same as the database check `gem_keep_facts_fact_key_check`), so the database needs no format change. **But** the hub only recognises the exact keys `bond100:tens` and so on as the bonds-to-100 skill (`isGeneratedKey`, `shared/maths/skillPacks/generated.ts:55`, used by `packIdOfKey`, `shared/maths/ladder.ts:311-321`; the keys are listed at `shared/maths/skillPacks/placeSkills.ts:11-12`, `:409-410`; Bond Match moves a child on from `bond100:tens`, `src/games/bond-match/suggest.ts:27-28`). A new key would be unknown there, and the skill map and Bond Match would stop seeing Beanstalk's work. So this part touches `shared/maths`, which a game branch must not change without James's OK. **Ask James before starting Part 1b.** Plan if James agrees: a small separate branch teaches `packIdOfKey` and the skill map that `bond100:<n>+<n>` and `bond1000:<n>+<n>` belong to the same skill as `bond100:tens` / `bond1000:hundreds`, and counts a child as secure when either the old key or the new pair keys say so.
   - **Old saved keys:** nothing is deleted or renamed. Old records under `bond100:tens` and `bond1000:hundreds` stay and still count for the skill map and Bond Match. New goes save under the pair key. Until a pair has its own record, Beanstalk's own "secure" test (`factKeys`, `signpost.ts`) also accepts the old key as evidence for that pair, so no child is sent back a step on the day of the change. Help per pair starts fresh (the first go on a pair is treated as new).
   - **Checks:** the Beanstalk tests (`shared/beanstalk/beanstalk.test.ts`) for the new key and the old-key fallback; `shared/maths` ladder and generated-pack tests (`ladder.test.tsx`, `generated.test.ts`) to show the new keys map to the right skill; the gem-keep save test to show the new key is accepted; and a read-only SQL check that no existing `bond100:*` / `bond1000:*` row is changed.

## 4. Files affected

- Kit (Part 1): new `shared/kit/slips.ts` and its test; `shared/kit/mistakes.ts` unchanged.
- Part 1b (Beanstalk keys): `shared/beanstalk/round.ts:94-105`, `src/games/beanstalk/signpost.ts`, `shared/beanstalk/server.ts`, and, with James's OK, `shared/maths/ladder.ts:311-321` and `shared/maths/skillPacks/generated.ts`.
- Part 2 (six older games): each game's `shared/<game>/play.ts` and `server.ts`, `src/games/<game>/words.ts`, `src/data/<game>.ts`, `src/pages/Teacher<Game>.tsx`, a new migration, and the rebuilt function bundle.
- Part 3: `src/teacher/StudentPage.tsx` and `src/data/foundational.ts`.
- Part 4: `shared/pigeon/*`, `shared/robin/play.ts`, `shared/parrot/play.ts`, the Parrot and Robin SQL, `src/pages/TeacherPigeon.tsx`, `TeacherParrot.tsx`, `TeacherRobin.tsx`, `TeacherLizard.tsx`, `TeacherSwamphen.tsx`.

## 5. Database / migration needs

- One new migration per part that adds a `slips jsonb` column (nullable, no default needed) to `<game>_rounds` and updates `teacher_<game>_student` to return `slip`. Take the number from `node scripts/migration-numbers.mjs` (was 20261108000300 when this was written). Old rows stay null. Nothing is deleted. The migration deploys on merge, then rebuild each game's function with `npm run build:functions -- <name>`.
- Part 1b: no schema change (the key format already allows pair keys).
- Quick looks: none.

## 6. Test steps

- Kit: `slipsOf` gives the kind of the first wrong tap and null for a right first tap; `topSlip` returns nothing under the minimum and the commonest kind at or over it.
- Each game (at most 8 tests): a round with known wrong taps saves the right kinds; a right first tap saves null; the teacher call returns the commonest kind.
- Parrot and Robin: every kind has a phrase in the word list (a test that loops over all kinds).
- Beanstalk keys: the old-key fallback, per-pair keys, and the checks listed in Part 1b.
- By hand as a teacher: play a round on purpose with the same wrong choice three times; the child's page says the matching phrase. A new child's page says no single slip stands out.

## 7. Size and impact

Size M. Impact Med to High: a teacher who can see "adds past the target" or "mixes up the digits" can fix the cause. Rule 9 becomes true for all twelve games.

## 8. Session prompt (ready to paste)

### Part 1: Kit slip helper and Beanstalk keys

```text
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 9) and docs/plans/maths-review-2/S34-save-and-show-mistake-kind.md.
Make a branch from origin/main called s34-kit-slips.
1. Add shared/kit/slips.ts with slipsOf(goes, taps) and topSlip(slips, min), plus tests. No game words in the kit.
2. Make shared/robin/play.ts and shared/parrot/play.ts call it. Keep their tests passing.
3. Run the kit and Robin and Parrot tests and npm run build.
Stop and tell James before any live step. Open a PR when done.
```

### Part 1b: Beanstalk keys for each pair

```text
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S34-save-and-show-mistake-kind.md (Part 1b).
STOP FIRST and ask James whether you may change shared/maths for the Beanstalk per-pair keys. Do nothing else until James says yes.
Make a branch from origin/main called s34-beanstalk-pair-keys.
1. Teach packIdOfKey and the skill map that bond100:<n>+<n> and bond1000:<n>+<n> belong to the same skill as bond100:tens and bond1000:hundreds. Old keys keep counting.
2. Change bondKey in shared/beanstalk/round.ts to give one key per pair, with the old key as a fallback in factKeys and signpost.ts.
3. Add tests: new key, old-key fallback, ladder and generated-pack mapping, gem-keep save. Do the read-only SQL check that no old row changes.
4. Run npm run build:functions -- beanstalk, the tests and npm run build.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: The six older games save and show the slip

```text
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 9) and docs/plans/maths-review-2/S34-save-and-show-mistake-kind.md. Part 1 (shared/kit/slips.ts) must be merged first.
Make a branch from origin/main called s34-older-slips.
1. For Hop, Weka, Penguin Pairs, Pipi, Tui and Beanstalk: add slips from slipsOf in each game's play.ts and server.ts finish; add a SLIP_WORDS table in words.ts.
2. One new migration (number from node scripts/migration-numbers.mjs): add slips jsonb to each <game>_rounds and return slip from each teacher_<game>_student.
3. Show "Usual slip: ..." or "No single slip stands out yet" on each Teacher<Game> page; extend each src/data/<game>.ts type.
4. Tests (max 8 per game), then npm run build:functions -- <name> for each game and npm run build.
Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Quick looks

```text
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 9) and docs/plans/maths-review-2/S34-save-and-show-mistake-kind.md (Part 3).
Make a branch from origin/main called s34-quick-looks-slip.
1. In src/teacher/StudentPage.tsx QuickLooksPanel, compare each wrong answer's given value with the key's answer and show "usual slip: too many / too few / one away", only when it was seen at least 3 times.
2. No new column. Add tests for the over, under and one-away calls and the "not enough yet" case.
3. Run the tests and npm run build.
Stop and tell James before any live step. Open a PR when done.
```

### Part 4: The five newer games, after S17

```text
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 9), docs/plans/maths-review-2/S34-save-and-show-mistake-kind.md and docs/plans/maths-review-2/S17-teacher-view-newer-five.md. S17 and Part 1 must be merged first.
Make a branch from origin/main called s34-newer-slips.
1. Pigeon: save slips (new migration, number from node scripts/migration-numbers.mjs) and show "Usual slip" on its pupil page next to the distance line.
2. Parrot: count and word every kind in the SQL and in SLIP_WORDS (TeacherParrot.tsx:41). Robin: add 'near' to SLIP_WORDS (TeacherRobin.tsx:46-49).
3. Lizard and Swamp Hen: use the shared word list and the "enough evidence" rule; keep the screen-side replay.
4. Show the slip line in S17's pupil view for all five. Tests (max 8 per game), npm run build:functions -- <name> for each, npm run build.
Stop and tell James before any live step. Open a PR when done.
```
