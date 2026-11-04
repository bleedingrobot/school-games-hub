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
-- 6. Sharing (stage S.8): the private picture bucket trader-gallery, trader_gallery (when each picture was drawn),
--    trader_stickers, the server's gallery and sticker calls, and teacher_trader_class_systems() for the projector tour.
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
-- Sharing (stage S.8, docs/TRADER-SYSTEM-PLAN.md section 7): the class gallery, stickers and the teacher's projector tour.
--
-- Gallery pictures: a 512 × 288 .webp (under 40 KB) drawn by the pupil's own browser and saved by the trader server
-- function in the private bucket trader-gallery at <player>.webp. The bucket has no policies, so only the server key
-- reaches it; the gallery gets short-lived signed links from the server function. trader_gallery notes when each was
-- drawn, so a picture is saved at most once every few minutes.
--
-- Stickers: one of six preset stickers per visitor per system per season (changed, never stacked). Classmates only:
-- the same school and the same class, never your own. The owner sees the counts, never who.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trader-gallery', 'trader-gallery', false, 40960, array['image/webp'])
on conflict (id) do nothing;

create table public.trader_gallery (
  player uuid primary key references public.profiles (id) on delete cascade,
  drawn_at timestamptz not null default now()
);

create table public.trader_stickers (
  -- The system's owner.
  player uuid not null references public.profiles (id) on delete cascade,
  visitor uuid not null references public.profiles (id) on delete cascade,
  season integer not null,
  sticker text not null check (sticker in ('wow', 'planets', 'life', 'tech', 'pretty', 'amazing')),
  updated_at timestamptz not null default now(),
  primary key (player, visitor, season),
  check (player <> visitor)
);
create index trader_stickers_by_visitor on public.trader_stickers (visitor);

alter table public.trader_gallery enable row level security;
alter table public.trader_stickers enable row level security;
revoke all on public.trader_gallery, public.trader_stickers from anon, authenticated;

-- A pupil who may be in the gallery: a student, not hidden, in a class.
create function public.trader_gallery_class(player uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_class_of(p.id) from public.profiles p
  where p.id = trader_gallery_class.player and p.role = 'student' and not p.hidden
$$;

-- The class gallery for one pupil: every classmate (same school, same class) with a built sun, and the pupil's own
-- system first. Each is { id, name (display name), design, mine, drawn (has a picture), stickers }: for the owner's own
-- system the count of each sticker (never who), for a classmate's the sticker this pupil gave it (or null).
-- A pupil in no class (or a teacher) sees only their own.
create function public.trader_gallery_list(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  my_class uuid := public.trader_gallery_class(player);
  my_school integer;
begin
  select p.school_id into my_school from public.profiles p where p.id = trader_gallery_list.player;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id,
             'name', p.display_name,
             'design', g.game -> 'system',
             'mine', p.id = trader_gallery_list.player,
             'drawn', exists (select 1 from public.trader_gallery d where d.player = p.id),
             'stickers', case when p.id = trader_gallery_list.player then
                 coalesce((select jsonb_object_agg(c.sticker, c.n) from (
                   select s.sticker, count(*) as n from public.trader_stickers s
                   where s.player = p.id and s.season = g.season group by s.sticker) c), '{}'::jsonb)
               else to_jsonb((select s.sticker from public.trader_stickers s
                   where s.player = p.id and s.visitor = trader_gallery_list.player and s.season = g.season)) end)
           order by p.id <> trader_gallery_list.player, lower(coalesce(g.game #>> '{system,label}', g.game #>> '{system,name}', '')), p.id)
    from public.trader_games g
    join public.profiles p on p.id = g.player
    where g.game #>> '{system,sun,built}' = 'true'
      and (p.id = trader_gallery_list.player
           or (my_class is not null and p.school_id = my_school and p.role = 'student' and not p.hidden
               and public.current_class_of(p.id) = my_class))), '[]'::jsonb);
end;
$$;

-- A visitor leaves (or changes, or with a null sticker takes back) their sticker on a classmate's system. Gives 'ok',
-- or why not: 'own' (your own system), 'class' (not a classmate), 'none' (no built sun to sticker).
create function public.trader_give_sticker(visitor uuid, owner uuid, sticker text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  season_ integer;
  visitor_class uuid := public.trader_gallery_class(visitor);
begin
  if sticker is not null and sticker not in ('wow', 'planets', 'life', 'tech', 'pretty', 'amazing') then
    raise exception 'Unknown sticker.' using errcode = '22023';
  end if;
  if visitor = owner then
    return 'own';
  end if;
  if visitor_class is null or public.trader_gallery_class(owner) is distinct from visitor_class
     or (select p.school_id from public.profiles p where p.id = visitor) is distinct from (select p.school_id from public.profiles p where p.id = owner) then
    return 'class';
  end if;
  select g.season into season_ from public.trader_games g where g.player = owner and g.game #>> '{system,sun,built}' = 'true';
  if season_ is null then
    return 'none';
  end if;
  if sticker is null then
    delete from public.trader_stickers s where s.player = owner and s.visitor = trader_give_sticker.visitor and s.season = season_;
  else
    insert into public.trader_stickers as s (player, visitor, season, sticker, updated_at)
    values (owner, visitor, season_, sticker, now())
    on conflict on constraint trader_stickers_pkey do update set sticker = excluded.sticker, updated_at = now();
  end if;
  return 'ok';
end;
$$;

-- Notes that a gallery picture is being saved now, if the last one was at least `gap` ago and the pupil has a built
-- sun. True if the picture may be saved.
create function public.trader_gallery_drawn(player uuid, gap interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  done boolean;
begin
  if not exists (select 1 from public.trader_games g where g.player = trader_gallery_drawn.player and g.game #>> '{system,sun,built}' = 'true') then
    return false;
  end if;
  insert into public.trader_gallery as d (player, drawn_at) values (trader_gallery_drawn.player, now())
  on conflict on constraint trader_gallery_pkey do update set drawn_at = now() where d.drawn_at <= now() - gap
  returning true into done;
  return coalesce(done, false);
end;
$$;

-- The teacher's projector tour: the systems with a built sun of the pupils in one of their classes (hidden pupils left
-- out). Only each system's design: the projector shows the system's own name, never a pupil's.
create function public.teacher_trader_class_systems(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(g.game -> 'system' order by md5(g.player::text || current_date::text))
    from public.class_members m
    join public.profiles p on p.id = m.student_id
    join public.trader_games g on g.player = m.student_id
    where m.class_id = target_class and p.role = 'student' and not p.hidden
      and g.game #>> '{system,sun,built}' = 'true'), '[]'::jsonb);
end;
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
  public.trader_season(uuid[]),
  public.trader_gallery_class(uuid),
  public.trader_gallery_list(uuid),
  public.trader_give_sticker(uuid, uuid, text),
  public.trader_gallery_drawn(uuid, interval),
  public.teacher_trader_class_systems(uuid)
from public, anon, authenticated;
grant execute on function public.teacher_set_trader_forge(boolean, uuid), public.teacher_set_trader_forge_typing(boolean, uuid), public.teacher_clear_trader_names(uuid), public.teacher_trader_class_systems(uuid) to authenticated;
grant execute on function public.trader_season_system(uuid), public.trader_choose_season(uuid, text, text, text), public.trader_gallery_list(uuid), public.trader_give_sticker(uuid, uuid, text), public.trader_gallery_drawn(uuid, interval) to service_role;
