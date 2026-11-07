# Lizard's Bundles: going live

The game is built switched on: code default on (`src/games/lizard/switch.ts`) and the `hub_games` row on in `supabase/migrations/20261107001000_lizard.sql`.

On merge the workflow applies the migration and deploys the `lizard` function and the maths functions rebuilt with the new place-value keys. The new keys are in `shared/maths`, so the maths functions must deploy with the game.

After merge: open the hub as a student, play one challenge at step 1 and one at a later step, check a bundle in the den changes, check the hundreds tip shows once, and check the teacher's Games row shows the switch and the drawer. Still to do: the painted art (`docs/lizard-art/config.json`), `scripts/lizard-sim.mjs`, the Foundational teacher grid entry and the players tracker query.
