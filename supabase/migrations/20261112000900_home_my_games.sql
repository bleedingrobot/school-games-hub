-- Dashboard plan D2 (docs/DASHBOARD-REVIEW.md): the home page's "My games" row.
--
-- my_top_games() answers, for the signed-in person:
--   mine:       up to 4 game ids they played most in the last 14 days. Games that give points are counted from scored_games
--               (most goes first); if that gives fewer than 4, games with a last-played hook (hub_games.last_played_fn) that
--               they played in the last 14 days are added, most recent first.
--   classGames: up to 4 game ids played most by their class in the last 14 days (from scored_games), for a pupil with none yet.
-- Nothing is written. It reads only the caller's own rows and counts for their own class (no names).
--
-- my_home_page() gets one new part, 'topGames', added in place (exact text edit that must match once), so the page still makes
-- one request.

create function public.my_top_games()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  since timestamptz := now() - interval '14 days';
  mine text[];
  extra record;
  at timestamptz;
  late text[] := '{}';
  late_at timestamptz[] := '{}';
  class_games text[];
  my_class uuid;
begin
  if me is null then
    return null;
  end if;
  select coalesce(array_agg(t.game order by t.n desc, t.last desc), '{}') into mine
  from (select g.game, count(*) as n, max(g.finished_at) as last
        from public.scored_games g
        where g.player = me and g.finished_at > since
        group by g.game
        order by count(*) desc, max(g.finished_at) desc
        limit 4) t;
  if coalesce(array_length(mine, 1), 0) < 4 then
    for extra in select h.id, h.last_played_fn from public.hub_games h
                 where h.last_played_fn is not null and not (h.id = any (mine)) loop
      execute format('select %s($1)', extra.last_played_fn::regproc) into at using me;
      if at is not null and at > since then
        late := late || extra.id;
        late_at := late_at || at;
      end if;
    end loop;
    select mine || coalesce(array_agg(x.id order by x.at desc), '{}') into mine
    from unnest(late, late_at) as x(id, at);
    mine := mine[1:4];
  end if;
  my_class := public.current_class_of(me);
  if my_class is not null then
    select coalesce(array_agg(t.game order by t.n desc), '{}') into class_games
    from (select g.game, count(*) as n
          from public.scored_games g
          join public.class_members m on m.student_id = g.player and m.class_id = my_class
          where g.finished_at > since
          group by g.game
          order by count(*) desc
          limit 4) t;
  end if;
  return jsonb_build_object('mine', to_jsonb(mine), 'classGames', to_jsonb(coalesce(class_games, '{}')));
end;
$$;

revoke execute on function public.my_top_games() from public, anon, authenticated;
grant execute on function public.my_top_games() to authenticated;

do $migration$
declare
  def text := pg_get_functiondef('public.my_home_page()'::regprocedure);
  -- No line ending in the needle: the live copy of my_home_page has Windows (\r\n) line endings.
  needle text := '''myClass'', public.my_class(),';
begin
  if (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 then
    raise exception 'my_home_page edit did not match exactly once; nothing was changed';
  end if;
  def := replace(def, needle, '''topGames'', public.my_top_games(), ' || needle);
  execute def;
end;
$migration$;

revoke execute on function public.my_home_page() from public, anon, authenticated;
grant execute on function public.my_home_page() to authenticated;
