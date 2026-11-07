# Swamp Hen's Reed Rows: going live

The game is built switched on: code default on (`src/games/swamphen/switch.ts`) and the `hub_games` row on in `supabase/migrations/20261107001100_swamphen.sql`.

On merge the workflow applies the migration and deploys the `swamphen` function (and any maths functions rebuilt by `scripts/build-functions.mjs`).

After merge: open the hub as a student, play one challenge on step 1 and a later step, check a reed row changes colour, and check the teacher's Games row shows the switch and the drawer (garden help). The painted art (SWAMPHEN-ART-PLAN.md), the Foundational teacher grid entry and the players tracker query still need doing.
