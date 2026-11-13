-- Mine Runner easy flying (docs/plans/mine-flight/PLAN.md, M2): runs can now be in the 'easy' flight mode as well as
-- 'steady' and 'free'. The server replays each run under its own mode, so old runs stay valid. All modes share a board.
-- Only the two check constraints change; no rows are touched.

alter table public.mine_runs drop constraint if exists mine_runs_mode_check;
alter table public.mine_runs add constraint mine_runs_mode_check check (mode in ('steady', 'free', 'easy'));

alter table public.mine_bests drop constraint if exists mine_bests_mode_check;
alter table public.mine_bests add constraint mine_bests_mode_check check (mode in ('steady', 'free', 'easy'));
