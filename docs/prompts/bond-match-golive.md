# Prompt: Bond Match, going live

Paste everything below the line into a new Claude session in `~/projects/school-games-hub-bond-match` (branch `bond-match`).

---

You are putting **Bond Match** live in James's School Games Hub (games for his Year 4–6 class). Reply to James in plain, simple words: no jargon, file paths or commit hashes unless he asks. Read `docs/GAME_DEVELOPMENT_GUIDE.md` section 8 and the "Stage M.6 results" in `docs/BOND-MATCH-PLAN.md` first.

## Where it is
- **Already live (19–20 Oct 2026):** migration `20261019001000_bond_match.sql` (applied under its old number `20261019000200`; **never apply it again**) and the `bond-match` function (redeployed 20 Oct with the sign-in check from `_shared/signIn.ts`, Verify JWT off).
- **New, not live:** migration `20261020000200_bond_match_switch.sql` (the per-class switch `app_settings.bond_match_enabled`, off everywhere; `teacher_set_bond_match()`; `bond_match_games.mode` for two-player and computer games, which earn points but don't change bests; Bond Match's How points work line through `hub_games`). The new `bond-match` function checks that switch and refuses to save while it's off (403; the website keeps its queue).
- **Website:** Bond Match is in the registry (`BOND_MATCH_ON = true` in `src/games/bond-match/switch.ts`) but the card only shows where the teacher has switched it on. The Teacher page gets a Bond Match panel with the switch.

## Rules
- Each live step only when James says so, in words, in this session. Approval for one step is not approval for the next.
- Never `supabase db reset`. Never a bare `git push`: push with `git push origin bond-match`, and to main only as `bond-match:main` when James says so.

## Steps (in this order: the website must not reach pupils before the database and function are ready)
0. **Pre-flight (nothing live).** `git fetch`; merge `origin/main`; `node scripts/migration-numbers.mjs` (renumber `20261020000200` if it's taken); `npm run typecheck`, `npm run test:all`, `npm run build`; `scripts/scratch-db.sh bondmatch` then `scripts/scratch-test.sh bondmatch` (expect only the three failures every copy has: two Clan Quest midnight-job checks and `maths_focus_results` check 42); drop the copy. Check the live database still has what this builds on: `select to_regclass('public.bond_match_games'), to_regclass('public.hub_games'), (select count(*) from public.hub_games where id = 'bond-match');` (expect both tables and 1).
1. **Apply the migration** (James's yes): `npx supabase db query --linked --project-ref zqzhetlzvtptnkmeiumi -f supabase/migrations/20261020000200_bond_match_switch.sql`.
   *Check:* `select count(*) from public.app_settings where bond_match_enabled;` is 0; `select switch_column, rules_fn from public.hub_games where id = 'bond-match';` shows `bond_match_enabled` and `bond_match_point_rules()`; `select count(*) from public.scored_games;` not smaller than before.
2. **Deploy the function** (James's yes): `npm run build:functions -- bond-match`, then `npx supabase functions deploy bond-match --project-ref zqzhetlzvtptnkmeiumi --no-verify-jwt --use-api`.
   *Check:* an unsigned `curl -s -X POST https://zqzhetlzvtptnkmeiumi.supabase.co/functions/v1/bond-match` answers 401 "Please sign in again."
3. **Merge to `main`** (James's yes): merge `origin/main` into `bond-match` once more, run the checks, then `git push origin bond-match:main` (or open a pull request if he'd rather). Watch "Test and publish" go green.
4. **Try it as a teacher** (James): Teacher page → Bond Match → it says Off. Teachers can open `/#/bond-match` to try it.
5. **Switch it on for James's class only** (James does it on the Teacher page, or says so). This is the playtest. Check a pupil sees the card, finishes a game, sees "Saved ✓ You earned 2 points", and the teacher's student panel shows their stars.
6. **Write it down:** a "went live" note in the plan, the date in `docs/PLAN.md`'s migration note, and the memory note. Then stop for James's feedback (star targets in `shared/bond-match/score.ts` may need tuning after the playtest).

## Undo, gentlest first
- The Teacher page switch: the card disappears for that class and the server refuses to save.
- `BOND_MATCH_ON = false` and publish: the card is gone for everyone.
- The database: don't drop anything. The new column and `mode` are harmless left in place.
