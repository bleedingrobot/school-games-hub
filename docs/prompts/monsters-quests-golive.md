# Maths Monsters quests: go-live

Branch `monsters-quests`, worktree `~/games-hub-monsters-quests`. Follow docs/GAME_DEVELOPMENT_GUIDE.md section 8. Maths Monsters is already
live and switched on, so merging puts the quests in front of pupils straight away: there is no switch to turn on afterwards.

James's go-ahead: "keep working through till live" (3 Nov 2026). He chose (card, 3 Nov) to leave the 5 new achievements and the
dashboard egg line ("Battle today or your eggs go cold!") for a follow-up PR, because they change shared functions
(`progress_counts`, `my_moves_left`). Until then the dashboard chip code in `src/data/movesLeft.ts` simply sees no egg fields.

## 0. Pre-flight (nothing live), done 3 Nov 2026
1. Branch already contains `origin/main` (b204b0d).
2. `node scripts/migration-numbers.mjs`: no number used twice; `20261102000400` is still after everything it builds on.
   The four functions it re-creates (`load_monster_save`, `monster_counts_for_cap`, `my_monsters`, `record_monster_save`)
   start from their newest earlier versions (20261018001500 and 20261027000200).
3. Live database: `monster_saves` exists (71 rows); newest applied migration 20261102000300; ours not applied.
   The migration only adds columns with defaults (`play_days`, `play_day`, `eggs_hatched`) and replaces Monsters functions.
4. Scratch copy from this branch: 65 database test files pass. `card101_classmates` and `security` fail on the local
   realtime `messages` table (no partition for today); they fail the same way on `main`, so it is the local stack.
5. `npm run test:all` (5892), typecheck and build pass. `npm run build:functions -- monster` gives no change.
6. Accessibility: menu pages move focus to Back; small buttons and world map labels have 44px tap areas; the ready-egg
   wobble stops with reduced motion. Painted maps fall back to the tile map while they load.

## 1. Merge-step edits (the PR)
- Take `20261102000400` out of `supabase/migrations-on-hold.txt` (this makes the migration and the `monster` function go live on merge).
- `docs/PRIVACY-SUMMARY.md`: Monsters also stores the quest part of the save (quests, bits, eggs, puzzles solved) and the
  number of different NZ days played (`play_days`, `play_day`) and eggs hatched.

## 2. After the merge
- "Test and publish" green; `monster_saves` has the three new columns; the `monster` function redeployed.
- `select count(*) from public.monster_saves;` not smaller than 71.
- Unsigned `curl -X POST …/functions/v1/monster` answers 401.
- As a pupil on the live site: open Maths Monsters, walk, battle, open the Menu (World map, Quests, Egg basket), and check
  the save still loads after a reload.

## 3. Write it down
"Went live" in docs/MONSTERS-QUESTS-PLAN.md and the memory note. Then the follow-up PR for the achievements and the dashboard egg line.

## Rollback
Gentlest first: revert the website PR (the old website ignores the new save fields). The function accepts saves without
`quest`, so the old website keeps working with the new function. Never drop the new columns.
