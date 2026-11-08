# S35: Tūī and Beanstalk: help per kind of go

**Game:** Tūī's Ten Tree (Part 1), Kiwi's Beanstalk (Part 2)
**What's wrong:** Both games keep one help level for the whole child. A child who is strong at "10 + 4" but new at "14 − 10" gets the same picture help for both, and one hard kind drags the strong kind back (or one easy kind hides a weak one). Tūī also has no "three wrong in a row gives full help for the rest of the round" rule.
**What done looks like:** Tūī keeps a help level for each of its four ways of asking, and Beanstalk keeps one for pair goes and one for missing-leaf goes. A new way or kind starts with full help while the old ones keep fading. A child who gets three goes in a row wrong at first tap sees full help for the rest of that round in both games.
**Size:** L
**Impact on learning:** Med
**Waits for:** S25 (how soon full help ends, the shared numbers) and S19 (the same help-per-kind change for the newer games, which fixes the saved shape and the kit helper names; if S19 is merged, copy its pattern, do not invent a second one)

S19 and S25 are not written yet. In plain words: S19 gives each kind of go in a newer game its own help level, saved next to the old child-wide level, with old children starting at their old level. S25 sets how quickly full help is allowed to go. This plan reuses both. If either changes a number below, the plan follows it.

## 1. The problem

How help is saved now:

- **Tūī.** One place per child in `tui_progress`: `step`, `level` (0 to 5), `good_in_row`, `good_at_step` (`supabase/migrations/20261106000100_tui.sql`). The browser never sends a level. The server replays the taps (`shared/tui/play.ts`) and moves the place once a day, on the day's first finish only (`shared/tui/server.ts:150-157`, calling `placeAfter`, `shared/tui/round.ts:99-120`). The level is saved with the round too (`l` on every go, `GoPlan {key, v, l}`, `round.ts:132-148`), so a replay shows the same picture.
- The level goes down one after two good rounds in a row (`GOOD_TO_FADE = 2`), up one after a hard round (`HARD = 4` or fewer right of 10), and a new step floors it at level 4 (`FRAMES_LEVEL`, `round.ts:21-42`). All of it counts the whole round. The way of asking (`v` 0 to 3: "10 + n", "n + 10", "10 + ? = 1n", "1n − 10") is not looked at. The evaluator saw six perfect days move level 5 to 4 (`games/tui.md`, Problem on the level being one slow dial).
- Step 5 mixes the four ways roughly 3, 3, 2, 2 (`waysFor`, `round.ts:188-196`), so a child new to "1n − 10" still gets the faded picture they earned on "10 + n".
- **No in-round rule in Tūī.** `grep` for `STRUGGLE` in `src/games/tui`, `shared/tui` and `supabase/functions/tui` finds nothing. `Goes.tsx:89-92` only brings more picture after a wrong tap on that go. LEARNING-DESIGN rule 4 asks for three wrong first taps in a row to give full help for the rest of the round (Weka, Penguin Pairs and Beanstalk already do it).
- **Beanstalk.** `beanstalk_progress` has `help` (0 full, 1 small, 2 none) and `good_in_row` per child (`supabase/migrations/20261107000300_beanstalk_help.sql`, from R6). `placeAfter` (`shared/beanstalk/progress.ts:100-105`) counts the whole round's right first taps (kit `fadeAfter`, `ROUND_OF_TEN`: good 8, hard 4, two good to fade), and a new egg (a new sum: 10, 20, 100, 1000) resets to full. The help is not saved with the round: the browser gets `help` from `load` and from the finish reply (`shared/beanstalk/server.ts:120, 165, 174`).
- A Beanstalk round has two kinds: 7 pair goes and 3 missing-leaf goes (the 4th, 7th and 10th: `MISSING_GOES = [3, 6, 9]`, `shared/beanstalk/round.ts:35`). They share one level. `replay` returns one `answers` entry per go in go order (`round.ts`, `replay`), so the kind of every answer is known by its place.
- Beanstalk already has the in-round rule: `Round.tsx` (about line 232) sets `boosted` after `STRUGGLE_GOES` (3) wrong first taps in a row (`wrongFirstRun`, `round.ts:176-181`), shows full dots for the rest of the round and says one line (`WORDS.dotsBack`). It is not saved.

## 2. The rule behind it

LEARNING-DESIGN rule 5 (help follows the child): help follows what the child can do on this kind of go, not one number for everything. Rule 4 (help arrives by itself): three wrong first taps in a row bring full help back for the rest of the round. DECISIONS section 7, pattern 6 names exactly these two games and wants the same change as the newer games (S19).

## 3. The change

### Part 1: Tūī, one help level per way

Use the same approach as S19: keep the old level as the headline, add a saved list per kind, and fade each kind with the kit's `fadeAfter`. No kit change is needed (`shared/kit/help.ts`: `fadeAfter(p, right, rules)` returns `{level, goodInRow, faded}`).

1. **Saved shape.** Add one nullable jsonb column on `tui_progress`: `way_help`, shaped `{"levels":[l0,l1,l2,l3],"goodInRow":[g0,g1,g2,g3]}`, index = the way `v`. Keep `level` and `good_in_row`. After every finish set `level` to the highest of the four ways' levels that the child has met (most help any way still gets). This keeps the teacher line and the Foundational views (`TeacherTui.tsx:46,70`, `20261107000100_foundational_teacher_views.sql:40-67`) working with no change to their SQL.
2. **Children already playing.** When `way_help` is null (every child on go-live), the game builds it from the old row: every way gets the old `level` and the old `good_in_row`. Nobody's picture jumps on go-live. The first finish after go-live writes `way_help`.
3. **New ways.** When the step passes (`goodAtStep` 2, unchanged) the ways that step brings in (`STEPS`, `round.ts:50-56`) are set to level 4 (`FRAMES_LEVEL`) with `goodInRow` 0. The ways already in play keep their level.
4. **Which level a go shows.** In `makeRound` each go gets `l = shownLevel(levels[way], help)` (`round.ts:74`). The saved round JSON also keeps `levels` so a replay matches. The guided first go stays at level 5. The teacher setting still wins: Fades uses these levels, Always on is level 4 for every go, Off is level 0 for every go.
5. **Moving a way's level.** After the day's first finish, count right first taps per way (`replay` gets a new per-way tally: right and total for each way). For a way with `g` goes in the round:
   - `g` under 2: leave that way alone (too few goes to tell).
   - Good round for the way: right at least `ceil(0.8 * g)`. Hard round: right at most `floor(0.4 * g)`. These give the same 8 of 10 and 4 of 10 as today when g is 10, 6 and 2 when g is 7, 3 and 1 when g is 3, and 2 and 0 when g is 2.
   - Run the kit `fadeAfter` per way with those scaled `good` and `hard`, `goodToFade: 2` (two good rounds in a row to drop one level), `topLevel: 5`. A hard round raises that way one level; it never drops a way below 0 or above 5.
   - S25 may change how soon full help ends. If it has, copy its numbers here.
6. **Step passing is unchanged.** The step still moves on the whole round (8 of 10 twice, `goodAtStep`), so the step logic and the flower arc are untouched.
7. **Once a day.** Levels move only on the day's first finish, as now (`server.ts:150-157`).
8. **In-round rule (new).** After 3 goes in a row (`STRUGGLE_GOES`) with a wrong first tap, show level 5 for the rest of that round (a wrong tap on the first go counts as one). It is not saved and does not move any level. A right first tap resets the run. The teacher setting Off turns it off, as in Weka and Penguin Pairs. Bella says once: "Here are the berries again to help." Add the line to `words.ts`, to `allVoiceLines` in `voiceLines.ts`, and make the clip with `scripts/voice-clips.py` (Kokoro af_bella) into `public/voice/tui/`.
9. **Words.** In `TeacherTui.tsx:12` change the Fades text to say help follows each way of asking. Line 70 says "help level N": keep it but say it is the highest of the four ways.
10. **Trial backend.** `shared/tui/memoryServices.ts` and `src/games/tui/backend.ts` keep `Saved` in the browser; give `Saved` the same `wayHelp` field (default null) so the preview matches.

### Part 2: Beanstalk, one help level per kind of go

Same approach as Part 1 and S19.

1. **Kinds.** `pair` (7 goes a round) and `missing` (3 goes a round). The sum (10, 20, 100, 1000) stays a separate matter: a new egg still resets both kinds to full help (`placeAfter`, `progress.ts`).
2. **Saved shape.** Add `help_missing smallint not null default 0 check (help_missing between 0 and 2)` and `good_in_row_missing smallint not null default 0` on `beanstalk_progress`. The existing `help` and `good_in_row` become the pair kind. No change to what they already mean for the teacher pages.
3. **Children already playing.** In the migration, backfill `help_missing = help` and `good_in_row_missing = good_in_row`, so nobody's dots jump. The new finish arguments end with a null default (as `20261107000300_beanstalk_help.sql` did) so the old deployed function still works until it is rebuilt.
4. **Moving a kind's level.** `replay.answers` is in go order, so go index 3, 6 and 9 are missing-leaf (use `isMissingGo`), the other seven are pairs. Run `fadeAfter` per kind:
   - Pair goes (7): good at 6 or more right first taps (that is `ceil(0.8 * 7)`), hard at 2 or fewer (`floor(0.4 * 7)`).
   - Missing-leaf goes (3): good at 3 of 3, hard at 1 or fewer.
   - Two good rounds in a row to drop one level (`goodToFade: 2`), `topLevel: 2`.
   - Only on the day's first finish and not on a replay (the existing "no change when `leafChanged` is null" rule stays).
5. **Showing it.** `Round.tsx` takes two dot settings (a prop each, from `BeanstalkGame.tsx:129,144` where `shownDots(state.help, state.dots)` is used). A pair go shows the pair dots; the missing-leaf go (`isMissingGo(after.pairsMade)`, with the leaf that is picked, `missing` state) shows its own. The teacher setting still forces dots off or on for both.
6. **In-round rule.** Already there (`Round.tsx` about line 232: `wrongFirstRun(after.answers) >= STRUGGLE_GOES`, then `boosted` makes every leaf `'full'`). Keep it as it is: three wrong first taps in a row of any kind give full dots for both kinds for the rest of the round. Do not save it. Do not add a second line.
7. **Teacher page.** `teacher_beanstalk_student` and `beanstalk_load` return `help` for the pair kind only; add the missing kind to `beanstalk_load` and the finish reply (`{...result, help, helpMissing}` at `server.ts:174`). The teacher line stays as it is (it shows `help`); add "missing leaf: dots N" only if there is room.

## 4. Files affected

**Part 1, Tūī (all on its own branch):**
- `shared/tui/round.ts` (constants, `Place`, `placeAfter` per way, `makeRound`, `GoPlan` and `Round` shape).
- `shared/tui/play.ts` (per-way tally in `replay`).
- `shared/tui/server.ts`, `shared/tui/memoryServices.ts`, `src/games/tui/backend.ts` (new `wayHelp` in `Saved`, `Progress`, finish reply).
- `src/games/tui/Goes.tsx` (in-round rule), `src/games/tui/words.ts`, `src/games/tui/voiceLines.ts`, `public/voice/tui/` (new clip), `src/pages/TeacherTui.tsx` (words).
- `supabase/functions/tui/entry.ts` (pass the new argument), a built copy under `supabase/functions/tui/` (run `npm run build:functions -- tui`).
- `shared/tui/tui.test.ts`, `supabase/tests/database/tui.test.sql`.
- Not touched: `shared/kit/help.ts` (no kit change needed), `shared/maths`, `src/maths`, `src/styles.css`, `src/components`.

**Part 2, Beanstalk (its own branch):**
- `shared/beanstalk/progress.ts` (two places, `placeAfter` per kind), `shared/beanstalk/server.ts` (finish and load), `src/games/beanstalk/Round.tsx`, `BeanstalkGame.tsx` (two dot settings), `src/data/beanstalk.ts` (type), `src/pages/TeacherBeanstalk.tsx` only if room is made for the missing kind.
- `supabase/functions/beanstalk/entry.ts` plus a built copy (`npm run build:functions -- beanstalk`).
- `shared/beanstalk/beanstalk.test.ts`.

## 5. Database / migration needs

Two new numbered migration files, one per game, each numbered after the latest in `supabase/migrations/` (latest today: `20261108000200_tui_tenless_hardest.sql`; run `git fetch` then `node scripts/migration-numbers.mjs` to pick the next free numbers, and re-check at merge time).

- **Tūī:** `alter table tui_progress add column way_help jsonb` (null). Drop and recreate `tui_finish` (now 12 arguments, add `way_help jsonb default null` at the end) and `tui_load` (return `wayHelp`). Keep `level` and `good_in_row` filled as the headline. Redo the revoke and grant for the exact new signature (the old ones are at `20261106000100_tui.sql:185-194`). Update `supabase/tests/database/tui.test.sql`. No change to `gem_keep_facts`.
- **Beanstalk:** add `help_missing` and `good_in_row_missing`, backfill from `help` and `good_in_row`, recreate `beanstalk_finish` (new trailing arguments default null, coalesced to the old values), `beanstalk_load` and, only if it changes, `teacher_beanstalk_student`. Redo revoke and grant. Same pattern as `20261107000300_beanstalk_help.sql`.
- Applying a migration to the live database by hand needs James's OK. Rebuild each function in the same PR (`npm run build:functions -- tui` and `-- beanstalk`).
- Old rounds still replay: the round JSON for Tūī keeps `l` per go, and a round saved before this change has no `levels`, which the code must treat as fine.

## 6. Test steps

Tūī (inside its 8-test limit; edit the existing tests, add few):
1. `placeAfter` per way: a way with a good round twice in a row drops one level; a hard round raises only that way; a way with fewer than 2 goes does not move.
2. `makeRound` shows each go at its way's level; a new step puts only the new ways at level 4.
3. A child with no `way_help` (old row) starts with every way at the old level and `goodInRow`.
4. The in-round rule: three wrong first taps in a row give level 5 for the rest of the round; a right first tap resets it; Off turns it off; nothing is saved.
5. The database test: `tui_finish` saves `way_help`, an old call without it still works.

Beanstalk (inside its 8-test limit):
6. `placeAfter` per kind with the 7 and 3 thresholds above; a new egg resets both to full.
7. Backfill: an old row shows the same dots for both kinds.
8. The database test: `beanstalk_finish` with and without the new arguments.

Play the preview ((each game's preview, see docs/GAME_DEVELOPMENT_GUIDE.md)):
- Tūī: reach Step 4 with the trial tool `setPlace`, get a good round on "10 + n" only, and check the next round shows fewer berries on "10 + n" and still every berry on the new way. Make three wrong first taps in a row and see full help and Bella's line, then right ones as normal. Use the teacher setting Off and Always on and check both still win.
- Beanstalk: play two good days of pairs and one hard day of missing leaves and check pair dots shrink while the missing-leaf go keeps its dots. Make three wrong first taps in a row and check both kinds show full dots for the rest of the round. Check at 375 px wide and with the voice on.

## 7. Size and impact

L: two games, two migrations, two function rebuilds, a new saved shape, and a new in-round rule with a voice clip for Tūī. Med: both games are already steady (DECISIONS calls Tūī one of the steadiest 3s), so the gain is a fairer, quicker fade for strong children and the right help for a new way.

## 8. Session prompt (ready to paste)

Run Part 1 first, then Part 2. They are separate branches and separate PRs.

### Part 1: Tūī, one help level per way

```text
You are changing Tūī's Ten Tree in the School Games Hub repo so help is kept for each way of asking, not one level for the whole child. Only start after plans S25 and S19 (help per kind in the newer games) are merged to main; copy their saved shape and names.
Create branch fix/tui-help-per-way from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 4 and 5) and docs/plans/maths-review-2/S35-help-per-kind-of-go-older-games.md (Part 1) first, then docs/reviews/maths-review-2/games/tui.md.

Steps (details in the plan, Part 1):
1. New migration (next free number after supabase/migrations/20261108000200_tui_tenless_hardest.sql; check with node scripts/migration-numbers.mjs): tui_progress.way_help jsonb null; recreate tui_finish and tui_load with the new trailing argument defaulting to null; redo revoke and grant for the exact signature; update supabase/tests/database/tui.test.sql.
2. shared/tui/play.ts: replay returns right and total per way.
3. shared/tui/round.ts: per-way levels and goodInRow; each go's l comes from its way's level; new step sets only the new ways to level 4; per-way placeAfter using kit fadeAfter with good = ceil(0.8*g), hard = floor(0.4*g), two good to fade, skip a way with under 2 goes; the headline level is the highest of the ways; step passing stays on the whole round.
4. shared/tui/server.ts, memoryServices.ts, src/games/tui/backend.ts and supabase/functions/tui/entry.ts: carry wayHelp; a null wayHelp is built from the old level and goodInRow for every way. Levels move only on the day's first finish.
5. src/games/tui/Goes.tsx: the in-round rule: three wrong first taps in a row show level 5 for the rest of the round, not saved, Off turns it off. Add Bella's line "Here are the berries again to help." to words.ts and voiceLines.ts, make the clip with scripts/voice-clips.py (af_bella) into public/voice/tui/.
6. src/pages/TeacherTui.tsx: update the Fades text and say line 70's number is the highest of the four ways.
7. Run npm run build:functions -- tui in the same PR.
Tests (stay within 8 for the game): per-way fade and hard; makeRound levels per way; old row with no way_help; the in-round rule; database test.
Do not touch shared/kit, shared/maths, src/maths, src/styles.css or src/components. Check in the preview at the levels in the plan and at 375 px wide. Run npm test, npx tsc --noEmit and lint.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Beanstalk, one help level per kind of go

```text
You are changing Kiwi's Beanstalk in the School Games Hub repo so help is kept for pair goes and missing-leaf goes separately. Only start after plans S25 and S19 are merged to main; copy their saved shape and names.
Create branch fix/beanstalk-help-per-kind from origin/main (own worktree, never commit to main, push by branch name).
Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rules 4 and 5) and docs/plans/maths-review-2/S35-help-per-kind-of-go-older-games.md (Part 2) first, then docs/reviews/maths-review-2/games/beanstalk.md.

Steps (details in the plan, Part 2):
1. New migration (next free number; check with node scripts/migration-numbers.mjs; copy the pattern of supabase/migrations/20261107000300_beanstalk_help.sql): add help_missing and good_in_row_missing to beanstalk_progress, backfill from help and good_in_row, recreate beanstalk_finish (new trailing args default null) and beanstalk_load, and teacher_beanstalk_student only if it changes; redo revoke and grant.
2. shared/beanstalk/progress.ts: a second place for the missing kind; placeAfter per kind with kit fadeAfter: pair goes (7) good at 6 or more, hard at 2 or fewer; missing-leaf goes (3) good at 3 of 3, hard at 1 or fewer; two good in a row to fade; a new egg resets both to full; no change on a replay.
3. shared/beanstalk/server.ts and supabase/functions/beanstalk/entry.ts: split replay.answers by go index (isMissingGo), load and finish carry helpMissing.
4. src/games/beanstalk/Round.tsx and BeanstalkGame.tsx: two dot settings; the missing-leaf go shows its own. Keep the existing in-round rule (wrongFirstRun >= STRUGGLE_GOES gives full dots to both kinds for the rest of the round). Teacher setting still wins.
5. Run npm run build:functions -- beanstalk in the same PR.
Tests (stay within 8 for the game): per-kind thresholds and egg reset; backfill; database test.
Do not touch shared/kit, shared/maths, src/maths, src/styles.css or src/components. Check in the preview and at 375 px wide. Run npm test, npx tsc --noEmit and lint.
Stop and tell James before any live step. Open a PR when done.
```
