-- Trophies around the hub (docs/plans/profile/PLAN.md card P6): the level number and bar are retired, and pupils show their
-- trophy count and their favourite three instead (home strip, Leaderboard, Lobby, the teacher's pupil page).
--
--   1. trophy_shelves(names)   for each schoolmate named: how many different trophies they hold, and their favourite three
--                              (id, game, kind, name and metal only; never the detail of a win)
--   2. my_trophy_shelf()       the same for me, as a new 'trophyShelf' part of my_home_page (added in place, exact text edit
--                              that must match once), so the home page still makes one request
--
-- Nothing is dropped or changed. profiles.level_start and my_progress's level fields stay, unused by the site (James, 12 Nov
-- 2026: retire the level, keep points).

-- Names, not ids: the Leaderboard and Lobby rows already carry each pupil's made-up name (unique across the hub), not their id.
-- Anyone outside my school, or a name nobody has, is simply left out. At most 60 names in one call.
create function public.trophy_shelves(names text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer;
begin
  perform public.require_school_user();
  if cardinality(coalesce(names, '{}')) > 60 then
    raise exception 'Too many names at once.' using errcode = '22023';
  end if;
  school := public.my_school();
  return coalesce((
    select jsonb_object_agg(p.display_name, jsonb_build_object(
      'count', (select count(distinct w.trophy)::integer from public.trophies w where w.player = p.id),
      'favourites', coalesce((
        select jsonb_agg(jsonb_build_object('id', t.id, 'game', t.game, 'kind', t.kind, 'name', t.name,
                                            'tier', public.trophy_tier(c.level)) order by f.place)
        from unnest(p.trophy_favourites) with ordinality as f(id, place)
        join public.trophy_counts(p.id) c on c.trophy = f.id
        join public.trophy_types t on t.id = f.id), '[]'::jsonb)))
    from public.profiles p
    where p.display_name = any(coalesce(names, '{}')) and p.school_id = school), '{}'::jsonb);
end;
$$;

revoke execute on function public.trophy_shelves(text[]) from public, anon, authenticated;
grant execute on function public.trophy_shelves(text[]) to authenticated;

-- My own shelf, for the home page's welcome strip (my_home_page runs as the pupil, so they may call it; it reads only their own).
create function public.my_trophy_shelf()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.trophy_shelves(array[p.display_name]) -> p.display_name
  from public.profiles p
  where p.id = auth.uid()
$$;
revoke execute on function public.my_trophy_shelf() from public, anon, authenticated;
grant execute on function public.my_trophy_shelf() to authenticated;

do $migration$
declare
  def text := pg_get_functiondef('public.my_home_page()'::regprocedure);
  -- No line ending in the needle: the live copy of my_home_page has Windows (\r\n) line endings.
  needle text := '''topGames'', public.my_top_games(),';
begin
  if (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 then
    raise exception 'my_home_page edit did not match exactly once; nothing was changed';
  end if;
  def := replace(def, needle, '''trophyShelf'', public.my_trophy_shelf(), ' || needle);
  execute def;
end;
$migration$;

revoke execute on function public.my_home_page() from public, anon, authenticated;
grant execute on function public.my_home_page() to authenticated;
