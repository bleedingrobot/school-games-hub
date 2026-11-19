-- Goblin Storm: two weekly class quests and a second trophy (James, 20 Nov 2026).
--
--   1. Two quest kinds, like every other easy maths game (shared/quests/kinds.ts has the same list):
--        goblinstorm-daily  finish 2 runs on 5 of 7 days      goblinstorm-total  finish 12 runs in the week
--      A run counts when it is played to the end (won, survived or fell), not one left early: the same runs that earn
--      points. Counted by a watcher on goblinstorm_runs, as the other games' watchers in 20261118003100.
--   2. The Fire Dragon's Scale trophy: beating the Fire Dragon (Lava Mines, map 4's boss) the first time. Never for maths.
--      goblinstorm_save_trophies() gives it next to the Goblin King's Crown. No back-award: nobody has beaten it yet
--      (checked 20 Nov 2026).

-- ---------------------------------------------------------------------------
-- 1. Quests
-- ---------------------------------------------------------------------------

insert into public.quest_kinds (id, switch_column, sort, rule, measure, amount) values
  ('goblinstorm-daily', 'goblinstorm_enabled', 160, 'days', 'goblinstorm_runs', 2),
  ('goblinstorm-total', 'goblinstorm_enabled', 161, 'total', 'goblinstorm_runs', 12);

-- A run closed by record_goblinstorm_run (open goes false) with an outcome that was played to the end.
create function public.goblinstorm_quest_tally()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.open and not new.open and new.outcome in ('won', 'survived', 'lost') then
    perform public.quest_add(new.player, 'goblinstorm_runs', 1);
  end if;
  return null;
exception when others then
  raise warning 'a Goblin Storm quest tally failed (%)', sqlstate;
  return null;
end;
$$;
create trigger quest_tally_when_saved after update of open on public.goblinstorm_runs
for each row execute function public.goblinstorm_quest_tally();

revoke execute on function public.goblinstorm_quest_tally() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The Fire Dragon's Scale
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('goblinstorm-scale', 'goblinstorm', 'Fire Dragon''s Scale', 'Beat the Fire Dragon in Goblin Storm.', 'trophy', 'once', null, 351);

-- Same function as 20261119000900 with the Fire Dragon added; the trigger on goblinstorm_saves stays as it is.
create or replace function public.goblinstorm_save_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if 0 = any (new.bosses) and (tg_op = 'INSERT' or not (0 = any (old.bosses))) then
    perform public.award_trophy(new.player, 'goblinstorm-crown', '{}'::jsonb);
  end if;
  if 4 = any (new.bosses) and (tg_op = 'INSERT' or not (4 = any (old.bosses))) then
    perform public.award_trophy(new.player, 'goblinstorm-scale', '{}'::jsonb);
  end if;
  return null;
exception when others then
  raise warning 'a Goblin Storm trophy failed (%)', sqlstate;
  return null;
end;
$$;
