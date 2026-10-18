-- Maths focus F.4: auto over the whole ladder, a place that never goes backwards, and the placement check.
--
-- (docs/MATHS-FOCUS-PLAN.md sections 5 and 5b.) Three small things in the database:
--   * a class switch, "Games pick the maths (auto) when there is no focus", off by default: with it off nothing changes;
--   * each student's furthest place on the ladder, written only by the answer-saving server functions and only ever forward;
--   * the placement check's result (where to start), written once.
-- The database cannot see the ladder (it lives in the shared maths code), so the server functions work the place out and the
-- database only refuses to let it go back, or to be written by anyone else. Both tables are closed to the website.

-- ---------------------------------------------------------------------------
-- The class switch (a new class copies its school's row, so this reaches new classes too)
-- ---------------------------------------------------------------------------

alter table public.app_settings add column maths_auto boolean not null default false;

-- ---------------------------------------------------------------------------
-- Furthest place, and placement
-- ---------------------------------------------------------------------------

-- `rank` is the skill's position on the whole ladder when it was saved; `skill` is its name. Only the server functions write here.
create table public.ladder_places (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  skill text not null check (skill ~ '^[a-z0-9-]{1,40}$'),
  rank integer not null check (rank between 0 and 200),
  updated_at timestamptz not null default now()
);

-- Where the placement check said to start. Stored once: a skipped check is stored too, so nobody is asked again.
create table public.ladder_placements (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  skill text check (skill is null or skill ~ '^[a-z0-9-]{1,40}$'),
  skipped boolean not null default false,
  created_at timestamptz not null default now(),
  check (skipped = (skill is null))
);

alter table public.ladder_places enable row level security;
alter table public.ladder_placements enable row level security;
revoke all on public.ladder_places, public.ladder_placements from anon, authenticated;

-- The furthest place can only move forward, even if something with the server's key tries to move it back.
create function public.check_ladder_place()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.student_id <> old.student_id then
    raise exception 'A ladder place belongs to one student.' using errcode = '22023';
  end if;
  if new.rank < old.rank then
    raise exception 'A place on the ladder never moves back.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger check_ladder_place before update on public.ladder_places
  for each row execute function public.check_ladder_place();

create function public.check_ladder_placement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A placement is stored once.' using errcode = '22023';
end;
$$;
create trigger check_ladder_placement before update on public.ladder_placements
  for each row execute function public.check_ladder_placement();

-- Moves the furthest place forward. Returns true when it moved; a place that is not further changes nothing.
create function public.record_ladder_place(player uuid, skill text, rank integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  moved integer;
begin
  if skill is null or rank is null then
    raise exception 'A place needs a skill and a rank.' using errcode = '22023';
  end if;
  insert into public.ladder_places as p (student_id, skill, rank) values (player, skill, rank)
  on conflict (student_id) do update set skill = excluded.skill, rank = excluded.rank, updated_at = now()
  where p.rank < excluded.rank;
  get diagnostics moved = row_count;
  return moved > 0;
end;
$$;

-- Stores the placement, once. Returns false when there already was one (nothing changes).
create function public.record_placement(player uuid, start_skill text, was_skipped boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  added integer;
begin
  insert into public.ladder_placements (student_id, skill, skipped)
  values (player, case when coalesce(was_skipped, false) then null else start_skill end, coalesce(was_skipped, false))
  on conflict (student_id) do nothing;
  get diagnostics added = row_count;
  return added > 0;
end;
$$;

-- What a game needs to know about a student's ladder: is auto on for their class, their class's year level, the placement,
-- and the furthest place. Part of the focus, so it reaches Gem Keep, Mission Control and the home page the way the focus does.
create function public.ladder_info(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'on', coalesce((select s.maths_auto from public.settings_of(player) s), false),
    'yearLevel', (select c.year_level from public.classes c where c.id = public.current_class_of(player)),
    'placed', (select case when p.skipped then 'skipped' else 'done' end from public.ladder_placements p where p.student_id = player),
    'placement', (select p.skill from public.ladder_placements p where p.student_id = player),
    'furthest', (select f.skill from public.ladder_places f where f.student_id = player))
$$;

-- ---------------------------------------------------------------------------
-- The focus now carries the ladder
-- ---------------------------------------------------------------------------

create or replace function public.maths_focus_of(player uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cls uuid := public.current_class_of(player);
  choose boolean;
  own public.student_maths_focus;
  running public.maths_focuses;
  own_json jsonb;
  ladder_json jsonb := public.ladder_info(player);
begin
  -- A student with no class gets the school default (settings_of already knows how); no row means "allowed".
  select coalesce(s.students_choose_focus, true) into choose from public.settings_of(player) s;
  choose := coalesce(choose, true);
  select * into own from public.student_maths_focus o where o.student_id = player;
  own_json := case when own.student_id is null then null
                   else jsonb_build_object('skills', to_jsonb(own.skills), 'onlyThese', own.only_these) end;

  if cls is not null then
    -- A teacher focus only counts while it is running, and only in the class it was made for.
    select * into running from public.maths_focuses f
    where f.class_id = cls
      and f.starts_at <= now()
      and least(f.ends_at, coalesce(f.ended_at, 'infinity')) > now()
      and (f.scope = 'class'
           or (f.scope = 'student' and f.student_id = player)
           or (f.scope = 'group' and exists (
                 select 1 from public.class_group_members gm where gm.group_id = f.group_id and gm.student_id = player)))
    order by case f.scope when 'student' then 1 when 'group' then 2 else 3 end, f.starts_at desc, f.id
    limit 1;
  end if;

  if running.id is not null then
    return jsonb_build_object(
      'source', 'teacher-' || running.scope, 'skills', to_jsonb(running.skills), 'onlyThese', running.only_these,
      'endsAt', least(running.ends_at, coalesce(running.ended_at, running.ends_at)), 'canChoose', choose, 'own', own_json, 'ladder', ladder_json);
  end if;
  if choose and own.student_id is not null then
    return jsonb_build_object(
      'source', 'student', 'skills', to_jsonb(own.skills), 'onlyThese', own.only_these,
      'endsAt', null, 'canChoose', true, 'own', own_json, 'ladder', ladder_json);
  end if;
  return jsonb_build_object('source', 'auto', 'skills', '[]'::jsonb, 'onlyThese', false, 'endsAt', null, 'canChoose', choose, 'own', own_json, 'ladder', ladder_json);
end;
$$;


-- ---------------------------------------------------------------------------
-- The home page's path: my records, my settings and my focus (with the ladder), all in one
-- ---------------------------------------------------------------------------

create function public.my_ladder()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select case when public.is_school_user() then public.space_maths_context(auth.uid()) end $$;

-- ---------------------------------------------------------------------------
-- Teachers: the class switch
-- ---------------------------------------------------------------------------

create function public.teacher_set_maths_auto(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  update public.app_settings set maths_auto = coalesce(enabled, false)
  where id in (select public.settings_to_change(target_class));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.check_ladder_place(),
  public.check_ladder_placement(),
  public.record_ladder_place(uuid, text, integer),
  public.record_placement(uuid, text, boolean),
  public.ladder_info(uuid),
  public.my_ladder(),
  public.teacher_set_maths_auto(boolean, uuid)
from public, anon, authenticated;

grant execute on function public.my_ladder(), public.teacher_set_maths_auto(boolean, uuid) to authenticated;
-- Only the server functions (service role) write a place or a placement, and read anyone's ladder facts.
grant execute on function public.record_ladder_place(uuid, text, integer), public.record_placement(uuid, text, boolean), public.ladder_info(uuid) to service_role;
