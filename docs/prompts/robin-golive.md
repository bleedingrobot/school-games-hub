# Robin's Berry Basket: going live

The code is switched ON (`src/games/robin/switch.ts`) and `robin_enabled` defaults to true for every class, so merging the PR and applying the migration is the go-live.

1. Merge the PR (checks green). The PR also rebuilds every server function that bundles the shared maths (the counting keys changed it), so deploy those when convenient; nothing breaks if they wait.
2. Apply `supabase/migrations/20261108000100_robin.sql` (check the number with `node scripts/migration-numbers.mjs` first). Docker was not running when this was built, so the database tests in `supabase/tests/database/` have not been run: run `supabase test db` first.
3. Deploy the `robin` function (`supabase/functions/robin/index.ts`, rebuilt with `npm run build:functions -- robin`).
4. Play a go on the live site as a pupil: the first go is "Give me 4" with a pointing hand, then That's all.
5. Still to do: the painted art pass (`python3 scripts/game_art.py robin list`; the card picture `src/assets/home/robin.svg` is a stand-in), curriculum tags, the Foundational teacher grid, the players tracker, a child-facing help choice.
