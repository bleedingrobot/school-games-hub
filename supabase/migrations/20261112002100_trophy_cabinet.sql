-- The trophy cabinet on the pupil's profile (docs/plans/profile/PLAN.md card P5). Builds on 20261112000800_trophies.sql.
--
--   1. profiles.trophy_favourites      up to three trophies a pupil picks to show off (card P6 shows them beside their name)
--   2. set_my_favourite_trophies       saves them, keeping only trophies the pupil really holds
--   3. my_trophies                     now also sends `favourites`, and up to 12 `next` so the page can leave out games the
--                                      class can't see and still show three
--   4. my_new_trophies                 a small read for the "New trophy!" moment on hub pages: only the trophies not seen yet
--
-- Nothing is dropped. my_trophies keeps its name, arguments and grants.

-- ---------------------------------------------------------------------------
-- 1. Favourites
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column trophy_favourites text[] not null default '{}'
    check (cardinality(trophy_favourites) <= 3);
comment on column public.profiles.trophy_favourites is
  'Trophies: up to three trophy ids the pupil picked to show off, in their order. Only set by set_my_favourite_trophies.';

-- ---------------------------------------------------------------------------
-- 2. Saving favourites
-- ---------------------------------------------------------------------------

-- Saves my favourite trophies (up to three, in this order). Any I don't hold, and repeats, are left out. Returns what was saved.
create function public.set_my_favourite_trophies(ids text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  clean text[];
begin
  perform public.require_school_user();
  if cardinality(coalesce(ids, '{}')) > 3 then
    raise exception 'You can pick up to three favourites.' using errcode = '22023';
  end if;
  select coalesce(array_agg(f.id order by f.place), '{}') into clean
  from (
    select distinct on (x.id) x.id, x.place
    from unnest(coalesce(ids, '{}')) with ordinality as x(id, place)
    where exists (select 1 from public.trophies w where w.player = me and w.trophy = x.id)
    order by x.id, x.place
  ) f;
  update public.profiles set trophy_favourites = clean where id = me;
  return clean;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. My cabinet, with favourites and more "next" spots
-- ---------------------------------------------------------------------------

-- My own cabinet: { season, trophies: [...], next: [...], favourites: [...] }.
--   trophies:   every trophy I hold, in shelf order, with its metal, how many times, and each win (with its detail).
--   next:       up to twelve I have not won yet, in shelf order. The page shows three from games my class can see.
--   favourites: up to three trophy ids I picked, still held.
create or replace function public.my_trophies()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  perform public.require_school_user();
  return jsonb_build_object(
    'season', public.hub_season(public.my_school()),
    'trophies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'game', t.game, 'name', t.name, 'how', t.how, 'kind', t.kind, 'repeat', t.repeat, 'art', t.art,
        'tier', public.trophy_tier(c.level), 'count', c.wins, 'firstAt', c.first_at, 'lastAt', c.last_at, 'isNew', c.unseen,
        'wins', (select jsonb_agg(jsonb_build_object('season', w.season, 'year', w.year, 'at', w.earned_at, 'detail', w.detail)
                                  order by w.earned_at, w.season)
                 from public.trophies w where w.player = me and w.trophy = t.id))
        order by t.sort, t.id)
      from public.trophy_counts(me) c join public.trophy_types t on t.id = c.trophy), '[]'::jsonb),
    'next', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'game', n.game, 'name', n.name, 'how', n.how, 'kind', n.kind,
        'repeat', n.repeat, 'art', n.art) order by n.sort, n.id)
      from (select t.* from public.trophy_types t
            where not exists (select 1 from public.trophies w where w.player = me and w.trophy = t.id)
            order by t.sort, t.id limit 12) n), '[]'::jsonb),
    'favourites', coalesce((
      select to_jsonb(array_agg(f.id order by f.place))
      from public.profiles p, unnest(p.trophy_favourites) with ordinality as f(id, place)
      where p.id = me and exists (select 1 from public.trophies w where w.player = me and w.trophy = f.id)), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. The "New trophy!" moment
-- ---------------------------------------------------------------------------

-- Only my trophies with a win I haven't been shown yet: [{ id, game, name, how, kind, tier, count }], oldest first.
-- Asked by the hub pages each time one opens, so it stays small. mark_my_trophies_seen (P3) clears them.
create function public.my_new_trophies()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  perform public.require_school_user();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', t.id, 'game', t.game, 'name', t.name, 'how', t.how, 'kind', t.kind,
      'tier', public.trophy_tier(c.level), 'count', c.wins) order by c.last_at, t.id)
    from public.trophy_counts(me) c join public.trophy_types t on t.id = c.trophy
    where c.unseen), '[]'::jsonb);
end;
$$;

revoke execute on function public.set_my_favourite_trophies(text[]), public.my_new_trophies() from public, anon, authenticated;
grant execute on function public.set_my_favourite_trophies(text[]), public.my_new_trophies() to authenticated;
