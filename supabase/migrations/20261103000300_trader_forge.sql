-- Star Trader: the Star Forge (docs/TRADER-SYSTEM-PLAN.md, sections 1.2 and 10). NOT LIVE: this number is in
-- supabase/migrations-on-hold.txt until the Forge is ready.
--
-- Builds on 20261031000100_trader.sql and 20261031000200_trader_market.sql. Nothing here re-creates a shared function;
-- trader_season() is the trader's own hook function (a create or replace of its own latest version, which keeps
-- everything it did before).
--
-- 1. The teacher's switch: app_settings.trader_forge (OFF to start, per class) and teacher_set_trader_forge().
-- 2. trader_systems: one row per pupil, the system a pupil built last season, waiting for their choice at the start of
--    this season (keep it, or save a picture and start fresh with the ship and credits they ended on).
-- 3. trader_system_pictures: the profile album (the table only; the picture upload to storage is a later step).
-- 4. trader_season(): before the games are cleared, every game with a built sun is copied into trader_systems as
--    'pending'. Everything else the hook did stays.
-- 5. trader_season_system() and trader_choose_season(): the two calls the trader server function makes.
--
-- Star Makers: the Moon Owners list (trader_moons) is kept. The server function now passes "owns a moon or a built
-- sun" as trader_save's new_moon flag, so the first build of a sun adds the pupil to the list in the same step as the
-- save, exactly as buying the moon did. trader_games.moon therefore means "on the Star Makers list".

alter table public.app_settings add column trader_forge boolean not null default false;
-- Pupils may type names for their sun, planets and system (on by default); off means word lists only.
alter table public.app_settings add column trader_forge_typing boolean not null default true;

create function public.teacher_set_trader_forge(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Star Trader setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set trader_forge = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

create function public.teacher_set_trader_forge_typing(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null then
    raise exception 'Unknown Star Trader setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set trader_forge_typing = enabled where id in (select public.settings_to_change(target_class));
end;
$$;

create function public.trader_strip_labels(d jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(d) is distinct from 'object' then d else
    (d - 'label')
    || case when jsonb_typeof(d -> 'sun') = 'object' then jsonb_build_object('sun', (d -> 'sun') - 'label') else '{}'::jsonb end
    || case when jsonb_typeof(d -> 'planets') = 'array' then jsonb_build_object('planets',
         (select coalesce(jsonb_agg(case when jsonb_typeof(p) = 'object' then p - 'label' else p end order by n), '[]'::jsonb)
          from jsonb_array_elements(d -> 'planets') with ordinality as t(p, n))) else '{}'::jsonb end
  end
$$;

-- A teacher clears the names a pupil typed in the Forge (every "label" on the sun, planets and system), this season's game
-- and the system waiting for their choice. The word-list names stay.
create function public.teacher_clear_trader_names(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(target);
  update public.trader_games g
  set game = jsonb_set(g.game, '{system}', public.trader_strip_labels(g.game -> 'system')),
      version = g.version + 1
  where g.player = target and jsonb_typeof(g.game -> 'system') = 'object';
  update public.trader_systems s
  set design = public.trader_strip_labels(s.design)
  where s.player = target and jsonb_typeof(s.design) = 'object';
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables (closed to pupils)
-- ---------------------------------------------------------------------------

create table public.trader_systems (
  player uuid primary key references public.profiles (id) on delete cascade,
  school_id integer references public.schools (id) on delete set null,
  -- The season the system was saved from.
  season integer not null,
  -- The pupil's system (shared/trader/system.ts, SystemDesign) as it stood at the end of that season.
  design jsonb not null check (pg_column_size(design) < 40000),
  -- What the pupil ended on: { ship, credits, weapons, shields, pods }.
  carry jsonb not null,
  -- 'pending' until the pupil chooses: keep the system (and restart the ship) or start fresh (and keep the ship and credits).
  choice text not null default 'pending' check (choice in ('pending', 'keep', 'fresh')),
  updated_at timestamptz not null default now()
);
create index trader_systems_by_school on public.trader_systems (school_id, season);

create table public.trader_system_pictures (
  id bigserial primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  season integer not null,
  name text not null check (length(name) between 1 and 80),
  path text not null check (length(path) between 1 and 200),
  created_at timestamptz not null default now()
);
create index trader_system_pictures_by_player on public.trader_system_pictures (player, created_at desc);

alter table public.trader_systems enable row level security;
alter table public.trader_system_pictures enable row level security;
revoke all on public.trader_systems, public.trader_system_pictures from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The server function's own database functions
-- ---------------------------------------------------------------------------

-- A system waiting for its owner's choice: { season, design, carry }, or null.
create function public.trader_season_system(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('season', s.season, 'design', s.design, 'carry', s.carry)
  from public.trader_systems s where s.player = trader_season_system.player and s.choice = 'pending'
$$;

-- Records the choice, once. 'fresh' with a picture path also adds the picture to the profile album. True if there was a
-- pending choice to record.
create function public.trader_choose_season(player uuid, choice text, picture_path text default null, picture_name text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_ public.trader_systems;
begin
  perform public.gem_keep_check_player(player);
  if choice is null or choice not in ('keep', 'fresh') then
    raise exception 'Unknown choice.' using errcode = '22023';
  end if;
  update public.trader_systems s set choice = trader_choose_season.choice, updated_at = now()
  where s.player = trader_choose_season.player and s.choice = 'pending'
  returning * into row_;
  if row_.player is null then
    return false;
  end if;
  if choice = 'fresh' and picture_path is not null and length(picture_path) between 1 and 200 then
    insert into public.trader_system_pictures (player, season, name, path)
    values (player, row_.season, left(coalesce(nullif(picture_name, ''), 'My system'), 80), picture_path);
  end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- The New Season hook: as in the market migration (clear the games, days, requests, market and news; a new galaxy for
-- each affected school), and first copy every game with a built sun into trader_systems, waiting for its choice.
-- ---------------------------------------------------------------------------

create or replace function public.trader_season(players uuid[])
returns void
language sql
set search_path = ''
as $$
  with schools as (
    select distinct p.school_id from public.profiles p where p.id = any (players) and p.school_id is not null
  ),
  kept as (
    insert into public.trader_systems (player, school_id, season, design, carry, choice, updated_at)
    select g.player, g.school_id, g.season, g.game -> 'system',
           jsonb_build_object(
             'ship', coalesce(g.game #> '{t,ship}', '0'::jsonb),
             'credits', coalesce(g.game #> '{t,credits}', '0'::jsonb),
             'weapons', coalesce(g.game #> '{t,weapons}', '[]'::jsonb),
             'shields', coalesce(g.game #> '{t,shields}', '[]'::jsonb),
             'pods', coalesce(g.game #> '{t,pods}', '0'::jsonb)),
           'pending', now()
    from public.trader_games g
    where g.player = any (players) and g.game #>> '{system,sun,built}' = 'true'
    on conflict (player) do update
    set school_id = excluded.school_id, season = excluded.season, design = excluded.design, carry = excluded.carry,
        choice = 'pending', updated_at = now()
  ),
  a as (delete from public.trader_games where player = any (players)),
  b as (delete from public.trader_days where player = any (players)),
  c as (delete from public.trader_requests where player = any (players)),
  d as (delete from public.trader_markets where school_id in (select school_id from schools)),
  e as (delete from public.trader_news where school_id in (select school_id from schools))
  update public.trader_schools s
  set season = s.season + 1,
      seed = 'galaxy-' || substr(md5(random()::text || clock_timestamp()::text || s.school_id::text), 1, 10),
      started_at = now()
  where s.school_id in (select school_id from schools)
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_set_trader_forge(boolean, uuid),
  public.teacher_set_trader_forge_typing(boolean, uuid),
  public.teacher_clear_trader_names(uuid),
  public.trader_strip_labels(jsonb),
  public.trader_season_system(uuid),
  public.trader_choose_season(uuid, text, text, text),
  public.trader_season(uuid[])
from public, anon, authenticated;
grant execute on function public.teacher_set_trader_forge(boolean, uuid), public.teacher_set_trader_forge_typing(boolean, uuid), public.teacher_clear_trader_names(uuid) to authenticated;
grant execute on function public.trader_season_system(uuid), public.trader_choose_season(uuid, text, text, text) to service_role;
