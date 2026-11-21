-- The Gem Lord (James, 22 Nov 2026): finish the Gem Book's Rare Gem Collection in Diamond Drop (all 7 rare gems, kept for
-- good through New Season) and win the special gold Hero Title "The Gem Lord", owned for good and worn straight away the
-- first time. It comes with the Rare Gem Cup's gold step and the Complete Collection achievement (20261118003400).
--
--   1. special_title_ids() gains 'the-gem-lord' (mirrors SPECIAL_TITLES in shared/quests/titles.ts; a test checks).
--   2. diamond_rare_rewards also gives the title at 7 kinds. The trigger on diamond_players already calls it on every save.
--   3. Back-award: anyone whose collection is already complete gets it now.

create or replace function public.special_title_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'ultimate-dragon-slayer',
    'tess-the-best',
    'the-famous',
    'the-gem-lord'
  ]::text[]
$$;

revoke execute on function public.special_title_ids() from public, anon, authenticated;

create or replace function public.diamond_rare_rewards(who uuid, state jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  kinds integer := public.diamond_rare_kinds(state);
  step integer;
begin
  for step in 1..3 loop
    if kinds >= (array[3, 5, 7])[step] then
      perform public.award_trophy(who, 'diamond-rare-collection', jsonb_build_object('step', step));
    end if;
  end loop;
  if public.diamond_rare_book(state) ? 'phoenixGem' then
    perform public.award_trophy(who, 'diamond-phoenix');
  end if;
  -- The whole Rare Gem Collection: the gold title, worn straight away the first time (the pupil can change it in My titles).
  if kinds >= 7 then
    insert into public.owned_titles (player, title) values (who, 'the-gem-lord')
    on conflict do nothing;
    if found then
      update public.profiles p set avatar = coalesce(p.avatar, '{}'::jsonb) || jsonb_build_object('title', 'the-gem-lord')
      where p.id = who;
    end if;
  end if;
end;
$$;

revoke execute on function public.diamond_rare_rewards(uuid, jsonb) from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in select player, state from public.diamond_players where public.diamond_rare_kinds(state) >= 7 loop
    perform public.diamond_rare_rewards(r.player, r.state);
  end loop;
end;
$$;
