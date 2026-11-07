# Parrot's See-saw: going live

The code is switched ON (`src/games/parrot/switch.ts`) and `parrot_enabled` defaults to true for every class, so merging the PR and applying the migration is the go-live.

1. Merge the PR (checks green).
2. Apply `supabase/migrations/20261107000500_parrot.sql` (check the number with `node scripts/migration-numbers.mjs` first).
3. Deploy the `parrot` function (`supabase/functions/parrot/index.ts`, rebuilt with `npm run build:functions -- parrot`).
4. Play a go on the live site as a pupil: the first go points at the heap, then Check.
5. Records only count towards teacher evidence once `maths-parrot-keys` is live (see docs/PARROT-PLAN.md).
6. Still to do: the painted art pass (`python3 scripts/game_art.py parrot list`), the Foundational teacher grid (R7), the players tracker.
