# S19: Pigeon, Parrot, Lizard, Swamp Hen, Robin: help for each kind of go

**Game:** Pigeon, Parrot, Lizard, Swamp Hen, Robin
**What's wrong:** Each of these games keeps one help level for the whole child. A child who is strong on "read" goes but weak on "swap" goes gets the same help on both, so help is too much for one and too little for the other.
**What done looks like:** A child who does well on one kind of go sees less help on that kind next day, while a kind they found hard keeps its full help. Play two days in the preview and see the help differ by kind.
**Size:** L (a kit part, then five games, each with a migration)
**Impact on learning:** Med to High
**Waits for:** S13

## 1. The problem

- Pigeon, Parrot, Lizard, Swamp Hen and Robin keep one help level per child: `<game>_progress.level` (0 to 5, `smallint`), moved once a day by `placeAfter` (Pigeon `shared/pigeon/round.ts:104`, Lizard `:94`, Swamp Hen `:99`, Parrot through `STEP_RULES`, `shared/parrot/config.ts:13` and `shared/parrot/server.ts:35`, Robin its own copy, `shared/robin/progress.ts:46`). `makeRound` gives every go the same level through `shownLevel(level, help)` (for example `shared/pigeon/round.ts:196-216`). This is the "one level for the whole child" pattern (`docs/reviews/maths-review-2/DECISIONS.md`, pattern 6).
- Each game has several kinds of go that are not equally hard: Pigeon place, read, tens, near; Lizard build, read, bundle, swap, more; Swamp Hen plant, mat, turn, which, share, cut, short; Parrot miss, swap, both, sub, tf (`kindOfKey`, by key prefix eqmiss, eqswap, eqboth, eqsub, eqtf); Robin give, howmany, counton.
- The server already receives every go with its kind and whether it was right first time (the round's `goes[]`, each with `l`), so the information is there; it is only averaged away.
- Per fact does not fit: the help levels are picture steps and each fact is asked rarely, so one fact seldom gets two good rounds (the reason `helpForFact` in `shared/kit/help.ts` is used by Hop, Korora, Pipi and Weka but not here). A kind is asked several times a round, which is enough.

## 2. The rule behind it

Rule 5 (help fades with success): "per fact or per child where facts can't be told apart; fade after two good rounds, return after a hard round, and a new step starts with full help" (`docs/LEARNING-DESIGN.md:90-104`). A kind is the middle size: a group of goes that are alike. Rule 4 (keep each child in the right place) and rule 7 (mistakes teach) agree: a hard kind brings its help back, an easy kind loses it.

## 3. The change

Design (decided, do not re-decide):
- Keep a help level per kind: `kind_levels` in the progress row, `{ "<kind>": { "level": 0-5, "goodInRow": n } }`. The whole-child `level`, `placeAfter` and the step gate stay as they are.
- Kit rule: for each kind with at least 2 goes in the round, scale the goes right first time to ten (`Math.round(10 * right / n)`) and call the existing `fadeAfter(p, right, rules)` from `shared/kit/help.ts` with `ROUND_OF_TEN` (`{ good: 8, hard: 4, goodToFade: 2 }`, the kit help rule: 8 or more of ten twice in a row fades one level, 4 or fewer brings help back one level). A kind with fewer than 2 goes in the round is left unchanged.
- A kind not yet in the map starts at the child's whole-child `level` (which already has the new-step full help). No backfill is needed.
- In `makeRound`, each go's `l` comes from its kind's level: `shownLevel(kindLevel ?? level, help)`. The teacher's setting (fade, always, off) still applies through `shownLevel`. The guided first go stays at the top level (`TOP_LEVEL`).
- Moved once a day, on the first finish of the day, like the whole-child level.
- When the whole-child step changes, the kind map is cleared, so every kind starts at the new step's help (rule 5: a new step starts with full help). Added when the five games were built (10 Nov 2026).
- Rejected: per-fact help (above), and replacing the whole-child level (the step gate needs it).

Parts, in order: Part 1 (kit) first and merged, then Parts 2 to 6 (one per game, any order, each its own branch and PR). Wait for S13 before starting (Waits for).

### Part 1: Kit

1. Add to `shared/kit/help.ts` a function `fadeByKind(kindLevels, goes, rules)` where `goes` is a list of `{ kind: string, right: boolean }`. It returns a new kind map. No game words in it (kind is just a string).
2. Add one test file `shared/kit/help.test.ts` cases (inside the 8 limit): a kind with 2 goes and 2 right is scaled to 10 and counts as good; a kind with 1 go is unchanged; two good rounds fade one level; one hard round brings one level back; a missing kind starts from the given default.
3. Run `npm run build:functions` in the same PR (kit change).

### Part 2 to 6: per game (same pattern)

For each of the five games (Pigeon, Parrot, Lizard, Swamp Hen, Robin):
1. Migration `<next>_<game>_kind_levels.sql`: `alter table public.<game>_progress add column kind_levels jsonb not null default '{}'::jsonb check (jsonb_typeof(kind_levels) = 'object');`. Recreate `<game>_load` so its result has `kindLevels`. Drop and recreate `<game>_finish` with one more parameter (`kind_levels jsonb`) and save it with the other progress fields; repeat the revoke and grant lines from the game's original migration so only the edge function can call it.
2. `shared/<game>/server.ts`: after a finish, compute `fadeByKind` from the round's goes (only on the day's first finish, same guard as the level) and send it to the finish function. Parrot and Robin keep their `slips` parameter.
3. `shared/<game>/round.ts`: `makeRound` takes `kindLevels` and sets each go's `l` from its kind (see above).
4. Client `src/games/<game>/backend.ts` and the preview backend pass `kindLevels` through.

## 4. Files affected

- Kit (own small branch): `shared/kit/help.ts`, its test, and the rebuilt functions (`npm run build:functions`).
- Per game: `supabase/migrations/<next>_<game>_kind_levels.sql`; `shared/<game>/round.ts`, `server.ts`; `src/games/<game>/backend.ts`; `supabase/functions/<game>/` (redeploy).
- Never `shared/maths`, `src/maths`, `src/styles.css` or `src/components`.

## 5. Database / migration needs

Five new migration files, one per game, each numbered after the latest on main at the time (the latest seen was `20261108000200_tui_tenless_hardest.sql`; check `supabase/migrations/` again). Each adds the `kind_levels` column and replaces the load and finish functions as above. Live steps (apply migration, deploy function) are James's go-ahead.

## 6. Test steps

Kit: the five cases above. Per game (about 2 each): a round with all kinds good twice fades only those kinds; a hard kind keeps its level while another fades; a kind not in the map starts at the whole-child level. By playing the preview, two days in a row (use the preview's day control): at the end of day 2 the help differs for a strong kind and a weak kind.

## 7. Size and impact

L: one kit part and five migrations with server and round changes. Med to High: help that matches the kind a child struggles on keeps hard kinds supported and stops easy kinds being over-helped (rule 5).

## 8. Session prompt (ready to paste)

Do Part 1 first and merge it before the others.

### Part 1: Kit

```text
You are building part 1 of card S19 (help for each kind of go) of the second Foundational maths review for the Games Hub: the kit part.

Create your own small branch and worktree from origin/main, named kit-help-by-kind. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S19-help-per-kind-newer-five.md (Part 1: Kit) first. First check that card S13 is done; if not, stop and tell James. Reply to James in plain, simple words.

Steps:
1. Add fadeByKind(kindLevels, goes, rules) to shared/kit/help.ts. goes is a list of { kind: string, right: boolean }. For each kind with at least 2 goes, scale right to ten (Math.round(10 * right / n)) and call the existing fadeAfter with ROUND_OF_TEN; a kind with fewer than 2 goes is unchanged; a kind not in the map starts from a default level you pass in. No game words in the kit.
2. Add tests (inside the limit): 2 goes both right counts as good; 1 go is unchanged; two good rounds fade one level; one hard round brings one level back; a missing kind starts from the default.
3. Run npm run build:functions in the same PR and commit the rebuilt functions.
Run typecheck and tests.
Stop and tell James before any live step. Open a PR when done.
```

### Part 2: Pigeon

```text
You are building part 2 of card S19 (help for each kind of go) of the second Foundational maths review for the Games Hub: Pigeon's Berry Branch (kinds place, read, tens, near).

Create your own branch and worktree from origin/main, named pigeon-help-by-kind. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S19-help-per-kind-newer-five.md (Part 2 to 6) first. The kit part (fadeByKind in shared/kit/help.ts) must already be merged; if not, stop and tell James. Reply to James in plain, simple words.

Steps:
1. New migration (numbered after the latest in supabase/migrations/) pigeon_kind_levels: add column kind_levels jsonb not null default '{}' (object check) to pigeon_progress; recreate pigeon_load to return kindLevels; drop and recreate pigeon_finish with an extra kind_levels parameter and repeat the revoke and grant from the game's original migration.
2. shared/pigeon/server.ts (finish, near :153-164): on the day's first finish compute fadeByKind from the round's goes and save it.
3. shared/pigeon/round.ts: makeRound takes kindLevels and sets each go's l from its kind (shownLevel(kindLevels[kind]?.level ?? level, help)); the guided first go stays at the top level.
4. Pass kindLevels through src/games/pigeon/backend.ts and the preview backend.
Tests (about two): a hard kind keeps its level while another fades; a kind missing from the map starts at the whole-child level. Run typecheck and the Pigeon tests. Check two days in the preview.
Stop and tell James before any live step. Open a PR when done.
```

### Part 3: Parrot

```text
You are building part 3 of card S19 (help for each kind of go) of the second Foundational maths review for the Games Hub: Parrot's Equal Stones (kinds miss, swap, both, sub, tf, from the key prefix by kindOfKey).

Create your own branch and worktree from origin/main, named parrot-help-by-kind. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S19-help-per-kind-newer-five.md (Part 2 to 6) first. The kit part (fadeByKind in shared/kit/help.ts) must already be merged; if not, stop and tell James. Reply to James in plain, simple words.

Steps:
1. New migration (numbered after the latest in supabase/migrations/) parrot_kind_levels: add column kind_levels jsonb not null default '{}' (object check) to parrot_progress; recreate parrot_load to return kindLevels; drop and recreate parrot_finish with an extra kind_levels parameter (keep the slips parameter) and repeat the revoke and grant from the original migration.
2. shared/parrot/server.ts (placeAfter with STEP_RULES at :35): on the day's first finish compute fadeByKind from the round's goes and save it.
3. shared/parrot/round.ts: makeRound takes kindLevels and sets each go's l from its kind; the guided first go stays at the top level.
4. Pass kindLevels through src/games/parrot/backend.ts and the preview backend.
Tests (about two): a hard kind keeps its level while another fades; a kind missing from the map starts at the whole-child level. Run typecheck and the Parrot tests. Check two days in the preview.
Stop and tell James before any live step. Open a PR when done.
```

### Part 4: Lizard

```text
You are building part 4 of card S19 (help for each kind of go) of the second Foundational maths review for the Games Hub: Lizard's Bundles (kinds build, read, bundle, swap, more).

Create your own branch and worktree from origin/main, named lizard-help-by-kind. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S19-help-per-kind-newer-five.md (Part 2 to 6) first. The kit part (fadeByKind in shared/kit/help.ts) must already be merged; if not, stop and tell James. Reply to James in plain, simple words.

Steps:
1. New migration (numbered after the latest in supabase/migrations/) lizard_kind_levels: add column kind_levels jsonb not null default '{}' (object check) to lizard_progress; recreate lizard_load to return kindLevels; drop and recreate lizard_finish with an extra kind_levels parameter and repeat the revoke and grant from the original migration.
2. shared/lizard/server.ts: on the day's first finish compute fadeByKind from the round's goes (placeAfter is at shared/lizard/round.ts:94) and save it.
3. shared/lizard/round.ts: makeRound takes kindLevels and sets each go's l from its kind; the guided first go stays at the top level.
4. Pass kindLevels through src/games/lizard/backend.ts and the preview backend.
Tests (about two): a hard kind keeps its level while another fades; a kind missing from the map starts at the whole-child level. Run typecheck and the Lizard tests. Check two days in the preview.
Stop and tell James before any live step. Open a PR when done.
```

### Part 5: Swamp Hen

```text
You are building part 5 of card S19 (help for each kind of go) of the second Foundational maths review for the Games Hub: Swamp Hen's Reed Rows (kinds plant, mat, turn, which, share, cut, short).

Create your own branch and worktree from origin/main, named swamphen-help-by-kind. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S19-help-per-kind-newer-five.md (Part 2 to 6) first. The kit part (fadeByKind in shared/kit/help.ts) must already be merged; if not, stop and tell James. Reply to James in plain, simple words.

Steps:
1. New migration (numbered after the latest in supabase/migrations/) swamphen_kind_levels: add column kind_levels jsonb not null default '{}' (object check) to swamphen_progress; recreate swamphen_load to return kindLevels; drop and recreate swamphen_finish with an extra kind_levels parameter and repeat the revoke and grant from the original migration.
2. shared/swamphen/server.ts: on the day's first finish compute fadeByKind from the round's goes (placeAfter is at shared/swamphen/round.ts:99) and save it.
3. shared/swamphen/round.ts: makeRound takes kindLevels and sets each go's l from its kind; the guided first go stays at the top level.
4. Pass kindLevels through src/games/swamphen/backend.ts and the preview backend.
Tests (about two): a hard kind keeps its level while another fades; a kind missing from the map starts at the whole-child level. Run typecheck and the Swamp Hen tests. Check two days in the preview.
Stop and tell James before any live step. Open a PR when done.
```

### Part 6: Robin

```text
You are building part 6 of card S19 (help for each kind of go) of the second Foundational maths review for the Games Hub: Robin's Berry Basket (kinds give, howmany, counton).

Create your own branch and worktree from origin/main, named robin-help-by-kind. Read docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md and docs/plans/maths-review-2/S19-help-per-kind-newer-five.md (Part 2 to 6) first. The kit part (fadeByKind in shared/kit/help.ts) must already be merged; if not, stop and tell James. Reply to James in plain, simple words.

Steps:
1. New migration (numbered after the latest in supabase/migrations/) robin_kind_levels: add column kind_levels jsonb not null default '{}' (object check) to robin_progress; recreate robin_load to return kindLevels; drop and recreate robin_finish with an extra kind_levels parameter (keep the slips parameter) and repeat the revoke and grant from the original migration.
2. shared/robin/server.ts: on the day's first finish compute fadeByKind from the round's goes (Robin's own placeAfter is at shared/robin/progress.ts:46) and save it.
3. shared/robin/round.ts: makeRound takes kindLevels and sets each go's l from its kind; the guided first go stays at the top level.
4. Pass kindLevels through src/games/robin/backend.ts and the preview backend.
Tests (about two): a hard kind keeps its level while another fades; a kind missing from the map starts at the whole-child level. Run typecheck and the Robin tests. Check two days in the preview.
Stop and tell James before any live step. Open a PR when done.
```
