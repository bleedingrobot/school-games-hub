-- Class Live: Ghost Tag's map is widescreen (26 Nov 2026 NZ: James asked for the map to fill the screen). Nothing is
-- deleted.
--
--   1. classlive_activities.width: how wide an activity's board is, in board heights (1 = square). Ghost Tag is 1.6
--      (GHOST_W in shared/classlive/ghost.ts); every other game stays square.
--   2. classlive_spots may hold x up to 2 (was 1.3).
--   3. classlive_move() clamps x to the activity's width. Otherwise exactly as in 20261125000800_classlive_activities.

alter table public.classlive_activities add column width double precision not null default 1 check (width >= 1 and width <= 2);
update public.classlive_activities set width = 1.6 where id = 'ghost';

alter table public.classlive_spots drop constraint classlive_spots_x_check;
alter table public.classlive_spots add constraint classlive_spots_x_check check (x >= 0 and x <= 2);

create or replace function public.classlive_move(target bigint, x double precision, y double precision)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  prev public.classlive_spots%rowtype;
  tps jsonb;
  tp jsonb;
  nx double precision;
  ny double precision;
  most double precision;
  gap double precision;
  ok boolean;
  max_speed double precision;
  wide double precision;
begin
  if me is null or x is null or y is null or x <> x or y <> y then
    return null;
  end if;
  select a.max_speed, a.width into max_speed, wide
  from public.classlive_rooms r
  join public.classlive_players p on p.room = r.id and p.player = me
  join public.classlive_activities a on a.id = r.activity and a.moves
  where r.id = target and r.state = 'live';
  if max_speed is null then
    return null;
  end if;
  nx := least(coalesce(wide, 1), greatest(0, x));
  ny := least(1, greatest(0, y));
  select * into prev from public.classlive_spots s where s.room = target and s.player = me;
  if found and now_ms - prev.at_ms < 150 then
    nx := null;
  elsif found then
    most := max_speed * least(5, greatest(0, now_ms - prev.at_ms) / 1000.0) + 0.05;
    gap := sqrt((nx - prev.x) ^ 2 + (ny - prev.y) ^ 2);
    if gap > most then
      ok := false;
      select st.session #> '{game,round,teleports}' into tps from public.classlive_state st where st.room = target;
      if jsonb_typeof(tps) = 'array' then
        for tp in select * from jsonb_array_elements(tps) loop
          if (sqrt((nx - (tp #>> '{a,x}')::float8) ^ 2 + (ny - (tp #>> '{a,y}')::float8) ^ 2) < 0.12
              and sqrt((prev.x - (tp #>> '{b,x}')::float8) ^ 2 + (prev.y - (tp #>> '{b,y}')::float8) ^ 2) < 0.15)
            or (sqrt((nx - (tp #>> '{b,x}')::float8) ^ 2 + (ny - (tp #>> '{b,y}')::float8) ^ 2) < 0.12
              and sqrt((prev.x - (tp #>> '{a,x}')::float8) ^ 2 + (prev.y - (tp #>> '{a,y}')::float8) ^ 2) < 0.15) then
            ok := true;
          end if;
        end loop;
      end if;
      if not ok then
        nx := prev.x + (nx - prev.x) * most / gap;
        ny := prev.y + (ny - prev.y) * most / gap;
      end if;
    end if;
  end if;
  if nx is not null then
    insert into public.classlive_spots (room, player, x, y, at_ms) values (target, me, nx, ny, now_ms)
    on conflict (room, player) do update set x = excluded.x, y = excluded.y, at_ms = excluded.at_ms;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_array(round(s.x::numeric, 4), round(s.y::numeric, 4))) from public.classlive_spots s where s.room = target), '[]'::jsonb);
end;
$$;
