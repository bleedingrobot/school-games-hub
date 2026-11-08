# S11: Game kit: remember which kinds of go a child has seen

**Game:** Kit (first user: the newer five, then the older games)
**What's wrong:** LEARNING-DESIGN rule 4 says the first time a new kind of go appears the child gets a demo, and "who has seen it comes from the server". Nothing in the kit remembers that. `FirstTimeTip` and `useGuidedFirstGo` have no memory at all.
**What done looks like:** A game can ask the server "which kinds has this child seen?" and tell it "they have now seen these". The answer follows the child to any Chromebook. A teacher can see nothing change yet (S12 uses it).
**Size:** M
**Impact on learning:** High (it lets S12 show a demo once per child per kind, and never again)
**Waits for:** nothing

## 1. The problem

- `src/kit/FirstTimeTip.tsx:1-48` only draws a tip. It is told `n` and `of` by the game and keeps nothing.
- `src/kit/useGuidedFirstGo.ts:1-26` only times the pointing hand (`guided` and `ms` come in from the game). It keeps nothing either.
- Each game decides "is this the first go ever?" by itself, from its own progress row: Robin `daysDone === 0 && lastDay === null` (`src/games/robin/RobinGame.tsx:128`, `shared/robin/server.ts:133`), Parrot the same (`src/games/parrot/ParrotGame.tsx:128`), Pigeon, Lizard and Swamp Hen `daysDone === 0` (`src/games/pigeon/PigeonGame.tsx:114`, `src/games/lizard/LizardGame.tsx:115`, `src/games/swamphen/SwamphenGame.tsx:123`). So the only "first time" is the child's very first round. A kind that first appears on day 6 (Pigeon's zoom lens at step 6, `shared/pigeon/config.ts:25-28`) gets nothing.
- The evaluators saw this as cold starts in all twelve games (`docs/reviews/maths-review-2/DECISIONS.md` section 7, pattern 5, line 143).

## 2. The rule behind it

LEARNING-DESIGN rule 4 (`docs/LEARNING-DESIGN.md:85`): a demo or guided go the first time a new kind appears, and who has seen it comes from the server. Also rule 9 (record evidence): the seen list is small, safe and visible to the server only.

## 3. The change

**Decision: one shared table, not a column per game.** Reasons: one migration; no existing function is re-created (every `<game>_finish` takes many fixed arguments, for example `public.robin_finish(uuid, bigint, integer, integer, date, smallint, smallint, integer, integer, jsonb, integer, integer, jsonb)` in `supabase/migrations/20261108000100_robin.sql:187-194`, and changing one is risky); games that have no progress row yet still work; older games join later with no migration at all.

**Database (new migration, number from `node scripts/migration-numbers.mjs`; at the time of writing the next free number is `20261108000300`):**
- Table `public.kit_seen (player uuid not null references public.profiles (id) on delete cascade, game text not null check (game ~ '^[a-z][a-z0-9-]{1,30}$'), kinds text[] not null default '{}' check (cardinality(kinds) <= 32), updated_at timestamptz not null default now(), primary key (player, game))`. RLS on; `revoke all ... from anon, authenticated` (same as `robin_progress`, `supabase/migrations/20261108000100_robin.sql:53-55`).
- `public.kit_seen_get(player uuid, game text) returns text[]` (stable, security definer, `set search_path = ''`, calls `public.gem_keep_check_player(player)` first, as `robin_load` does at line 70). Returns `'{}'` when there is no row.
- `public.kit_seen_mark(player uuid, game text, kinds text[]) returns text[]`: checks the player, checks every kind matches `^[a-z0-9-]{1,24}$` (else raise), at most 8 kinds in one call, takes the union with the saved list (sorted, no repeats, at most 32), upserts, returns the new list. Calling it twice with the same kinds changes nothing.
- Revoke execute from `public, anon, authenticated`; grant to `service_role` only (same block as `robin_load`, lines 185-195).

**Shared (`shared/kit/seen.ts`, no game words):**
- `readKinds(value: unknown, allowed: readonly string[], max = 8): string[] | null`: a body field is an array of known kind names, no repeats, at most `max`; else `null` (the server answers "unreadable", like `readTaps`, `shared/weka/server.ts:94-100`).
- `mergeSeen(...lists: readonly (readonly string[])[]): string[]`: union, sorted.
- `kindsFromFacts(facts: Iterable<{ key: string; attempts: number }>, kindOfKey: (key: string) => string | null): string[]`: the kinds a child has already answered. **This backfills children who have played for weeks**, so they do not get a demo for something they already know. The game's server returns `mergeSeen(saved, kindsFromFacts(facts, kindOfKey))` from `load`.
- `SeenServices` type (`seen(player): Promise<string[] | 'busy'>` and `markSeen(player, kinds): Promise<string[] | 'busy'>`), and `memorySeen()` for the preview's trial backend (a `Map`). The game's own `server.ts` adds the `seen` action in S12; the kit only gives the parts.

**Browser (`src/kit/useSeenKinds.ts`, exported from `src/kit/index.ts`):**
- `useSeenKinds(initial: readonly string[], save: (kinds: string[]) => Promise<unknown>)` returns `{ has(kind), mark(kinds), seenKinds }`.
- `mark` updates the local set at once (so a demo never plays twice in one sitting), then calls `save`. If `save` fails it keeps the unsent kinds and sends them with the next `mark`. A failure never blocks play and shows nothing to the child. If nothing is ever saved, the worst case is one repeated demo.
- No game words, no CSS, no storage in the browser (the server is the memory). Document it in `src/kit/README.md`.

**Rules for any game that uses it (write these in the README):**
1. A kind is marked seen when its demo ends or is skipped, **or** when the child finishes any go of that kind. So every kind that is played is remembered, whether or not a demo exists for it yet. Later cards can add a demo for a kind without making existing children sit through it.
2. The game's guided first go (very first round) marks its own kind seen when that go is finished.
3. Kind names are short, lower case, stable (`zoom`, `swap`). Never rename one after it ships.

**Words and voice:** none (no child-facing text in this card).

## 4. Files affected

- New: `shared/kit/seen.ts`, `src/kit/useSeenKinds.ts`, `supabase/migrations/<next>_kit_seen.sql`, `supabase/tests/database/kit_seen.test.sql`.
- Changed (kit, own branch and PR): `src/kit/index.ts`, `src/kit/README.md`, `shared/kit/kit.test.ts`, `src/kit/kitJunior.test.tsx` (or `kit.test.tsx`).
- `npm run build:functions` in the same PR (kit rule). No function bundles the new file yet, so expect no `index.ts` change; run it and the "up to date" tests anyway.
- Not touched: any game folder (S12 does that).

## 5. Database / migration needs

One new migration (above). It goes live by itself when the PR merges (`docs/GAME_DEVELOPMENT_GUIDE.md` section 8, step 1), so tell James before merging. It is additive: nothing existing changes. Test it on a throw-away copy (`scripts/scratch-db.sh kitseen`, then `scripts/scratch-test.sh kitseen supabase/tests/database/kit_seen.test.sql`), and never `supabase db reset`.

## 6. Test steps

Three tests in all (kit parts: one test each at most, `docs/TESTING.md`):
1. `shared/kit/kit.test.ts`: `readKinds` (unknown kind, repeat, too many, not an array all give `null`), `mergeSeen`, and `kindsFromFacts` (only facts with `attempts > 0`).
2. `src/kit` hook test: `mark` shows at once; a failed `save` keeps the kinds and the next `mark` sends both; `has` is true after `mark`.
3. pgTAP `kit_seen.test.sql`: a pupil cannot read or call anything (42501); the server key can mark; marking the same kind twice leaves one; a bad kind name raises; two games keep separate lists; deleting the profile removes the row.

By hand: nothing to play yet. Check the migration on the scratch copy only.

## 7. Size and impact

M: one table, two small functions, one shared file, one hook, three tests. High because every later "show me first" card (S12 and the older games) needs it, and the shape is the same for every game.

## 8. Session prompt (ready to paste)

```text
Read CLAUDE.md, docs/GAME_DEVELOPMENT_GUIDE.md, docs/LEARNING-DESIGN.md (rule 4), docs/plans/GAME-KIT-PLAN.md and docs/plans/maths-review-2/S11-kit-seen-kinds.md. Build the kit part that remembers which kinds of go a child has seen, on a new branch `kit-seen` from origin/main (new worktree, never the main checkout).
Steps:
1. git fetch; node scripts/migration-numbers.mjs; take the next free number. Write supabase/migrations/<number>_kit_seen.sql: table kit_seen (player, game, kinds text[], updated_at; primary key player+game; RLS on; revoke from anon and authenticated), functions kit_seen_get and kit_seen_mark exactly as in the plan (check the player with gem_keep_check_player, validate kind names, union and cap, service_role only).
2. shared/kit/seen.ts: readKinds, mergeSeen, kindsFromFacts, the SeenServices type and memorySeen. No game words.
3. src/kit/useSeenKinds.ts (mark at once, keep unsent kinds on failure, never block play); export it from src/kit/index.ts; add a short section to src/kit/README.md with the three rules for games.
4. Tests, three only: one in shared/kit/kit.test.ts, one hook test in src/kit, one pgTAP file supabase/tests/database/kit_seen.test.sql run on a scratch copy (scripts/scratch-db.sh kitseen, scripts/scratch-test.sh ...; drop it after; never supabase db reset).
5. npm run build:functions; run npx tsc --noEmit (or the repo's typecheck), npm run test:changed and the build.
Do not touch any game folder, shared/maths or src/styles.css. Stop and tell James before any live step (the migration goes live when the PR merges). Open a PR when done.
```
