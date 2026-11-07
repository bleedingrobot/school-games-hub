# Kererū's Number Line: going live

The game is built switched on: code default on (`src/games/kereru/switch.ts`) and the `hub_games` row on in `supabase/migrations/20261107000200_kereru.sql`.

Merge order: PR #263 (shared line families and skills), PR #264 (NumberLine zoom lens), then the game PR. On merge the workflow applies the migration and deploys the `kereru` function and the maths functions rebuilt by #263.

After merge: open the hub as a student, play one challenge on each of step 1 and a later step, check the berry cluster changes, and check the teacher's Games row shows the switch and the drawer. The painted art (KERERU-ART-PLAN.md), the Foundational teacher grid entry and the players tracker query still need doing.
