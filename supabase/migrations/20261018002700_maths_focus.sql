-- Maths focus F.3: groups, teacher focuses that end by themselves, the students' own choice, and the class switch.
--
-- Every student has one focus at any moment (docs/MATHS-FOCUS-PLAN.md sections 4 and 8). The server decides it, with the
-- first of these that applies:
--   1. a running teacher focus for this student   2. one for the student's group   3. one for the student's class
--   4. the student's own choice, if the class lets students choose   5. auto
-- Rule 1, 2 or 3 simply stops matching when its end time passes: no timer or scheduled job. All times are New Zealand time
-- and come from the server's clock. Ended focuses are kept (never deleted) for "what we practised this term".
--
-- The tables are closed to the website; they are reached only through the functions below.

-- ---------------------------------------------------------------------------
-- The class switch: students may choose their own focus (on by default)
-- ---------------------------------------------------------------------------

-- A new class starts as a copy of its school's default row, so this reaches new classes too.
alter table public.app_settings add column students_choose_focus boolean not null default true;

-- The early-facts records have keys like "bond10:3+7" and "bond20:8+12": the part before the colon has digits in it,
-- which the old check ("letters only") refused. Every key that was allowed before still is.
alter table public.gem_keep_facts drop constraint gem_keep_facts_fact_key_check;
alter table public.gem_keep_facts add constraint gem_keep_facts_fact_key_check
  check (fact_key ~ '^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.maths_focuses (
  id uuid primary key default gen_random_uuid(),
  -- One "Set focus" press makes one row for each target; they share a batch so Extend and End now act on all of them.
  batch_id uuid not null,
  school_id integer not null references public.schools (id),
  class_id uuid not null references public.classes (id) on delete cascade,
  scope text not null check (scope in ('class', 'group', 'student')),
  group_id uuid references public.class_groups (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  -- Ladder skill ids ("tables-6-9"). The games ignore a name they do not know.
  skills text[] not null check (
    cardinality(skills) between 1 and 12 and array_to_string(skills, ',') ~ '^[a-z0-9-]{1,40}(,[a-z0-9-]{1,40}){0,11}$'
  ),
  only_these boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  -- "End now" sets this. The focus counts as over at the earlier of ends_at and ended_at.
  ended_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (scope = 'class' and group_id is null and student_id is null)
    or (scope = 'group' and group_id is not null and student_id is null)
    or (scope = 'student' and student_id is not null and group_id is null)
  )
);
create index maths_focuses_class on public.maths_focuses (class_id, ends_at desc);
create index maths_focuses_student on public.maths_focuses (student_id) where student_id is not null;
create index maths_focuses_group on public.maths_focuses (group_id) where group_id is not null;
create index maths_focuses_batch on public.maths_focuses (batch_id);

-- A student's own choice. Kept underneath teacher focuses and never overwritten by one.
create table public.student_maths_focus (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  skills text[] not null check (
    cardinality(skills) between 1 and 12 and array_to_string(skills, ',') ~ '^[a-z0-9-]{1,40}(,[a-z0-9-]{1,40}){0,11}$'
  ),
  only_these boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.maths_focuses enable row level security;
alter table public.student_maths_focus enable row level security;
revoke all on public.maths_focuses, public.student_maths_focus from anon, authenticated;

-- A focus belongs to a class: its group and student must be in that same class, in that school.
create function public.check_maths_focus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.classes c where c.id = new.class_id and c.school_id = new.school_id) then
    raise exception 'That class is not in this school.' using errcode = '42501';
  end if;
  if new.scope = 'group' and not exists (select 1 from public.class_groups g where g.id = new.group_id and g.class_id = new.class_id) then
    raise exception 'That group is not in this class.' using errcode = '42501';
  end if;
  if new.scope = 'student' and not exists (select 1 from public.class_members m where m.student_id = new.student_id and m.class_id = new.class_id) then
    raise exception 'That student is not in this class.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_maths_focus before insert on public.maths_focuses
for each row execute function public.check_maths_focus();

-- ---------------------------------------------------------------------------
-- When a focus ends (New Zealand time, the server's clock)
-- ---------------------------------------------------------------------------

-- lesson: 1 hour. today: midnight at the end of today. friday: midnight at the end of Friday (today, if it is Friday).
-- week: 7 days. custom: a time the teacher picks (in the future, no more than a year away).
-- Ending at midnight means practice at home after school still uses the focus.
create function public.focus_end(length text, custom timestamptz default null)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  nz_today date := (now() at time zone 'Pacific/Auckland')::date;
  weekday integer := extract(isodow from (now() at time zone 'Pacific/Auckland'));
begin
  case length
    when 'lesson' then return now() + interval '1 hour';
    when 'today' then return ((nz_today + 1)::timestamp) at time zone 'Pacific/Auckland';
    when 'friday' then return ((nz_today + ((5 - weekday + 7) % 7) + 1)::timestamp) at time zone 'Pacific/Auckland';
    when 'week' then return now() + interval '7 days';
    when 'custom' then
      if custom is null or custom <= now() + interval '1 minute' then
        raise exception 'Pick an end time that is still to come.' using errcode = '22023';
      end if;
      if custom > now() + interval '1 year' then
        raise exception 'A focus can run for a year at most.' using errcode = '22023';
      end if;
      return custom;
    else
      raise exception 'Pick how long the focus should last.' using errcode = '22023';
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Which focus a student has right now
-- ---------------------------------------------------------------------------

-- The decision, for one player. Used by the signed-in student (my_maths_focus) and by the game servers (service role).
-- source: teacher-student, teacher-group, teacher-class, student or auto.
create function public.maths_focus_of(player uuid)
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
      'endsAt', least(running.ends_at, coalesce(running.ended_at, running.ends_at)), 'canChoose', choose, 'own', own_json);
  end if;
  if choose and own.student_id is not null then
    return jsonb_build_object(
      'source', 'student', 'skills', to_jsonb(own.skills), 'onlyThese', own.only_these,
      'endsAt', null, 'canChoose', true, 'own', own_json);
  end if;
  return jsonb_build_object('source', 'auto', 'skills', '[]'::jsonb, 'onlyThese', false, 'endsAt', null, 'canChoose', choose, 'own', own_json);
end;
$$;

-- The signed-in student's focus. Games ask this; they never decide it themselves.
create function public.my_maths_focus()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select case when public.is_school_user() then public.maths_focus_of(auth.uid()) end $$;

-- ---------------------------------------------------------------------------
-- The student's own choice
-- ---------------------------------------------------------------------------

create function public.clean_focus_skills(skills text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  clean text[];
begin
  select coalesce(array_agg(s order by n), '{}') into clean
  from (select s, min(n) as n from unnest(skills) with ordinality as x(s, n) group by s) d;
  if cardinality(clean) < 1 or cardinality(clean) > 12 or array_to_string(clean, ',') !~ '^[a-z0-9-]{1,40}(,[a-z0-9-]{1,40}){0,11}$' then
    raise exception 'Pick at least one skill (up to 12).' using errcode = '22023';
  end if;
  return clean;
end;
$$;

-- Saved even while a teacher focus is running (it shows again when that ends). Refused when the class switch is off.
create function public.set_my_maths_focus(skills text[], only_these boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text[] := public.clean_focus_skills(skills);
  allowed boolean;
begin
  if not public.is_school_user() then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select coalesce(s.students_choose_focus, true) into allowed from public.settings_of(auth.uid()) s;
  if not coalesce(allowed, true) then
    raise exception 'Your teacher has turned off choosing your own maths focus.' using errcode = '42501';
  end if;
  insert into public.student_maths_focus (student_id, skills, only_these)
  values (auth.uid(), clean, coalesce(only_these, false))
  on conflict (student_id) do update set skills = excluded.skills, only_these = excluded.only_these, updated_at = now();
  return public.maths_focus_of(auth.uid());
end;
$$;

-- Back to auto.
create function public.clear_my_maths_focus()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from public.student_maths_focus where student_id = auth.uid();
  return public.maths_focus_of(auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Teachers: set, extend and end a focus
-- ---------------------------------------------------------------------------

-- scope 'class': the whole class (targets ignored). 'group': each group in targets. 'student': each student in targets.
-- Returns how many rows it made. A teacher can only use their own classes (a school admin: any class in the school).
create function public.teacher_set_maths_focus(
  target_class uuid,
  scope text,
  targets uuid[],
  skills text[],
  only_these boolean,
  length text,
  custom timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text[] := public.clean_focus_skills(skills);
  ends timestamptz;
  batch uuid := gen_random_uuid();
  wanted uuid[];
  made integer := 0;
  t uuid;
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if scope is null or scope not in ('class', 'group', 'student') then
    raise exception 'Pick the whole class, a group or some students.' using errcode = '22023';
  end if;
  ends := public.focus_end(length, custom);

  if scope = 'class' then
    insert into public.maths_focuses (batch_id, school_id, class_id, scope, skills, only_these, ends_at, created_by)
    select batch, c.school_id, c.id, 'class', clean, coalesce(only_these, false), ends, auth.uid()
    from public.classes c where c.id = target_class;
    return 1;
  end if;

  select coalesce(array_agg(distinct x), '{}') into wanted from unnest(coalesce(targets, '{}')) x;
  if cardinality(wanted) = 0 and scope = 'group' then
    raise exception 'Pick a group.' using errcode = '22023';
  elsif cardinality(wanted) = 0 then
    raise exception 'Pick at least one student.' using errcode = '22023';
  end if;
  if cardinality(wanted) > 60 then
    raise exception 'That is too many at once. Use the whole class or a group.' using errcode = '22023';
  end if;
  foreach t in array wanted loop
    if scope = 'group' then
      if not exists (select 1 from public.class_groups g where g.id = t and g.class_id = target_class) then
        raise exception 'That group isn''t in this class.' using errcode = '42501';
      end if;
      insert into public.maths_focuses (batch_id, school_id, class_id, scope, group_id, skills, only_these, ends_at, created_by)
      select batch, c.school_id, c.id, 'group', t, clean, coalesce(only_these, false), ends, auth.uid()
      from public.classes c where c.id = target_class;
    else
      if not exists (select 1 from public.class_members m where m.student_id = t and m.class_id = target_class) then
        raise exception 'That student isn''t in this class.' using errcode = '42501';
      end if;
      insert into public.maths_focuses (batch_id, school_id, class_id, scope, student_id, skills, only_these, ends_at, created_by)
      select batch, c.school_id, c.id, 'student', t, clean, coalesce(only_these, false), ends, auth.uid()
      from public.classes c where c.id = target_class;
    end if;
    made := made + 1;
  end loop;
  return made;
end;
$$;

-- Makes a running focus last longer (same choices as Set focus, counted from now). It has to end later than it does now.
create function public.teacher_extend_maths_focus(batch uuid, length text, custom timestamptz default null)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  ends timestamptz;
  classes uuid[];
  now_ends timestamptz;
begin
  perform public.require_teacher();
  select array_agg(distinct f.class_id), max(f.ends_at) into classes, now_ends
  from public.maths_focuses f
  where f.batch_id = batch and f.ended_at is null and f.ends_at > now();
  if classes is null then
    raise exception 'That focus has already ended.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(classes) c where not public.teaches_class(c)) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  ends := public.focus_end(length, custom);
  if ends <= now_ends then
    raise exception 'That is not longer than it already runs.' using errcode = '22023';
  end if;
  update public.maths_focuses set ends_at = ends where batch_id = batch and ended_at is null and ends_at > now();
  return ends;
end;
$$;

-- Stops a focus now. It stays in the history.
create function public.teacher_end_maths_focus(batch uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  ended integer;
begin
  perform public.require_teacher();
  if exists (select 1 from public.maths_focuses f where f.batch_id = batch and not public.teaches_class(f.class_id)) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  update public.maths_focuses f set ended_at = now() where f.batch_id = batch and f.ended_at is null and f.ends_at > now();
  get diagnostics ended = row_count;
  return ended;
end;
$$;

-- The focuses of one class (or of every class I teach), one entry for each "Set focus" press.
-- Running ones always; ended ones (newest 60) only when asked: that is the history.
create function public.teacher_maths_focuses(target_class uuid default null, include_ended boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_teacher();
  if target_class is not null and not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  with mine as (
    select f.*, least(f.ends_at, coalesce(f.ended_at, f.ends_at)) as over_at
    from public.maths_focuses f
    where f.school_id = public.my_school()
      and ((target_class is not null and f.class_id = target_class)
           or (target_class is null and f.class_id in (select public.my_classes())))
  ),
  batches as (
    select m.batch_id,
           min(m.class_id::text)::uuid as class_id,
           min(m.scope) as scope,
           min(m.skills::text)::text[] as skills,
           bool_or(m.only_these) as only_these,
           min(m.starts_at) as starts_at,
           max(m.over_at) as ends_at,
           min(m.created_at) as created_at,
           (max(m.over_at) > now()) as running
    from mine m
    group by m.batch_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'batch', b.batch_id, 'classId', b.class_id, 'className', c.name, 'scope', b.scope,
      'targets', (select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(m.group_id, m.student_id),
                    'name', coalesce(g.name, p.display_name)) order by coalesce(g.name, p.display_name)), '[]')
                  from mine m
                  left join public.class_groups g on g.id = m.group_id
                  left join public.profiles p on p.id = m.student_id
                  where m.batch_id = b.batch_id and m.scope <> 'class'),
      'skills', to_jsonb(b.skills), 'onlyThese', b.only_these,
      'startsAt', b.starts_at, 'endsAt', b.ends_at, 'createdAt', b.created_at,
      'status', case when b.running and b.starts_at <= now() then 'running' when b.running then 'later' else 'ended' end)
    order by b.running desc, b.created_at desc), '[]')
  into result
  from batches b
  join public.classes c on c.id = b.class_id
  where b.running or (include_ended and b.created_at >= (select min(x.created_at) from (
      select bb.created_at from batches bb where not bb.running order by bb.created_at desc limit 60) x));
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teachers: the switch, and reading a class's settings
-- ---------------------------------------------------------------------------

create function public.teacher_set_students_choose_focus(enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  update public.app_settings set students_choose_focus = coalesce(enabled, true)
  where id in (select public.settings_to_change(target_class));
end;
$$;

-- The settings of one class I teach (a school admin: also the school's default, when no class is given and they teach none).
-- The Teacher page's class picker reads this; students never can.
create function public.teacher_class_settings(target_class uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_teacher();
  if target_class is null then
    -- The same row a teacher without a picker has always seen: the first class they teach, else the school's default.
    select to_jsonb(s) into result from public.app_settings s where s.id = public.settings_id_of(auth.uid());
    return result;
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select to_jsonb(s) into result from public.app_settings s where s.class_id = target_class and s.school_id = public.my_school();
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Groups: rename (make, delete and fill already exist from F.2)
-- ---------------------------------------------------------------------------

create function public.teacher_rename_group(target uuid, group_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  in_class uuid := (select g.class_id from public.class_groups g where g.id = target);
begin
  perform public.require_teacher();
  if in_class is null or not public.teaches_class(in_class) then
    raise exception 'That isn''t one of your groups.' using errcode = '42501';
  end if;
  if group_name is null or group_name !~ '^[A-Za-zĀāĒēĪīŌōŪū0-9][A-Za-zĀāĒēĪīŌōŪū0-9 .''-]{0,29}$' then
    raise exception 'Group names can use letters, numbers and spaces, up to 30 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.class_groups g where g.class_id = in_class and g.name = group_name and g.id <> target) then
    raise exception 'This class already has a group with that name.' using errcode = '22023';
  end if;
  update public.class_groups set name = group_name where id = target;
end;
$$;

-- The class detail now also says which group each student is in by id (the page needs it to move them).
create or replace function public.teacher_class_detail(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_teacher();
  if not public.teaches_class(target, public.is_school_admin()) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'schoolYear', c.school_year, 'yearLevel', c.year_level,
    'archived', c.archived, 'warpCode', c.warp_code, 'warpMode', c.warp_mode,
    'members', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.display_name, 'realName', split_part(u.email, '@', 1), 'avatar', p.avatar,
        'hidden', p.hidden, 'joinedAt', m.joined_at,
        'group', (select g.name from public.class_group_members gm join public.class_groups g on g.id = gm.group_id
                  where gm.student_id = p.id and gm.class_id = c.id),
        'groupId', (select gm.group_id from public.class_group_members gm
                    where gm.student_id = p.id and gm.class_id = c.id))
        order by p.display_name), '[]')
      from public.class_members m
      join public.profiles p on p.id = m.student_id
      left join auth.users u on u.id = p.id
      where m.class_id = c.id),
    'groups', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', g.id, 'name', g.name, 'warpCode', g.warp_code, 'warpMode', g.warp_mode,
        'members', (select count(*) from public.class_group_members gm where gm.group_id = g.id)) order by g.name), '[]')
      from public.class_groups g where g.class_id = c.id),
    'teachers', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.teacher_id, 'name', p.display_name, 'realName', split_part(u.email, '@', 1)) order by u.email), '[]')
      from public.class_teachers t
      join public.profiles p on p.id = t.teacher_id
      left join auth.users u on u.id = p.id
      where t.class_id = c.id)
  ) into result
  from public.classes c where c.id = target;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- New classes are named from the teacher's email (the part before the @) and can be renamed
-- ---------------------------------------------------------------------------

-- "mr.teacher@school.nz" → "mr.teacher". Keeps to the characters class names allow, and adds " 2", " 3"... if that name is taken
-- this year. Teachers see this name on their own page; students see a class name only after typing a right code.
create function public.default_class_name(teacher uuid, in_year integer)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
  school integer := (select p.school_id from public.profiles p where p.id = teacher);
begin
  select split_part(u.email, '@', 1) into base from auth.users u where u.id = teacher;
  base := regexp_replace(coalesce(base, ''), '[^A-Za-zĀāĒēĪīŌōŪū0-9 .''-]', '-', 'g');
  base := regexp_replace(base, '^[^A-Za-zĀāĒēĪīŌōŪū0-9]+', '');
  base := left(base, 30);
  if base = '' then
    base := 'My class';
  end if;
  candidate := base;
  while exists (select 1 from public.classes c where c.school_id = school and c.school_year = in_year and c.name = candidate) loop
    n := n + 1;
    candidate := left(base, 30 - length(' ' || n)) || ' ' || n;
  end loop;
  return candidate;
end;
$$;

-- Same as before, except a blank name now means "use my email's name".
create or replace function public.teacher_create_class(class_name text, in_year integer, level integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  made uuid;
  chosen text := nullif(btrim(coalesce(class_name, '')), '');
begin
  perform public.require_teacher();
  if chosen is null then
    chosen := public.default_class_name(auth.uid(), in_year);
  end if;
  if chosen !~ '^[A-Za-zĀāĒēĪīŌōŪū0-9][A-Za-zĀāĒēĪīŌōŪū0-9 .''-]{0,29}$' then
    raise exception 'Class names can use letters, numbers and spaces, up to 30 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.classes c where c.school_id = public.my_school() and c.school_year = in_year and c.name = chosen) then
    raise exception 'You already have a class with that name this year.' using errcode = '22023';
  end if;
  insert into public.classes (school_id, name, school_year, year_level, warp_code, created_by)
  values (public.my_school(), chosen, in_year, level, public.new_warp_code(), auth.uid())
  returning id into made;
  insert into public.class_teachers (class_id, teacher_id) values (made, auth.uid());
  perform public.give_class_settings(made);
  return made;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gem Keep and Mission Control read the focus, so they need every record the ladder uses
-- ---------------------------------------------------------------------------

-- Everything Gem Keep needs when it opens. Now also: the records of the early-facts, adding and division packs (a focus can
-- ask for them), and the student's focus. Times-table records and the shape of everything else are unchanged.
create or replace function public.my_gem_keep()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user())
  select jsonb_build_object(
    'progress', (select coalesce(jsonb_agg(jsonb_build_object(
        'levelId', g.level_id, 'stars', g.best_stars, 'keyPassed', g.key_passed) order by g.level_id), '[]')
      from public.gem_keep_progress g where g.player = me.id),
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
        'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f
      where f.player = me.id and f.pack in ('times-tables', 'early-facts', 'add-sub', 'division')),
    'settings', public.gem_keep_settings(),
    'focus', public.maths_focus_of(me.id),
    'canImport', not exists (select 1 from public.gem_keep_imports i where i.player = me.id)
      and not exists (select 1 from public.gem_keep_progress g where g.player = me.id)
  )
  from me
$$;

-- Mission Control maths: the player's own records (all four packs), settings and focus.
create or replace function public.space_maths_context(player uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'facts', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
        'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
        'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
      from public.gem_keep_facts f
      where f.player = space_maths_context.player and f.pack in ('times-tables', 'early-facts', 'add-sub', 'division')),
    'settings', public.gem_keep_settings(player),
    'focus', public.maths_focus_of(player))
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

-- Supabase lets everyone (even a signed-out visitor) call a new function unless it is locked, so lock every function this
-- file made, then open the ones people may use. The ones this file only replaced keep the access they had.
revoke execute on function
  public.check_maths_focus(),
  public.focus_end(text, timestamptz),
  public.maths_focus_of(uuid),
  public.my_maths_focus(),
  public.clean_focus_skills(text[]),
  public.set_my_maths_focus(text[], boolean),
  public.clear_my_maths_focus(),
  public.teacher_set_maths_focus(uuid, text, uuid[], text[], boolean, text, timestamptz),
  public.teacher_extend_maths_focus(uuid, text, timestamptz),
  public.teacher_end_maths_focus(uuid),
  public.teacher_maths_focuses(uuid, boolean),
  public.teacher_set_students_choose_focus(boolean, uuid),
  public.teacher_class_settings(uuid),
  public.teacher_rename_group(uuid, text),
  public.default_class_name(uuid, integer)
from public, anon, authenticated;

grant execute on function
  public.my_maths_focus(),
  public.set_my_maths_focus(text[], boolean),
  public.clear_my_maths_focus(),
  public.teacher_set_maths_focus(uuid, text, uuid[], text[], boolean, text, timestamptz),
  public.teacher_extend_maths_focus(uuid, text, timestamptz),
  public.teacher_end_maths_focus(uuid),
  public.teacher_maths_focuses(uuid, boolean),
  public.teacher_set_students_choose_focus(boolean, uuid),
  public.teacher_class_settings(uuid),
  public.teacher_rename_group(uuid, text)
to authenticated;
-- The game servers (service role) ask for anyone's focus. The helpers (focus_end, clean_focus_skills, default_class_name,
-- check_maths_focus) are only ever called from inside the functions above.
grant execute on function public.maths_focus_of(uuid) to service_role;
