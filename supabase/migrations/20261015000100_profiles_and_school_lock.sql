-- Stage 3: school-only sign-in, profiles, safe names, avatars and teacher roles.
--
-- The security idea in one paragraph: nobody outside the school gets an account (lock 2,
-- the sign-up hook), every read also re-checks the school domain (lock 3, row level
-- security), and students can't write to tables directly at all. Every change goes
-- through one of the small functions at the bottom, which check who's asking.
-- Profiles never store emails or real names.

-- ---------------------------------------------------------------------------
-- The school domain
-- ---------------------------------------------------------------------------

create function public.school_domain()
returns text
language sql
immutable
set search_path = ''
as $$ select 'douglaspark.school.nz' $$;

create function public.is_school_email(email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(lower(email) ~ ('^[^@\s]+@' || replace(public.school_domain(), '.', '\.') || '$'), false)
$$;

-- Lock 2: Supabase calls this before creating any account. Anything not on the
-- school domain is refused, so the account is never created.
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if public.is_school_email(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Please sign in with your school Google account.'
  ));
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- True only for a signed-in user whose sign-in token carries a school email.
create function public.is_school_user()
returns boolean
language sql
stable
set search_path = ''
as $$ select auth.uid() is not null and public.is_school_email(auth.jwt() ->> 'email') $$;

-- ---------------------------------------------------------------------------
-- Safe name words. Names look like "Speedy Otter 27". No free typing.
-- ---------------------------------------------------------------------------

create table public.name_words (
  kind text not null check (kind in ('adjective', 'animal')),
  word text not null check (word ~ '^[A-Z][a-z]{2,11}$'),
  primary key (kind, word)
);

insert into public.name_words (kind, word)
select 'adjective', unnest(array[
  'Brave', 'Bright', 'Bouncy', 'Bubbly', 'Calm', 'Clever', 'Cosmic', 'Curious', 'Daring',
  'Dazzling', 'Eager', 'Fearless', 'Friendly', 'Gentle', 'Golden', 'Happy', 'Jolly', 'Kind',
  'Lively', 'Lucky', 'Magic', 'Mighty', 'Nimble', 'Plucky', 'Proud', 'Quick', 'Quiet',
  'Rapid', 'Shiny', 'Sneaky', 'Sparkly', 'Speedy', 'Sunny', 'Super', 'Swift', 'Thunder',
  'Turbo', 'Wise', 'Zappy', 'Zippy'
])
union all
select 'animal', unnest(array[
  'Badger', 'Bear', 'Beaver', 'Cheetah', 'Dolphin', 'Dragon', 'Eagle', 'Falcon', 'Fantail',
  'Fox', 'Gecko', 'Giraffe', 'Hedgehog', 'Kakapo', 'Kea', 'Kiwi', 'Koala', 'Lion', 'Llama',
  'Lynx', 'Meerkat', 'Moose', 'Narwhal', 'Octopus', 'Orca', 'Otter', 'Owl', 'Panda',
  'Penguin', 'Pukeko', 'Rabbit', 'Robot', 'Seal', 'Shark', 'Takahe', 'Tiger', 'Tuatara',
  'Tui', 'Turtle', 'Weka', 'Whale', 'Wolf', 'Yeti', 'Zebra'
]);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

-- Avatars are a small set of short codes, e.g. {"face":"round","skin":"#f1c7a5"}.
-- No free text or images can get in: every value is a short code or a colour.
create function public.is_valid_avatar(avatar jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(avatar) = 'object'
     and pg_column_size(avatar) <= 1024
     and not exists (
       select 1 from jsonb_each(avatar) as part
       where part.key !~ '^[a-z][a-zA-Z]{0,19}$'
          or jsonb_typeof(part.value) <> 'string'
          or (part.value #>> '{}') !~ '^([a-z0-9-]{1,24}|#[0-9a-f]{6})$'
     )
$$;

create table public.profiles (
  -- The same random ID as the sign-in account. Deleting the account deletes the profile.
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null unique check (display_name ~ '^[A-Z][a-z]+ [A-Z][a-z]+ [1-9][0-9]?$'),
  avatar jsonb not null default '{}'::jsonb check (public.is_valid_avatar(avatar)),
  role text not null default 'student' check (role in ('student', 'teacher')),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- Picks a free name. Leave a word out to get a random one.
create function public.pick_display_name(adjective text default null, animal text default null)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  chosen_adjective text;
  chosen_animal text;
  result text;
begin
  select word into chosen_adjective from public.name_words
  where kind = 'adjective' and (adjective is null or word = adjective)
  order by random() limit 1;

  select word into chosen_animal from public.name_words
  where kind = 'animal' and (animal is null or word = animal)
  order by random() limit 1;

  if chosen_adjective is null or chosen_animal is null then
    raise exception 'That word isn''t on the list.' using errcode = '22023';
  end if;

  select chosen_adjective || ' ' || chosen_animal || ' ' || n into result
  from generate_series(1, 99) as n
  where not exists (
    select 1 from public.profiles p
    where p.display_name = chosen_adjective || ' ' || chosen_animal || ' ' || n
  )
  order by random() limit 1;

  if result is null then
    raise exception 'All the names with those words are taken. Try different words.' using errcode = '23505';
  end if;
  return result;
end;
$$;

-- Every new account gets a profile straight away with a random safe name.
-- This is also a backstop for lock 2: even if the sign-up hook were switched off, or an
-- account were made some other way, a non-school account can't be created.
create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_school_email(new.email) then
    raise exception 'Please sign in with your school Google account.' using errcode = '42501';
  end if;
  insert into public.profiles (id, display_name) values (new.id, public.pick_display_name());
  return new;
end;
$$;

create trigger create_profile_after_signup
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_school_user() and exists (
    select 1 from public.profiles where id = auth.uid() and role = 'teacher'
  )
$$;

-- ---------------------------------------------------------------------------
-- Settings teachers control
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id boolean primary key default true check (id),
  multiplayer_enabled boolean not null default true
);
insert into public.app_settings default values;

-- ---------------------------------------------------------------------------
-- Who can read what (lock 3). Nobody can write to these tables directly.
-- ---------------------------------------------------------------------------

alter table public.name_words enable row level security;
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;

revoke all on public.name_words, public.profiles, public.app_settings from anon, authenticated;
grant select on public.name_words, public.profiles, public.app_settings to authenticated;

create policy "School users can read the name words"
on public.name_words for select to authenticated
using (public.is_school_user());

create policy "School users can see visible profiles, their own, or all if a teacher"
on public.profiles for select to authenticated
using (public.is_school_user() and (not hidden or id = auth.uid() or public.is_teacher()));

create policy "School users can read the settings"
on public.app_settings for select to authenticated
using (public.is_school_user());

-- ---------------------------------------------------------------------------
-- The only ways to change anything
-- ---------------------------------------------------------------------------

create function public.require_school_user()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_school_user() then
    raise exception 'Please sign in with your school account.' using errcode = '42501';
  end if;
end;
$$;

create function public.require_teacher()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_teacher() then
    raise exception 'Only teachers can do that.' using errcode = '42501';
  end if;
end;
$$;

-- Student: pick a new name from the word lists. The number is chosen for them.
create function public.choose_my_name(adjective text, animal text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_name text;
begin
  perform public.require_school_user();
  -- Same two words as now? Keep the current number.
  select display_name into new_name from public.profiles
  where id = auth.uid() and display_name like adjective || ' ' || animal || ' %';
  if new_name is not null then
    return new_name;
  end if;
  new_name := public.pick_display_name(adjective, animal);
  update public.profiles set display_name = new_name where id = auth.uid();
  return new_name;
end;
$$;

-- Student: save their avatar.
create function public.save_my_avatar(avatar jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  if not public.is_valid_avatar(avatar) then
    raise exception 'That avatar isn''t valid.' using errcode = '22023';
  end if;
  update public.profiles set avatar = save_my_avatar.avatar where id = auth.uid();
end;
$$;

-- Teacher: hide or un-hide a student from leaderboards and lists.
create function public.teacher_set_hidden(student uuid, hide boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  update public.profiles set hidden = hide where id = student;
end;
$$;

-- Teacher: give a student a new random name (e.g. if theirs is being used to tease).
create function public.teacher_reset_name(student uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_name text;
begin
  perform public.require_teacher();
  new_name := public.pick_display_name();
  update public.profiles set display_name = new_name where id = student;
  return new_name;
end;
$$;

-- Teacher: make another staff member a teacher, or take it away. Not yourself.
create function public.teacher_set_role(person uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if person = auth.uid() then
    raise exception 'You can''t change your own role.' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = person;
end;
$$;

-- Teacher: remove a student and everything stored about them. Can't be undone.
create function public.teacher_delete_student(student uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if exists (select 1 from public.profiles where id = student and role = 'teacher') then
    raise exception 'Teachers can''t be deleted this way.' using errcode = '42501';
  end if;
  delete from auth.users where id = student;
end;
$$;

-- Teacher: switch playing against other students on or off for everyone.
create function public.teacher_set_multiplayer(enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  update public.app_settings set multiplayer_enabled = enabled;
end;
$$;

-- Run once by hand in the Supabase SQL editor to make the first teacher:
--   select public.make_first_teacher('your.name@douglaspark.school.nz');
-- Only the database owner can run it; the website can't.
create function public.make_first_teacher(email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account uuid;
begin
  select id into account from auth.users where lower(auth.users.email) = lower(make_first_teacher.email);
  if account is null then
    raise exception 'No account with that email yet. Sign in to the website once first.';
  end if;
  update public.profiles set role = 'teacher' where id = account;
end;
$$;

-- Lock down who can call what. Supabase lets everyone call new functions by default.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.school_domain(),
  public.is_school_email(text),
  public.is_school_user(),
  public.is_teacher(),
  public.is_valid_avatar(jsonb),
  public.choose_my_name(text, text),
  public.save_my_avatar(jsonb),
  public.teacher_set_hidden(uuid, boolean),
  public.teacher_reset_name(uuid),
  public.teacher_set_role(uuid, text),
  public.teacher_delete_student(uuid),
  public.teacher_set_multiplayer(boolean)
to authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
-- The sign-up trigger runs as the auth service, so it needs these two.
grant execute on function public.pick_display_name(text, text), public.create_profile_for_new_user() to supabase_auth_admin;
grant execute on function public.is_school_email(text), public.school_domain() to supabase_auth_admin;

-- Future functions start locked too.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
