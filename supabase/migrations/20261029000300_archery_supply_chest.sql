-- Archery Challenge: fixes the loot chest and adds the supply chest (docs/ARCHERY-QUESTIONS-PLAN.md, 28 Oct 2026).
--
-- 1. archery_round_start (the 8-argument one) failed every time: in "on conflict (player, after)" the names also
--    match the function's own arguments, so Postgres said the column was ambiguous. It now prefers the columns.
-- 2. A question set can be a 'supply' chest (before a bot fight, before packing).

alter table public.archery_rounds drop constraint archery_rounds_kind_check;
alter table public.archery_rounds add constraint archery_rounds_kind_check check (kind in ('speed', 'chest', 'restock', 'supply'));

create or replace function public.archery_round_start(
  player uuid, seed text, questions jsonb, earns boolean, served_ms bigint, kind text, after text, per_right integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.gem_keep_check_player(archery_round_start.player);
  if jsonb_typeof(archery_round_start.questions) <> 'array' or jsonb_array_length(archery_round_start.questions) not between 1 and 20 then
    raise exception 'That question list is not right.' using errcode = '22023';
  end if;
  delete from public.archery_rounds r where r.created_at < now() - interval '2 days';
  insert into public.archery_rounds (player, seed, questions, served, earns, kind, after, per_right)
  values (archery_round_start.player, archery_round_start.seed, archery_round_start.questions,
    jsonb_build_object('0', archery_round_start.served_ms), archery_round_start.earns, archery_round_start.kind,
    archery_round_start.after, archery_round_start.per_right)
  on conflict (player, after) where after is not null do nothing;
  return found;
end;
$$;

revoke execute on function public.archery_round_start(uuid, text, jsonb, boolean, bigint, text, text, integer) from public, anon, authenticated;
grant execute on function public.archery_round_start(uuid, text, jsonb, boolean, bigint, text, text, integer) to service_role;
