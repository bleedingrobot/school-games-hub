-- Maths focus F.2, part 2 of 3: classes, groups, Class Warp and settings per class.
--
-- New tables (all closed: the website reaches them only through the functions below):
--   classes, class_teachers, class_members, class_groups, class_group_members,
--   warp_requests, warp_tries, class_events.
-- app_settings stops being one school-wide row: it holds one default row per school
-- (class_id is null) and one row per class. Each person reads only the row that applies to
-- them (their class's, or their school's default when they have no class).
--
-- Douglas Park is moved over here: a default class "Everyone" holds every current student,
-- every current teacher teaches it, and its settings are today's settings. Nothing that a
-- Douglas Park teacher or student sees changes on the day this goes live.

-- ---------------------------------------------------------------------------
-- Warp codes: made the same way as game codes (shared/multiplayer.ts: no vowels, no lookalikes)
-- ---------------------------------------------------------------------------

create function public.new_warp_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'CDFGHJKMNPQRTVWXY34679';
  code text;
  attempts integer := 0;
begin
  loop
    code := '';
    for i in 1..5 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    -- One code is only ever one class or one group.
    exit when not exists (select 1 from public.classes c where c.warp_code = code)
          and not exists (select 1 from public.class_groups g where g.warp_code = code);
    attempts := attempts + 1;
    if attempts > 100 then
      raise exception 'Could not make a free code.';
    end if;
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Classes, teachers, members
-- ---------------------------------------------------------------------------

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id integer not null references public.schools (id),
  -- Typed by teachers only ("Room 12"). Letters, numbers and a few marks: no sentences, no emails.
  name text not null check (name ~ '^[A-Za-zĀāĒēĪīŌōŪū0-9][A-Za-zĀāĒēĪīŌōŪū0-9 .''-]{0,29}$'),
  school_year integer not null check (school_year between 2020 and 2100),
  year_level integer check (year_level between 0 and 13),
  archived boolean not null default false,
  archived_at timestamptz,
  warp_code text not null unique check (warp_code ~ '^[CDFGHJKMNPQRTVWXY34679]{5}$'),
  -- on: anyone with the code joins. ask: the student waits for a teacher. off: the code does nothing.
  warp_mode text not null default 'on' check (warp_mode in ('on', 'ask', 'off')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_id, school_year, name)
);
create index classes_school on public.classes (school_id);

create table public.class_teachers (
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  primary key (class_id, teacher_id)
);
create index class_teachers_teacher on public.class_teachers (teacher_id);

-- One current class per student: moving a student just changes this row.
create table public.class_members (
  student_id uuid primary key references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  joined_at timestamptz not null default now(),
  how text not null default 'warp' check (how in ('warp', 'teacher', 'approved', 'start'))
);
create index class_members_class on public.class_members (class_id);

create table public.class_groups (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null check (name ~ '^[A-Za-zĀāĒēĪīŌōŪū0-9][A-Za-zĀāĒēĪīŌōŪū0-9 .''-]{0,29}$'),
  warp_code text not null unique check (warp_code ~ '^[CDFGHJKMNPQRTVWXY34679]{5}$'),
  warp_mode text not null default 'on' check (warp_mode in ('on', 'ask', 'off')),
  created_at timestamptz not null default now(),
  unique (class_id, name)
);

-- A student is in at most one group per class (class_id is repeated here to say so).
create table public.class_group_members (
  group_id uuid not null references public.class_groups (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, student_id),
  unique (class_id, student_id)
);
create index class_group_members_student on public.class_group_members (student_id);

-- A student asking to join a class or group whose code is set to "ask first".
create table public.warp_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  group_id uuid references public.class_groups (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz
);
-- A student waits on one request at a time.
create unique index warp_requests_one_pending on public.warp_requests (student_id) where status = 'pending';
create index warp_requests_class on public.warp_requests (class_id) where status = 'pending';

-- Wrong codes, so a student can't try codes in bulk. Right codes are never recorded here.
create table public.warp_tries (
  student_id uuid not null references public.profiles (id) on delete cascade,
  at timestamptz not null default now()
);
create index warp_tries_student on public.warp_tries (student_id, at);

-- What teachers see "as it happens": who joined which class or group. Names only come from profiles.
create table public.class_events (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  group_id uuid references public.class_groups (id) on delete set null,
  student_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('joined', 'joined-group', 'added', 'moved-in', 'moved-out', 'removed', 'asked', 'declined')),
  at timestamptz not null default now()
);
create index class_events_class on public.class_events (class_id, at desc);

alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.class_members enable row level security;
alter table public.class_groups enable row level security;
alter table public.class_group_members enable row level security;
alter table public.warp_requests enable row level security;
alter table public.warp_tries enable row level security;
alter table public.class_events enable row level security;
revoke all on public.classes, public.class_teachers, public.class_members, public.class_groups,
  public.class_group_members, public.warp_requests, public.warp_tries, public.class_events
from anon, authenticated;

-- A student can only be in a class of their own school, and only students are members.
create function public.check_class_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p join public.classes c on c.id = new.class_id
    where p.id = new.student_id and p.role = 'student' and p.school_id = c.school_id
  ) then
    raise exception 'A class only holds students from its own school.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_class_member before insert or update on public.class_members
for each row execute function public.check_class_member();

create function public.check_class_teacher()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p join public.classes c on c.id = new.class_id
    where p.id = new.teacher_id and p.role = 'teacher' and p.school_id = c.school_id
  ) then
    raise exception 'Only teachers from the same school can teach a class.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_class_teacher before insert or update on public.class_teachers
for each row execute function public.check_class_teacher();

-- A group member must be in the group's class.
create function public.check_group_member()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.class_groups g
    join public.class_members m on m.class_id = g.class_id
    where g.id = new.group_id and g.class_id = new.class_id and m.student_id = new.student_id
  ) then
    raise exception 'A group only holds students from its own class.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger check_group_member before insert or update on public.class_group_members
for each row execute function public.check_group_member();

-- When a student changes class, the groups of the old class let go of them.
create function public.drop_old_groups()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or new.class_id is distinct from old.class_id then
    delete from public.class_group_members gm where gm.student_id = old.student_id and gm.class_id = old.class_id;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger drop_old_groups after update or delete on public.class_members
for each row execute function public.drop_old_groups();

-- A school can name one class that every new student and teacher joins by themselves (Douglas Park:
-- "Everyone"). That keeps a school with no classes set up working like before. The school admin
-- turns it off (school_set_default_class with no class) once real classes exist.
alter table public.schools add column default_class uuid references public.classes (id) on delete set null;

create function public.join_default_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  home uuid := (select s.default_class from public.schools s where s.id = new.school_id);
begin
  if home is null or exists (select 1 from public.classes c where c.id = home and c.archived) then
    return new;
  end if;
  if new.role = 'student' then
    insert into public.class_members (student_id, class_id, how) values (new.id, home, 'start') on conflict do nothing;
  elsif new.role = 'teacher' then
    insert into public.class_teachers (class_id, teacher_id) values (home, new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger join_default_class after insert on public.profiles
for each row execute function public.join_default_class();

-- A role changed directly (not through teacher_set_role): classes follow the role.
create function public.profile_role_classes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'teacher' then
    delete from public.class_members where student_id = new.id;
    delete from public.class_group_members where student_id = new.id;
    insert into public.class_teachers (class_id, teacher_id)
    select s.default_class, new.id from public.schools s
    where s.id = new.school_id and s.default_class is not null
      and exists (select 1 from public.classes c where c.id = s.default_class and not c.archived)
    on conflict do nothing;
  else
    delete from public.class_teachers where teacher_id = new.id;
  end if;
  return new;
end;
$$;
create trigger profile_role_classes after update of role on public.profiles
for each row when (old.role is distinct from new.role) execute function public.profile_role_classes();

-- ---------------------------------------------------------------------------
-- Settings per class. app_settings keeps its name and columns; it now has many rows.
-- ---------------------------------------------------------------------------

alter table public.app_settings drop constraint app_settings_id_check;
alter table public.app_settings drop constraint app_settings_pkey;
alter table public.app_settings drop column id;
alter table public.app_settings add column id uuid not null default gen_random_uuid() primary key;
alter table public.app_settings add column school_id integer references public.schools (id);
update public.app_settings set school_id = 1;
alter table public.app_settings alter column school_id set not null;
alter table public.app_settings add column class_id uuid references public.classes (id) on delete cascade;
-- One default row per school, and at most one row per class.
create unique index app_settings_school_default on public.app_settings (school_id) where class_id is null;
create unique index app_settings_class on public.app_settings (class_id) where class_id is not null;

-- A new school starts with the standard settings.
create function public.give_school_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_settings (school_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger give_school_settings after insert on public.schools
for each row execute function public.give_school_settings();

-- A new class starts with a copy of its school's default row (works for settings added later too).
create function public.give_class_settings(new_class uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.app_settings
  select (jsonb_populate_record(
    null::public.app_settings,
    to_jsonb(d) || jsonb_build_object('id', gen_random_uuid(), 'class_id', c.id)
  )).*
  from public.classes c
  join public.app_settings d on d.school_id = c.school_id and d.class_id is null
  where c.id = new_class
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who is in which class, and who may see whom
-- ---------------------------------------------------------------------------

-- The class a player is in right now (not an archived one), or null.
create function public.current_class_of(player uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.class_id from public.class_members m join public.classes c on c.id = m.class_id
  where m.student_id = player and not c.archived
$$;

-- The settings row that applies to a player: their class's, or for a teacher the first class they
-- teach, or their school's default. (Students with no class get the school default.)
create function public.settings_id_of(player uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.id from public.app_settings s where s.class_id = public.current_class_of(player)),
    (select s.id from public.app_settings s
     join public.class_teachers t on t.class_id = s.class_id
     join public.classes c on c.id = t.class_id
     where t.teacher_id = player and not c.archived
     order by c.created_at, c.id limit 1),
    (select s.id from public.app_settings s join public.profiles p on p.school_id = s.school_id
     where p.id = player and s.class_id is null)
  )
$$;

create function public.settings_of(player uuid)
returns setof public.app_settings
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.app_settings s where s.id = public.settings_id_of(player)
$$;

create function public.my_settings_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select case when public.is_school_user() then public.settings_id_of(auth.uid()) end $$;

drop policy "School users can read the settings" on public.app_settings;
create policy "School users can read the settings that apply to them"
on public.app_settings for select to authenticated
using (public.is_school_user() and id = (select public.my_settings_id()));

-- Classes I teach (a school admin: every class in the school). Archived ones only when asked.
create function public.my_classes(include_archived boolean default false)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.classes c
  where public.is_teacher()
    and c.school_id = public.my_school()
    and (include_archived or not c.archived)
    and (public.is_school_admin()
         or exists (select 1 from public.class_teachers t where t.class_id = c.id and t.teacher_id = auth.uid()))
$$;

create function public.teaches_class(target uuid, include_archived boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select target in (select public.my_classes(include_archived)) $$;

-- The students a teacher may see: those in their classes. A school admin: every student in the school.
create function public.my_students()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where public.is_teacher() and p.school_id = public.my_school() and p.role = 'student' and public.is_school_admin()
  union
  select m.student_id from public.class_members m
  where m.class_id in (select public.my_classes())
$$;

create function public.can_manage_student(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select student in (select public.my_students()) $$;

create function public.require_teacher_of(student uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if not public.can_manage_student(student) then
    raise exception 'That player isn''t in one of your classes.' using errcode = '42501';
  end if;
end;
$$;

-- Hidden profiles are still visible to the teachers of that student (and to a school admin).
drop policy "School users can see profiles in their own school" on public.profiles;
create policy "School users can see profiles in their own school"
on public.profiles for select to authenticated
using (
  public.is_school_user()
  and school_id = (select public.my_school())
  and (not hidden or id = auth.uid() or public.can_manage_student(id))
);

-- ---------------------------------------------------------------------------
-- Douglas Park moves in: the default class "Everyone"
-- ---------------------------------------------------------------------------

do $$
declare
  everyone uuid;
begin
  insert into public.classes (school_id, name, school_year, warp_code, warp_mode)
  values (1, 'Everyone', extract(year from now())::integer, public.new_warp_code(), 'off')
  returning id into everyone;
  -- Its code is off, so nothing changes for a student until a teacher decides.
  insert into public.class_members (student_id, class_id, how)
  select p.id, everyone, 'start' from public.profiles p where p.school_id = 1 and p.role = 'student';
  insert into public.class_teachers (class_id, teacher_id)
  select everyone, p.id from public.profiles p where p.school_id = 1 and p.role = 'teacher';
  perform public.give_class_settings(everyone);
  update public.schools set default_class = everyone where id = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teachers: look after classes
-- ---------------------------------------------------------------------------

create function public.log_class_event(target_class uuid, student uuid, event text, target_group uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.class_events (class_id, group_id, student_id, kind) values (target_class, target_group, student, event)
$$;

create function public.teacher_create_class(class_name text, in_year integer, level integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  made uuid;
begin
  perform public.require_teacher();
  if class_name is null or class_name !~ '^[A-Za-zĀāĒēĪīŌōŪū0-9][A-Za-zĀāĒēĪīŌōŪū0-9 .''-]{0,29}$' then
    raise exception 'Class names can use letters, numbers and spaces, up to 30 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.classes c where c.school_id = public.my_school() and c.school_year = in_year and c.name = class_name) then
    raise exception 'You already have a class with that name this year.' using errcode = '22023';
  end if;
  insert into public.classes (school_id, name, school_year, year_level, warp_code, created_by)
  values (public.my_school(), class_name, in_year, level, public.new_warp_code(), auth.uid())
  returning id into made;
  insert into public.class_teachers (class_id, teacher_id) values (made, auth.uid());
  perform public.give_class_settings(made);
  return made;
end;
$$;

create function public.teacher_update_class(target uuid, class_name text, in_year integer, level integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if not public.teaches_class(target) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if class_name is null or class_name !~ '^[A-Za-zĀāĒēĪīŌōŪū0-9][A-Za-zĀāĒēĪīŌōŪū0-9 .''-]{0,29}$' then
    raise exception 'Class names can use letters, numbers and spaces, up to 30 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.classes c
             where c.school_id = public.my_school() and c.school_year = in_year and c.name = class_name and c.id <> target) then
    raise exception 'You already have a class with that name this year.' using errcode = '22023';
  end if;
  update public.classes set name = class_name, school_year = in_year, year_level = level where id = target;
end;
$$;

-- Archive (or bring back) a class: school admin only. Members, records and settings are kept;
-- the class drops off teachers' lists and its code stops working.
create function public.teacher_archive_class(target uuid, archive boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  update public.classes set archived = archive, archived_at = case when archive then now() end
  where id = target and school_id = public.my_school();
  if not found then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
end;
$$;

-- My classes, newest first.
create function public.teacher_classes(include_archived boolean default false)
returns table(id uuid, name text, school_year integer, year_level integer, archived boolean, warp_code text,
              warp_mode text, members integer, teaching boolean, groups integer, waiting integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select c.id, c.name, c.school_year, c.year_level, c.archived, c.warp_code, c.warp_mode,
         (select count(*)::integer from public.class_members m where m.class_id = c.id),
         exists (select 1 from public.class_teachers t where t.class_id = c.id and t.teacher_id = auth.uid()),
         (select count(*)::integer from public.class_groups g where g.class_id = c.id),
         (select count(*)::integer from public.warp_requests r
          where r.class_id = c.id and r.status = 'pending' and r.created_at > now() - interval '7 days')
  from public.classes c
  where c.id in (select public.my_classes(include_archived))
  order by c.archived, c.school_year desc, c.name;
end;
$$;

-- Everything on one class's page: members, groups (with their codes), teachers.
create function public.teacher_class_detail(target uuid)
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

-- Students in my school who aren't in a class right now: the list a teacher ticks from.
create function public.teacher_unassigned_students()
returns table(id uuid, display_name text, real_name text, avatar jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select p.id, p.display_name, split_part(u.email, '@', 1)::text, p.avatar
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.school_id = public.my_school() and p.role = 'student' and public.current_class_of(p.id) is null
  order by split_part(u.email, '@', 1), p.display_name;
end;
$$;

-- Teachers in my school, for adding a co-teacher.
create function public.teacher_school_teachers()
returns table(id uuid, display_name text, real_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select p.id, p.display_name, split_part(u.email, '@', 1)::text
  from public.profiles p left join auth.users u on u.id = p.id
  where p.school_id = public.my_school() and p.role = 'teacher'
  order by split_part(u.email, '@', 1);
end;
$$;

-- Put a student into a class (or move them), with the groups of the old class letting go.
-- Internal: callers have already checked who may do this.
create function public.put_in_class(student uuid, target uuid, how_joined text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was uuid := (select m.class_id from public.class_members m where m.student_id = student);
begin
  if was is not null and was <> target then
    perform public.log_class_event(was, student, 'moved-out');
  end if;
  insert into public.class_members (student_id, class_id, how) values (student, target, how_joined)
  on conflict (student_id) do update set class_id = excluded.class_id, joined_at = now(), how = excluded.how
  where public.class_members.class_id <> excluded.class_id;
  if was is distinct from target then
    perform public.log_class_event(target, student, case when how_joined = 'teacher' then 'added' when was is null then 'joined' else 'moved-in' end);
  end if;
end;
$$;

-- Teacher: add students who have no class to one of my classes.
create function public.teacher_add_to_class(target uuid, students uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  one uuid;
  added integer := 0;
begin
  perform public.require_teacher();
  if not public.teaches_class(target) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if cardinality(students) > 100 then
    raise exception 'Add up to 100 students at a time.' using errcode = '22023';
  end if;
  foreach one in array students loop
    if exists (select 1 from public.profiles p where p.id = one and p.school_id = public.my_school() and p.role = 'student')
       and public.current_class_of(one) is null then
      perform public.put_in_class(one, target, 'teacher');
      added := added + 1;
    end if;
  end loop;
  return added;
end;
$$;

-- Teacher: move one of my students to another class I teach.
create function public.teacher_move_student(student uuid, target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  if not public.teaches_class(target) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  perform public.put_in_class(student, target, 'teacher');
end;
$$;

-- Teacher: take a student out of their class (they keep everything they've earned).
create function public.teacher_remove_from_class(student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was uuid;
begin
  perform public.require_teacher_of(student);
  delete from public.class_members m where m.student_id = student returning m.class_id into was;
  if was is not null then
    perform public.log_class_event(was, student, 'removed');
  end if;
end;
$$;

create function public.teacher_add_co_teacher(target uuid, teacher uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if not public.teaches_class(target) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = teacher and p.school_id = public.my_school() and p.role = 'teacher') then
    raise exception 'That person isn''t a teacher at your school.' using errcode = '22023';
  end if;
  insert into public.class_teachers (class_id, teacher_id) values (target, teacher) on conflict do nothing;
end;
$$;

create function public.teacher_remove_co_teacher(target uuid, teacher uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if not public.teaches_class(target) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if not public.is_school_admin()
     and (select count(*) from public.class_teachers t where t.class_id = target) <= 1 then
    raise exception 'A class needs at least one teacher.' using errcode = '22023';
  end if;
  delete from public.class_teachers t where t.class_id = target and t.teacher_id = teacher;
end;
$$;

-- ---------------------------------------------------------------------------
-- Groups (the screens for these come in F.3; the tables and codes are here now)
-- ---------------------------------------------------------------------------

create function public.teacher_create_group(target uuid, group_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  made uuid;
begin
  perform public.require_teacher();
  if not public.teaches_class(target) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if group_name is null or group_name !~ '^[A-Za-zĀāĒēĪīŌōŪū0-9][A-Za-zĀāĒēĪīŌōŪū0-9 .''-]{0,29}$' then
    raise exception 'Group names can use letters, numbers and spaces, up to 30 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.class_groups g where g.class_id = target and g.name = group_name) then
    raise exception 'This class already has a group with that name.' using errcode = '22023';
  end if;
  insert into public.class_groups (class_id, name, warp_code) values (target, group_name, public.new_warp_code())
  returning id into made;
  return made;
end;
$$;

create function public.teacher_delete_group(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  delete from public.class_groups g where g.id = target and public.teaches_class(g.class_id);
  if not found then
    raise exception 'That isn''t one of your groups.' using errcode = '42501';
  end if;
end;
$$;

-- Put a student into a group of their class, or take them out.
create function public.teacher_set_group_member(target uuid, student uuid, member boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_class uuid := (select g.class_id from public.class_groups g where g.id = target);
begin
  perform public.require_teacher_of(student);
  if group_class is null or not public.teaches_class(group_class) then
    raise exception 'That isn''t one of your groups.' using errcode = '42501';
  end if;
  if member then
    delete from public.class_group_members gm where gm.class_id = group_class and gm.student_id = student;
    insert into public.class_group_members (group_id, class_id, student_id) values (target, group_class, student);
  else
    delete from public.class_group_members gm where gm.group_id = target and gm.student_id = student;
  end if;
end;
$$;


-- School admin: choose the class new students and teachers join by themselves, or none.
create function public.school_set_default_class(target uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  if target is not null and not exists (
    select 1 from public.classes c where c.id = target and c.school_id = public.my_school() and not c.archived
  ) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  update public.schools set default_class = target where id = public.my_school();
end;
$$;

-- ---------------------------------------------------------------------------
-- Class Warp: the codes a teacher controls
-- ---------------------------------------------------------------------------

-- Turn a class's or group's code on, off, or to "ask me first".
create function public.teacher_set_warp_mode(target_class uuid, new_mode text, target_group uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if new_mode not in ('on', 'ask', 'off') then
    raise exception 'That isn''t a code setting.' using errcode = '22023';
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if target_group is null then
    update public.classes set warp_mode = new_mode where id = target_class;
  else
    update public.class_groups set warp_mode = new_mode where id = target_group and class_id = target_class;
    if not found then
      raise exception 'That isn''t one of your groups.' using errcode = '42501';
    end if;
  end if;
end;
$$;

-- Make a new code. The old one stops working at once. Returns the new code.
create function public.teacher_reset_warp_code(target_class uuid, target_group uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  fresh text := public.new_warp_code();
begin
  perform public.require_teacher();
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if target_group is null then
    update public.classes set warp_code = fresh where id = target_class;
  else
    update public.class_groups set warp_code = fresh where id = target_group and class_id = target_class;
    if not found then
      raise exception 'That isn''t one of your groups.' using errcode = '42501';
    end if;
  end if;
  return fresh;
end;
$$;

-- The latest warps in a class, newest first, for the live "joined" list.
create function public.teacher_class_events(target uuid)
returns table(id bigint, at timestamptz, kind text, student_name text, group_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if not public.teaches_class(target, public.is_school_admin()) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return query
  select e.id, e.at, e.kind, p.display_name, g.name
  from public.class_events e
  join public.profiles p on p.id = e.student_id
  left join public.class_groups g on g.id = e.group_id
  where e.class_id = target
  order by e.id desc
  limit 30;
end;
$$;

-- Students waiting for a teacher to say yes, across the classes I teach.
create function public.teacher_warp_requests()
returns table(id uuid, class_id uuid, class_name text, group_name text, student_name text, asked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select r.id, r.class_id, c.name, g.name, p.display_name, r.created_at
  from public.warp_requests r
  join public.classes c on c.id = r.class_id
  join public.profiles p on p.id = r.student_id
  left join public.class_groups g on g.id = r.group_id
  where r.status = 'pending' and r.created_at > now() - interval '7 days'
    and r.class_id in (select public.my_classes())
  order by r.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Class Warp: what a student does
-- ---------------------------------------------------------------------------

-- Finds the class or group a typed code belongs to, for this student, or nothing.
-- A code only ever works inside the student's own school, and never for an archived class or a code
-- that is switched off. Returns one row: kind, class, group, names, mode.
create function public.find_warp_target(typed text, student uuid)
returns table(kind text, class_id uuid, group_id uuid, class_name text, group_name text, mode text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'class', c.id, null::uuid, c.name, null::text, c.warp_mode
  from public.classes c
  join public.profiles p on p.id = student
  where c.warp_code = upper(typed) and c.school_id = p.school_id and not c.archived and c.warp_mode <> 'off'
    and p.role = 'student'
  union all
  select 'group', c.id, g.id, c.name, g.name,
         -- A group code that brings a student into the class too needs the class to say yes as well.
         case when g.warp_mode = 'ask' or (c.warp_mode = 'ask' and public.current_class_of(student) is distinct from c.id)
              then 'ask' else 'on' end
  from public.class_groups g
  join public.classes c on c.id = g.class_id
  join public.profiles p on p.id = student
  where g.warp_code = upper(typed) and c.school_id = p.school_id and not c.archived and g.warp_mode <> 'off'
    and (c.warp_mode <> 'off' or public.current_class_of(student) = c.id)
    and p.role = 'student'
$$;

-- Normalise what was typed the way game codes are: any case, spaces and dashes are fine.
create function public.tidy_code(typed text)
returns text
language sql
immutable
set search_path = ''
as $$ select case when length(typed) <= 20 then regexp_replace(upper(typed), '[\s-]', '', 'g') end $$;

-- Too many wrong codes lately? (5 in 10 minutes.) Wrong codes are counted; right ones never are.
create function public.warp_slowed(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select (select count(*) from public.warp_tries t where t.student_id = student and t.at > now() - interval '10 minutes') >= 5 $$;

-- Step 1: the student typed a code. Say what it is, so they can confirm. Nothing changes yet.
-- Never raises for a wrong code (the wrong try must be remembered); the answer says what happened.
create function public.warp_preview(typed text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  code text := public.tidy_code(typed);
  found_target record;
  current_name text;
begin
  perform public.require_school_user();
  if public.warp_slowed(me) then
    return jsonb_build_object('status', 'slow-down');
  end if;
  select * into found_target from public.find_warp_target(coalesce(code, ''), me);
  if not found then
    insert into public.warp_tries (student_id) values (me);
    return jsonb_build_object('status', 'nope');
  end if;
  select c.name into current_name from public.classes c where c.id = public.current_class_of(me);
  return jsonb_build_object(
    'status', 'found',
    'kind', found_target.kind,
    'name', coalesce(found_target.group_name, found_target.class_name),
    'className', found_target.class_name,
    -- Leaving another class? The screen asks first.
    'leaving', case when public.current_class_of(me) is not null and public.current_class_of(me) <> found_target.class_id
                    then current_name end,
    'alreadyIn', public.current_class_of(me) = found_target.class_id
                 and (found_target.group_id is null or exists (
                   select 1 from public.class_group_members gm where gm.group_id = found_target.group_id and gm.student_id = me)),
    'ask', found_target.mode = 'ask');
end;
$$;

-- Do the warp: join, or (when the teacher wants to say yes first) ask.
create function public.warp_join_now(student uuid, target_class uuid, target_group uuid, how_joined text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.put_in_class(student, target_class, how_joined);
  if target_group is not null then
    delete from public.class_group_members gm where gm.class_id = target_class and gm.student_id = student;
    insert into public.class_group_members (group_id, class_id, student_id) values (target_group, target_class, student);
    perform public.log_class_event(target_class, student, 'joined-group', target_group);
  end if;
end;
$$;

-- Step 2: the student confirmed. The code is checked again from scratch.
create function public.warp_join(typed text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  code text := public.tidy_code(typed);
  found_target record;
begin
  perform public.require_school_user();
  if public.warp_slowed(me) then
    return jsonb_build_object('status', 'slow-down');
  end if;
  select * into found_target from public.find_warp_target(coalesce(code, ''), me);
  if not found then
    insert into public.warp_tries (student_id) values (me);
    return jsonb_build_object('status', 'nope');
  end if;
  if found_target.mode = 'ask' then
    -- One question at a time: a newer one replaces an older one.
    update public.warp_requests set status = 'cancelled' where student_id = me and status = 'pending';
    insert into public.warp_requests (student_id, class_id, group_id) values (me, found_target.class_id, found_target.group_id);
    perform public.log_class_event(found_target.class_id, me, 'asked', found_target.group_id);
    return jsonb_build_object('status', 'waiting', 'name', coalesce(found_target.group_name, found_target.class_name));
  end if;
  perform public.warp_join_now(me, found_target.class_id, found_target.group_id, 'warp');
  return jsonb_build_object('status', 'joined', 'name', coalesce(found_target.group_name, found_target.class_name),
    'className', found_target.class_name);
end;
$$;

-- A student's own class, for the Class Warp screen. The name is only ever shown to that student.
create function public.my_class()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'className', (select c.name from public.classes c where c.id = public.current_class_of(auth.uid())),
    'groupName', (select g.name from public.class_group_members gm join public.class_groups g on g.id = gm.group_id
                  where gm.student_id = auth.uid() and gm.class_id = public.current_class_of(auth.uid())),
    'waitingFor', (select coalesce(g.name, c.name) from public.warp_requests r
                   join public.classes c on c.id = r.class_id
                   left join public.class_groups g on g.id = r.group_id
                   where r.student_id = auth.uid() and r.status = 'pending' and r.created_at > now() - interval '7 days'
                     and not c.archived))
  where public.is_school_user()
$$;

create function public.cancel_warp_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  update public.warp_requests set status = 'cancelled' where student_id = auth.uid() and status = 'pending';
end;
$$;

-- Teacher: say yes or no to a student who asked.
create function public.teacher_answer_warp(request uuid, approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  asked public.warp_requests;
begin
  perform public.require_teacher();
  select * into asked from public.warp_requests r
  where r.id = request and r.status = 'pending' and r.created_at > now() - interval '7 days'
    and r.class_id in (select public.my_classes())
  for update;
  if not found then
    raise exception 'That request isn''t waiting any more.' using errcode = '22023';
  end if;
  update public.warp_requests set status = case when approve then 'approved' else 'declined' end,
    answered_by = auth.uid(), answered_at = now() where id = request;
  if approve then
    perform public.warp_join_now(asked.student_id, asked.class_id, asked.group_id, 'approved');
  else
    perform public.log_class_event(asked.class_id, asked.student_id, 'declined', asked.group_id);
  end if;
  return jsonb_build_object('approved', approve);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tidy up: forget old wrong tries and old warp notes
-- ---------------------------------------------------------------------------

create function public.tidy_warp()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.warp_tries where at < now() - interval '1 day';
  delete from public.class_events where at < now() - interval '60 days';
  delete from public.warp_requests where status <> 'pending' and created_at < now() - interval '30 days';
$$;
select cron.schedule('tidy-class-warp', '37 3 * * *', 'select public.tidy_warp()');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

-- Row rules run as the signed-in person, so these two (used in the rules) must be callable.
grant execute on function
  public.can_manage_student(uuid),
  public.my_settings_id()
to authenticated;
grant execute on function
  public.my_class(),
  public.warp_preview(text),
  public.warp_join(text),
  public.cancel_warp_request(),
  public.school_set_default_class(uuid),
  public.teacher_create_class(text, integer, integer),
  public.teacher_update_class(uuid, text, integer, integer),
  public.teacher_archive_class(uuid, boolean),
  public.teacher_classes(boolean),
  public.teacher_class_detail(uuid),
  public.teacher_unassigned_students(),
  public.teacher_school_teachers(),
  public.teacher_add_to_class(uuid, uuid[]),
  public.teacher_move_student(uuid, uuid),
  public.teacher_remove_from_class(uuid),
  public.teacher_add_co_teacher(uuid, uuid),
  public.teacher_remove_co_teacher(uuid, uuid),
  public.teacher_create_group(uuid, text),
  public.teacher_delete_group(uuid),
  public.teacher_set_group_member(uuid, uuid, boolean),
  public.teacher_set_warp_mode(uuid, text, uuid),
  public.teacher_reset_warp_code(uuid, uuid),
  public.teacher_class_events(uuid),
  public.teacher_warp_requests(),
  public.teacher_answer_warp(uuid, boolean)
to authenticated;

-- >>> lock new functions
-- Supabase lets everyone (even a signed-out visitor) call a new function unless it is locked, so lock
-- every function this file made. The grants above and in the earlier migrations are the only way in.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'can_manage_student',
      'cancel_warp_request',
      'check_class_member',
      'check_class_teacher',
      'check_group_member',
      'current_class_of',
      'drop_old_groups',
      'find_warp_target',
      'give_class_settings',
      'give_school_settings',
      'join_default_class',
      'log_class_event',
      'my_class',
      'my_classes',
      'my_settings_id',
      'my_students',
      'new_warp_code',
      'profile_role_classes',
      'put_in_class',
      'require_teacher_of',
      'school_set_default_class',
      'settings_id_of',
      'settings_of',
      'teacher_add_co_teacher',
      'teacher_add_to_class',
      'teacher_answer_warp',
      'teacher_archive_class',
      'teacher_class_detail',
      'teacher_class_events',
      'teacher_classes',
      'teacher_create_class',
      'teacher_create_group',
      'teacher_delete_group',
      'teacher_move_student',
      'teacher_remove_co_teacher',
      'teacher_remove_from_class',
      'teacher_reset_warp_code',
      'teacher_school_teachers',
      'teacher_set_group_member',
      'teacher_set_warp_mode',
      'teacher_unassigned_students',
      'teacher_update_class',
      'teacher_warp_requests',
      'teaches_class',
      'tidy_code',
      'tidy_warp',
      'warp_join',
      'warp_join_now',
      'warp_preview',
      'warp_slowed'
    )
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end;
$$;
-- <<< lock new functions
