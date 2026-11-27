-- Class Live: Colour Clash's board is widescreen (27 Nov 2026 NZ: James asked for the map to fill the screen). Nothing is
-- deleted.
--
-- A new game is CLASH_W (1.6) wide and 1 high (`w` on the game and its rounds), so its paint grid has more columns and
-- the same rows: round(24 * w) = 38 columns x 24 rows = 912 tiles, idx = row * columns + column. A game without `w`
-- (started before this) stays 24 x 24. The width the database clamps moves to is classlive_activities.width (set by
-- 20261127163618); this migration makes the painting itself follow the game's width:
--
--   1. classlive_clash_tiles.idx may go up to 1151 (a board up to 2 wide).
--   2. classlive_clash_put() accepts those indexes.
--   3. classlive_clash_paint() works out the columns from the game's `w`, and the fountain is in the middle of the wide
--      board. Otherwise exactly as in 20261125001200_classlive_clash.
--   4. classlive_clash_count() reads every tile of the game's board (24 * columns), not always 576.

alter table public.classlive_clash_tiles drop constraint classlive_clash_tiles_idx_check;
alter table public.classlive_clash_tiles add constraint classlive_clash_tiles_idx_check check (idx between 0 and 1151);

create or replace function public.classlive_clash_put(target bigint, rnd integer, tm integer, who uuid, idxs integer[], now_ms bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  insert into public.classlive_clash_tiles as t (room, round, idx, team, painter, at_ms)
  select target, rnd, i, tm, who, now_ms from (select distinct unnest(idxs) as i) d where i between 0 and 1151
  on conflict (room, round, idx) do update set team = excluded.team, painter = excluded.painter, at_ms = excluded.at_ms
  where t.team <> excluded.team;
  get diagnostics changed = row_count;
  if changed > 0 then
    insert into public.classlive_clash_painted as p (room, player, painted) values (target, who, changed)
    on conflict (room, player) do update set painted = p.painted + excluded.painted;
  end if;
  return changed;
end;
$$;

create or replace function public.classlive_clash_paint(target bigint, x double precision, y double precision, since bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  prev public.classlive_spots%rowtype;
  had boolean;
  cur public.classlive_spots%rowtype;
  spots jsonb;
  g jsonb;
  r jsonb;
  n integer := 0;
  zero bigint;
  t bigint;
  tm integer;
  brush_to bigint;
  wide boolean;
  gap double precision;
  steps integer;
  s integer;
  px double precision;
  py double precision;
  cx integer;
  cy integer;
  dx integer;
  dy integer;
  hole boolean;
  w double precision;
  cols integer;
  tw double precision;
  idxs integer[] := '{}';
begin
  if me is null then
    return null;
  end if;
  select * into prev from public.classlive_spots sp where sp.room = target and sp.player = me;
  had := found;
  spots := public.classlive_move(target, x, y);
  if spots is null then
    return null;
  end if;
  select st.session -> 'game' into g from public.classlive_state st where st.room = target;
  if g is null or g ->> 'kind' is distinct from 'clash' then
    return jsonb_build_object('spots', spots, 'round', 0, 'now', now_ms, 'tiles', '[]'::jsonb);
  end if;
  r := g -> 'round';
  -- The board is w wide (1 high) for games started since the wide map; older ones are square. Same maths as colsOf / tileW
  -- in shared/classlive/clash.ts: round(24 * w) columns, 24 rows.
  w := coalesce((g ->> 'w')::double precision, 1);
  cols := round(24 * w)::integer;
  tw := w / cols;
  if r is not null and jsonb_typeof(r) = 'object' then
    n := coalesce((r ->> 'n')::integer, 0);
  end if;
  zero := (g ->> 'zeroMs')::bigint;
  select * into cur from public.classlive_spots sp where sp.room = target and sp.player = me;
  -- Paint only a move saved just now, while this round's painting is on.
  if n > 0 and zero is not null and had and cur.at_ms = now_ms and coalesce(jsonb_typeof(r -> 'result'), 'null') = 'null' then
    t := now_ms - zero;
    tm := (g -> 'mine' -> me::text ->> 'team')::integer;
    if tm between 1 and 4 and t >= (r ->> 'paintFrom')::bigint and t < (r ->> 'paintTo')::bigint then
      brush_to := (g -> 'mine' -> me::text ->> 'brushTo')::bigint;
      wide := brush_to is not null and t < brush_to;
      hole := coalesce((r ->> 'hole')::boolean, false);
      gap := sqrt((cur.x - prev.x) ^ 2 + (cur.y - prev.y) ^ 2);
      -- A long jump (a teleport, a new round's start) paints only where they land.
      if gap > 0.6 * least(5, greatest(0, now_ms - prev.at_ms) / 1000.0) + 0.06 then
        prev.x := cur.x;
        prev.y := cur.y;
        gap := 0;
      end if;
      steps := greatest(1, ceil(gap / (1.0 / 48))::integer);
      for s in 0..steps loop
        px := prev.x + (cur.x - prev.x) * s / steps;
        py := prev.y + (cur.y - prev.y) * s / steps;
        cx := least(cols - 1, greatest(0, floor(px / tw)::integer));
        cy := least(23, greatest(0, floor(py * 24)::integer));
        for dy in (case when wide then -1 else 0 end)..(case when wide then 1 else 0 end) loop
          for dx in (case when wide then -1 else 0 end)..(case when wide then 1 else 0 end) loop
            if cx + dx between 0 and cols - 1 and cy + dy between 0 and 23
              and not (hole and sqrt(((cx + dx + 0.5) * tw - w / 2) ^ 2 + ((cy + dy + 0.5) / 24 - 0.5) ^ 2) < 0.15) then
              idxs := idxs || ((cy + dy) * cols + cx + dx);
            end if;
          end loop;
        end loop;
      end loop;
      perform public.classlive_clash_put(target, n, tm, me, idxs, now_ms);
    end if;
  end if;
  return jsonb_build_object('spots', spots, 'round', n, 'now', now_ms,
    'tiles', case when n > 0 then public.classlive_clash_changes(target, n, since) else '[]'::jsonb end);
end;
$$;

create or replace function public.classlive_clash_count(target bigint, rnd integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'tiles', (select string_agg(coalesce(t.team, 0)::text, '' order by i)
      from generate_series(0, coalesce((select round(24 * coalesce((st.session #>> '{game,w}')::double precision, 1))::integer * 24 - 1
        from public.classlive_state st where st.room = target), 575)) i
      left join public.classlive_clash_tiles t on t.room = target and t.round = rnd and t.idx = i),
    'painted', coalesce((select jsonb_object_agg(p.player, p.painted) from public.classlive_clash_painted p where p.room = target), '{}'::jsonb))
$$;
