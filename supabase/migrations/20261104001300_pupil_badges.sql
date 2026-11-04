-- QR sign-in badges for young pupils (Years 1-4), James 4 Nov 2026 (docs/BADGE-SIGN-IN-PLAN.md).
--
-- A teacher prints a sheet of cards for their class. Each card has a QR code holding a long random
-- code for one pupil. Scanning it signs that pupil in to the account they already have (made the
-- first time they signed in with Google, or by the teacher's roster). No typing.
--
--   pupil_badges                  one row per pupil who has a badge. Nobody reads it directly.
--   teacher_class_badges(class)   the class's pupils with their codes (made the first time), for printing.
--   teacher_renew_badge(pupil)    a new code for one pupil: their old card stops working.
--   badge_sign_in(code)           server key only: whose badge is this? Used by the "badge" function.
--
-- The code is the whole secret, like a password on a card, so it is long (122 random bits) and
-- only the pupil's own teachers can read it. It is kept readable (not scrambled) so a teacher can
-- reprint a card without making a new one. Badges only ever sign in students, never teachers.

create table public.pupil_badges (
  player uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[0-9a-f]{32}$'),
  made_at timestamptz not null default now(),
  made_by uuid references public.profiles (id) on delete set null,
  used_at timestamptz
);
alter table public.pupil_badges enable row level security;
revoke all on public.pupil_badges from public, anon, authenticated;

create function public.new_badge_code()
returns text
language sql
volatile
set search_path = ''
as $$ select replace(gen_random_uuid()::text, '-', '') $$;

-- The class's pupils and their badge codes, making any that are missing.
create function public.teacher_class_badges(target_class uuid)
returns table (player uuid, display_name text, real_name text, avatar jsonb, code text, made_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_teacher();
  if target_class is null then
    raise exception 'Choose a class first.' using errcode = '22023';
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;

  insert into public.pupil_badges (player, code, made_by)
  select m.student_id, public.new_badge_code(), auth.uid()
  from public.class_members m
  join public.profiles p on p.id = m.student_id and p.role = 'student'
  where m.class_id = target_class
  on conflict on constraint pupil_badges_pkey do nothing;

  return query
    select p.id, p.display_name, split_part(u.email, '@', 1)::text, p.avatar, b.code, b.made_at
    from public.class_members m
    join public.profiles p on p.id = m.student_id and p.role = 'student'
    join auth.users u on u.id = p.id
    join public.pupil_badges b on b.player = p.id
    where m.class_id = target_class
    order by lower(split_part(u.email, '@', 1)), p.display_name;
end;
$$;

-- A lost card: give the pupil a new code, so the old card stops working.
create function public.teacher_renew_badge(pupil uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  fresh text := public.new_badge_code();
begin
  perform public.require_teacher_of(pupil);
  if not exists (select 1 from public.profiles p where p.id = pupil and p.role = 'student') then
    raise exception 'Badges are for students only.' using errcode = '22023';
  end if;
  insert into public.pupil_badges as b (player, code, made_by)
  values (pupil, fresh, auth.uid())
  on conflict on constraint pupil_badges_pkey
  do update set code = excluded.code, made_at = now(), made_by = excluded.made_by, used_at = null;
  return fresh;
end;
$$;

-- Server key only. The email of the student this code belongs to, or null (wrong code, not a
-- student any more, or their school is switched off). Notes when the badge was last used.
create function public.badge_sign_in(badge_code text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  who uuid;
  email text;
begin
  if badge_code is null or badge_code !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select b.player, u.email into who, email
  from public.pupil_badges b
  join public.profiles p on p.id = b.player and p.role = 'student'
  join public.schools s on s.id = p.school_id and s.active
  join auth.users u on u.id = b.player
  where b.code = badge_code;
  if who is null then
    return null;
  end if;
  update public.pupil_badges set used_at = now() where player = who;
  return email;
end;
$$;

-- Lock the new functions.
revoke all on function public.new_badge_code() from public, anon, authenticated;
revoke all on function public.teacher_class_badges(uuid) from public, anon;
revoke all on function public.teacher_renew_badge(uuid) from public, anon;
revoke all on function public.badge_sign_in(text) from public, anon, authenticated;
grant execute on function public.teacher_class_badges(uuid) to authenticated;
grant execute on function public.teacher_renew_badge(uuid) to authenticated;
grant execute on function public.badge_sign_in(text) to service_role;
