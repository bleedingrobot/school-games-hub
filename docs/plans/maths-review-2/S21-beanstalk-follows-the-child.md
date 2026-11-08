# S21: Beanstalk: the next sum follows the child, not the calendar

**Game:** Kiwi's Beanstalk
**What's wrong:** Which sum a child gets (10, 20, 100, 1000) is set by how many Golden Eggs they have won. That is a calendar. A child who is not secure on bonds to 10 still moves on after 30 days. A child who is flying has to wait.
**What done looks like:** A child stays on bonds to 10 until they are steady (two good days and the facts secure), then moves up. After two hard days they step back. About 2 pairs in 10 are older sums, and the weakest pairs come up most.
**Size:** L
**Impact on learning:** Very high
**Waits for:** nothing

## 1. The problem

- The sum comes from the egg count: `targetFor = (eggs) => TARGETS[eggs % TARGETS.length]` (`shared/beanstalk/progress.ts:20`). `TARGETS = [10, 20, 100, 1000]` (`shared/beanstalk/round.ts:26`). One egg is 30 days (`DAYS_PER_EGG = 30`, `progress.ts:13`).
- The server uses the same calendar: `finish` replays `makeRound(seed, stalkAfter(s.daysDone).target)` (`shared/beanstalk/server.ts:158`). The browser does too (`src/games/beanstalk/BeanstalkGame.tsx:146-149`; `src/games/beanstalk/Round.tsx:68`).
- After the 4th beanstalk it goes round to 10 again, so a child can fall from 1000 back to 10 by the calendar.
- Every round is one target only. There are no older sums mixed in. `makeRound(seed, target)` (`shared/beanstalk/round.ts:55-73`) uses the same pool of pairs 1 to 5 (plus 1 to 4 again, plus one more of 1 to 4), so the weakest pairs do not come up more.
- The dots help already follows the child (`placeAfter`, `progress.ts:83-105`). The sum does not.
- The teacher about text says the beanstalks go "round again" (`src/games/beanstalk/teacher.ts:45`). That will be untrue after this change.

## 2. The rule behind it

- Rule 5: help follows the child, not the calendar. The calendar is for rewards only. The egg stays a reward.
- Rule 6: move up on steady success, step back after a hard patch, and mix old facts in.
- Rule 9: the saved records must say what the child really did (which stage, how many good days).

## 3. The change

Build this in three parts, one after the other.

### Stage state (saved)

1. Add a saved `stage` (0 to 3, an index into `TARGETS`), plus `good_days` and `hard_days` (small counts). Follow the Hop `reached` pattern (`shared/hop/server.ts:151-166`, migration `20261107000600_hop_longer_ladder.sql`).
2. Back-fill every existing child: `stage = eggs % 4` so nobody moves today. Set the count of days on the stage to a non-zero number so the "new beanstalk" bridge line does not show (`BeanstalkGame.tsx:51-52` only shows it when eggs > 0, day is 0 and target > 10).
3. On the first finish of the NZ day only (`finishChallenge`, `progress.ts:76-80`):
   - If 8 or more of 10 pairs were right at the first tap, add 1 to `good_days` and set `hard_days` to 0.
   - If 4 or fewer were right, add 1 to `hard_days` and set `good_days` to 0.
   - Otherwise both go to 0. A repeat the same day changes nothing (see S24 for the same rule in other games).
4. Move up one stage when `good_days >= 2` and the sum is secure. Secure means 70% of that stage's fact keys are in box 2 or more (`sumSecure` in `src/games/beanstalk/signpost.ts`, `SECURE_SHARE` 0.7, uses `factKeys(target)` from `round.ts:105-106`). For stage 100 and stage 1000 there is one fact key each (`bondKey`, `round.ts:93-102`), so use that key at box 2 or more. Weight the pairs with the bond10 record (decision below).
5. Step back one stage when `hard_days >= 2`. Never below stage 0. Top is 1000. It does not go round to 10.
6. When the stage changes: dots help resets to full for the new sum (as the egg change does now, `progress.ts:83-105`). Reset `good_days` and `hard_days` to 0.
7. The egg stays calendar-only. `stalkAfter` keeps counting eggs and friends. It no longer picks the target. Add `stageTarget(progress)`.

### The round

1. Each pair is used once. The spare slots go to the weakest pairs (lowest box, then least recently seen). A pair may appear at most 3 times. 5 + 5 at most once.
2. About 2 pairs of 10 are older-stage pairs, chosen least recently seen, then weakest. On stage 0 there are none.
3. Give each pair its own target (`pairTargets`). The tray holds one target at a time (`letIn`, `round.ts:156-174`). Put the older pairs last as a short second tray. The badge (`Round.tsx:258-269`) and the spoken line change when the target changes: "Now these make 10."
4. For 100 and 1000 the fact has one key. Use the bond10 record to pick which pair is weakest. Say so in a code comment. Splitting the key lives in `shared/maths` and needs its own branch (not in this plan).

### Server

1. Store the round at start in `beanstalk_rounds.round` (jsonb), as Hop does. On `finish`, replay `kept.round`. For rounds already open when this ships, fall back to `makeRound(seed, stalkAfter(daysDone).target)` (`server.ts:158`).
2. Add a `facts` service to the handler, from the `space_maths_context` RPC, as in `supabase/functions/hop/entry.ts:57-60`. Add it to `memoryServices` for the preview. Today there is none (`server.ts:111-185`).
3. `replay` (`round.ts:187-223`) must read the per-pair target so right means leaf a + leaf b = that pair's target.
4. Run `npm run build:functions`. `supabase/functions/beanstalk/index.ts` is generated.

### Browser

1. `BeanstalkGame.tsx:146-149` and `Round.tsx:68` read the saved stage, and the round that the server sent, not `stalkAfter`.
2. Finish card and signpost (`BeanstalkGame.tsx:225-278`): when a child moves up or back, say so in one short line, with voice. No score.
3. Teacher line: change `src/games/beanstalk/teacher.ts:29` and the about text (`teacher.ts:45`) to say the sum follows the child. Teacher view of the stage is S23.

Kit parts used: `shared/kit/help.ts` (`ROUND_OF_TEN`, `STRUGGLE_GOES`), `shared/kit/replay.ts`, `src/kit` `WhatsNext` for the line.

Note on S22: S22 also edits `Round.tsx` and `round.ts` (the missing-leaf goes). Do S21 first, or merge S22 onto it, so they do not clash.

## 4. Files affected

- `shared/beanstalk/progress.ts`, `round.ts`, `server.ts`, tests in `shared/beanstalk/`.
- `supabase/functions/beanstalk/entry.ts`, `handler.ts`, `index.ts` (generated), `handler.test.ts`.
- `src/games/beanstalk/BeanstalkGame.tsx`, `Round.tsx`, `signpost.ts`, `teacher.ts`.
- No shared or kit file changes. Do not touch `shared/maths`.

## 5. Database / migration needs

One new migration, numbered after the latest (`node scripts/migration-numbers.mjs`; the latest at the time of writing is `20261108000200_tui_tenless_hardest.sql`). It adds `stage`, `good_days`, `hard_days` (smallint, with defaults) to `beanstalk_progress`, back-fills `stage` from the egg count, and adds `round jsonb` to `beanstalk_rounds`. `beanstalk_finish` takes the new arguments last with a null default, so the old deployed function still works (as in `20261107000300_beanstalk_help.sql`). James applies it by hand at go-live.

## 6. Test steps

Automated (6 tests):
1. Two good first-finish days and secure facts move the stage up. Good days but not secure do not.
2. Two hard days step back. Never below stage 0. Top stays 1000.
3. A second finish on the same day changes nothing.
4. `makeRound`: each pair once, weakest get the extras, cap 3, about 2 older pairs, none on stage 0.
5. Server: `finish` replays the stored round, and the fallback works for an open round with no stored round.
6. Back-fill: a child with eggs = 2 starts on stage 2 and sees no bridge line.

By playing the preview: a new child stays on 10 for days; play two 9/10 days and see 20; make a wrong run twice and see it step back; hear the "now these make 10" line when the tray changes.

## 7. Size and impact

L: new saved state, a changed round, a stored round and a migration. Very high: this is the main way the game follows the child.

## 8. Session prompt (ready to paste)

### Part 1: Stage state and server

```text
Branch: create beanstalk-follows-child from origin/main (own worktree).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S21-beanstalk-follows-the-child.md first.
Do the "Stage state (saved)" and "Server" sections of the plan: new saved stage, good_days and hard_days; move up after two good days with the sum secure, step back after two hard days; the round stored at start; a facts service in entry.ts and memoryServices; the new migration (next free number, new arguments last with a null default). Egg stays calendar only. Never touch shared/maths, src/maths, src/styles.css or src/components.
Run npm run build:functions. Write tests 1, 2, 3, 5 and 6 from the plan (at most 8 tests for the game). Run the tests.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: The round and the browser

```text
Branch: continue on beanstalk-follows-child (Part 1 must be merged or on the branch).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S21-beanstalk-follows-the-child.md first.
Do "The round" and "Browser" in the plan: weighted pairs, about 2 older pairs last in a second tray with a per-pair target, the badge and voice line change, the finish line when the stage moves, and the teacher about text. Add test 4 from the plan. Check the preview by playing it. Run npm run build:functions.
Stop and tell James before any live step. Open a PR when done.
```
