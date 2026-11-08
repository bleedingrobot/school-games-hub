# S14: A lucky guess is not a quick answer

**Game:** All twelve (the newer five first: Pigeon, Parrot, Lizard, Swamp Hen, Robin). Quick looks is left out on purpose (see section 3).
**What's wrong:** There is no minimum think time. A right first tap 9 to 82 milliseconds after the question counts as "quick", moves the fact up a box and fades the help.
**What done looks like:** A right answer faster than 600 ms is still saved as a right answer, with its time, but it never counts as quick: the fact's box does not move up, no "quick day" is added, and the answer does not count towards a good round. Answers at 600 ms or more work as they do today.
**Size:** S
**Impact on learning:** High
**Waits for:** nothing

The rule goes in one shared place, so each of the older games gets it by calling the same function (nothing about it is game-specific).

## 1. The problem

- The quick test is one comparison and has no lower limit: `if (ms > quickMs) return next;` in `shared/maths/leitner.ts:59`, and, in the database where the real records are kept, `elsif a.ms <= quick_ms then` in `supabase/migrations/20261017001200_fact_answers.sql:75`. Everything not slower than `quickMs` is quick, including 0 ms.
- Juniors get a 10 second ceiling (`JUNIOR_QUICK_MS = 10_000`, `shared/juniorQuick.ts:6`) and nothing else. A search of `shared/kit/replay.ts` and `shared/juniorQuick.ts` for any minimum finds none.
- The Weka evaluator saw answers of 9 to 82 ms in a random-tapping round count as quick; three facts logged as right and quick (`docs/reviews/maths-review-2/games/weka.md:48, 122`). Two quick days or two quick boxes move a fact up (`shared/maths/leitner.ts:54-65`) and fade its help (`shared/kit/help.ts:41-48`), and level moves use the fact's box (`STEP_SECURE_SHARE`, see weka.md:21).
- The same time reaches the "good round" count, which fades help for the whole child: `firstRight++` on a right first tap with no time test, in `shared/kit/replay.ts:52-53`, `shared/pigeon/play.ts:54-55`, `shared/lizard/play.ts:55-56` and `shared/tui/play.ts:44-45`. Pigeon, Lizard and Swamp Hen use it for `placeAfter(before, played.firstRight)` (`shared/pigeon/server.ts:156`, `shared/lizard/server.ts:156`, `shared/swamphen/server.ts:156`); Robin and Parrot through `moved(before, played.firstRight)` (`shared/robin/server.ts:167`, `shared/parrot/server.ts:168`).
- Where the quick time is applied now (this is the full list to change):
  - The saved records: `recordMathsAnswers` passes `quick_ms` to the database function `record_fact_answers` (`supabase/functions/_shared/recordAnswers.ts:38-52`). Eleven games pass `JUNIOR_QUICK_MS`: `supabase/functions/{beanstalk,hop,korora,lizard,parrot,pigeon,pipi,robin,swamphen,weka,tui}/entry.ts`.
  - The preview and server copies that work out the records the same way (`withAnswers`): `shared/hop/server.ts:100-104`, `shared/pipi/server.ts:102-106`, `shared/weka/server.ts:107-111`, `shared/korora/server.ts:105-109`, and `memoryServices.ts` in pigeon, parrot, lizard, swamphen, robin, tui (line 99-103).
  - The "good round" count in the kit and in the three own copies named above.
- What time is measured: the clock starts when the question is shown and restarts when the voice ends if the child has not tapped yet (`src/games/robin/Goes.tsx:128-133`, same pattern in the other four). Only the first tap of a go counts (`shared/kit/replay.ts:52-55`). The server accepts any whole number of milliseconds from 0 up to 600,000 (`MAX_TAP_MS`, `shared/robin/server.ts:88`, `shared/pigeon/server.ts:77`).

## 2. The rule behind it

LEARNING-DESIGN rule 1 (guessing must not work), rule 5 (help fades only on steady success) and rule 8 (fair timing: the clock starts after the voice; speed is for later). Rule 8 is about not hurrying careful children; this card is the other side of it: a floor under the clock, so a stab is never mistaken for fluency.

## 3. The change

**The floor: `JUNIOR_MIN_THINK_MS = 600`.** Decision and why:
- Fast enough to leave every real answer alone: for a child aged 5 to 8 to read the choices, decide and move a finger takes well over half a second. A known fact such as 5 + 5 can be seen at once but still needs the tap.
- Slow enough to catch every case the evaluator saw (9 to 82 ms) and button-mashing (under about 400 ms).
- The ceiling is 10 seconds, so the quick window stays wide: 0.6 to 10 s.
- It is measured by the clock the games already have (from the end of the voice), so it means "600 ms after the voice ends" when the child waited for the voice. A child who taps during the voice is timed from the start of the go (the existing behaviour), so a tap during a voice shorter than 600 ms is also caught. A tap later in a long voice is not caught by this card. That is a known limit; if James wants it closed, the follow-up is a small change in each game to send the time since the voice ended (the clock restart is at `src/games/robin/Goes.tsx:128-133`). Say so in the PR.
- Easy to change: one constant.

**What the floor does:** a correct first tap under 600 ms is a normal answer in every way (attempts, correct, time) **except** it is not quick: the box stays where it is, and no quick day is added. It never lowers a box (a slow right answer does not either). It is not counted in a good round (`firstRight`). A wrong answer is unchanged.

**One place for the rule (decide: `shared/juniorQuick.ts`, no change to `shared/maths/leitner.ts`):**
1. In `shared/juniorQuick.ts` add `export const JUNIOR_MIN_THINK_MS = 600;`, and `export const thoughtOf = (ms: number) => ms >= JUNIOR_MIN_THINK_MS;` (true when the answer had time to be a thought), and
   `export function juniorAfterAnswer(stats, correct, ms, at)` which calls `afterAnswer(stats, correct, ms, at, thoughtOf(ms) ? JUNIOR_QUICK_MS : -1)`. A quick time of -1 can never be met (`ms > quickMs` is always true, `shared/maths/leitner.ts:59`), so the answer is counted but never quick. This keeps `shared/maths/leitner.ts` untouched, so no other game's function goes out of date.
2. Replace `afterAnswer(..., quick)` in every `withAnswers` listed in section 1 with `juniorAfterAnswer(...)`, and drop the local `const quick = JUNIOR_QUICK_MS;`.
3. In `shared/kit/replay.ts` add an optional rule `minThinkMs?: number` to `ReplayRules`; `if (right && (rules.minThinkMs === undefined || ms >= rules.minThinkMs)) firstRight++;`. Pass `minThinkMs: JUNIOR_MIN_THINK_MS` from `shared/weka/play.ts:20`, `shared/parrot/play.ts:16`, `shared/swamphen/play.ts:40`, `shared/robin/play.ts:16`. In the three own copies (`shared/pigeon/play.ts:55`, `shared/lizard/play.ts:56`, `shared/tui/play.ts:45`) use `thoughtOf(ms)` in the same place. The `answers` list is **not** changed: the records still get every answer.
4. The database (the real records): new migration that adds `min_ms integer default 0` as the last argument of `record_fact_answers` and changes `elsif a.ms <= quick_ms then` to `elsif a.ms >= min_ms and a.ms <= quick_ms then`. Postgres needs the old seven-argument function dropped first (`drop function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer);`), then the new one created and given the same revoke and grant as the original (`supabase/migrations/20261017001200_fact_answers.sql:93-97`). The default of 0 keeps every other game exactly as it is, and the functions already deployed (which send seven arguments) keep working in the gap between the migration and the new functions.
5. `supabase/functions/_shared/recordAnswers.ts`: add a last optional parameter `minMs?: number` after `quickMs` and send `min_ms: minMs ?? 0` in the rpc call (line 52). Each of the eleven `entry.ts` files passes `JUNIOR_MIN_THINK_MS` after `JUNIOR_QUICK_MS`. Rebuild the eleven functions.

**Not covered, and why:** Quick looks. Its answers are meant to be fast (it flashes a picture for under a second); its stages move on right or wrong, not time (`progressFrom`, `shared/subitising/engine.ts:62-88`), and the only time it reads is "thinking longer than 4 s means struggling" (`shared/subitising/engine.ts:94-98`). A floor would unfairly mark real glances. A lucky guess on its placement is a separate problem (DECISIONS section 4, `docs/reviews/maths-review-2/DECISIONS.md:48`). Quick looks also has no `afterAnswer` call.

**Beanstalk** saves through `recordMathsAnswers` (`supabase/functions/beanstalk/entry.ts:65`), so the database change covers its records. Its per-child fade counts "right" in `shared/beanstalk/progress.ts:103`; the session must search `shared/beanstalk/` for where `right` is counted from the replay and apply `thoughtOf(ms)` there.

**Child-facing words:** none. A child never sees this.

**Hop, Penguin Pairs, Pipi, Tūī, Weka** are done in the same PR (they only need the `withAnswers` swap and, for Weka and Tūī, the `play.ts` line). The newer five come first in the PR description.

## 4. Files affected

- Shared (own branch; this card changes shared code): `shared/juniorQuick.ts`, `shared/juniorQuick.test.ts`, `shared/kit/replay.ts`, `shared/kit/kit.test.ts`.
- Per game (the same one-line edits): `shared/{hop,pipi,weka,korora}/server.ts`; `shared/{pigeon,parrot,lizard,swamphen,robin,tui}/memoryServices.ts`; `shared/{weka,parrot,swamphen,robin}/play.ts`; `shared/{pigeon,lizard,tui}/play.ts`; `shared/beanstalk/progress.ts` (or wherever `right` is counted).
- `supabase/functions/_shared/recordAnswers.ts` and the eleven `supabase/functions/<game>/entry.ts`.
- New migration `supabase/migrations/<next>_fact_answers_min_ms.sql`; pgTAP `supabase/tests/database/fact_answers_min_ms.test.sql`.
- All eleven `index.ts` files rebuilt: `npm run build:functions` (kit and shared change, so every function that bundles them is out of date; check each "index.ts is up to date" test).
- Own branch `kit-think-floor` from origin/main (a shared and kit change, so not a game branch). Tell James it touches `shared/kit` and the migration goes live on merge.

## 5. Database / migration needs

One new migration (next free number: run `git fetch` then `node scripts/migration-numbers.mjs`; at the time of writing it was `20261108000300`, which S11 may also want, so check). It re-creates `record_fact_answers` with a new last argument `min_ms integer default 0`; no table changes; no old rows change (boxes already saved stay as they are). Applied by the merge pipeline. Test on a scratch copy (`scripts/scratch-db.sh thinkfloor` then `scripts/scratch-test.sh thinkfloor supabase/tests/database/fact_answers_min_ms.test.sql`; never `supabase db reset`). `supabase/tests/database/clans_rewards.test.sql:302-308` already calls the function with seven arguments, so it must still pass unchanged.

## 6. Test steps

Three tests:
1. `shared/juniorQuick.test.ts`: a right answer at 9 ms leaves box 1 as 1 and adds no quick day; at 700 ms it moves to box 2; a wrong answer at 9 ms still drops to box 1; attempts, correct and the time are saved for all three.
2. `shared/kit/kit.test.ts`: `replayTaps` with `minThinkMs: 600` leaves `firstRight` at 0 for a right tap at 80 ms and 1 at 700 ms; `answers` has both.
3. pgTAP: `record_fact_answers` with `min_ms = 600`: a right answer at 50 ms leaves the box; at 700 ms moves it; the old seven-argument call still moves a fast answer (default 0).

By playing a preview (Weka and Robin): tap the first card instantly on every go (preview hand-tapping fast, or a script): the facts do not move up and the help does not fade; then answer at a normal pace: it moves up as before.

## 7. Size and impact

S: one constant, one wrapper, one-line swaps in about ten places, one small migration. High: every fading and step-up decision in all the Foundational games rests on "right and quick", and today a stab qualifies.

## 8. Session prompt (ready to paste)

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md (section 3, shared files, and the go-live steps), docs/LEARNING-DESIGN.md (rules 1, 5 and 8) and docs/plans/maths-review-2/S14-lucky-guess-not-quick.md. Create branch `kit-think-floor` from origin/main in a new worktree (this is a shared and kit change, not a game branch).
Steps: (1) shared/juniorQuick.ts: add JUNIOR_MIN_THINK_MS = 600, thoughtOf(ms) and juniorAfterAnswer(stats, correct, ms, at) that calls afterAnswer with quick time -1 when the answer is under the floor (do not change shared/maths/leitner.ts). (2) Replace afterAnswer(..., quick) in every withAnswers (shared/hop, pipi, weka, korora server.ts; shared/pigeon, parrot, lizard, swamphen, robin, tui memoryServices.ts). (3) shared/kit/replay.ts: optional minThinkMs rule so a right first tap under it is not counted in firstRight; pass it from shared/weka/play.ts, parrot/play.ts, swamphen/play.ts, robin/play.ts; use thoughtOf in the own copies shared/pigeon/play.ts, lizard/play.ts, tui/play.ts; check shared/beanstalk/progress.ts and its server for where right is counted and apply the same. (4) New migration (git fetch; node scripts/migration-numbers.mjs for the number) that drops the seven-argument record_fact_answers and creates it again with a last argument min_ms integer default 0 and the test a.ms >= min_ms and a.ms <= quick_ms, with the same revoke and grant as supabase/migrations/20261017001200_fact_answers.sql. (5) supabase/functions/_shared/recordAnswers.ts: optional minMs, sent as min_ms (default 0); each of the eleven entry.ts files that pass JUNIOR_QUICK_MS also passes JUNIOR_MIN_THINK_MS. (6) npm run build:functions (all affected); check every "index.ts is up to date" test.
Leave Quick looks alone (the plan says why). Three tests only (juniorQuick.test.ts, kit.test.ts, one pgTAP file run on a scratch copy; drop it after). Typecheck, test:changed, build. In the PR, say in one line that a tap during a long voice is timed from the start of the go and is not caught (known limit). Stop and tell James before any live step (the migration goes live on merge). Open a PR when done.
```
