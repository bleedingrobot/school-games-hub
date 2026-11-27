-- Own names last 3 weeks (James, 28 Nov 2026 NZ): a name a pupil made up with a Name Scroll lasts 3 weeks from the teacher's
-- Yes, then goes back to their made-up name (their last one if it is free, otherwise a new one), so there is a reason to earn
-- another scroll. Unused scrolls do not run out. Teachers' names never run out.
--
--   1. own_name_ends      one row per pupil with a typed name: when it goes back
--   2. a profiles trigger  a typed name (any route) starts its 3 weeks; a made-up name clears the row
--   3. own_name_back()     puts the made-up name back (as teacher_made_up_name_back, with no teacher check)
--   4. end_own_names()     every 10 minutes, puts back every name whose 3 weeks are up
--   5. my_name_status() and teacher_name_scrolls() as in 20261112002800_own_names.sql (no later migration changed them),
--      plus 'typedUntil': when the name goes back (null when it is not a typed name)
--
-- Pupils who already have a typed name today get their 3 weeks from now (nobody loses a name the day this goes live).

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------

create table public.own_name_ends (
  player uuid primary key references public.profiles (id) on delete cascade,
  ends_at timestamptz not null
);
create index own_name_ends_at on public.own_name_ends (ends_at);
comment on table public.own_name_ends is 'Own names last 3 weeks: when a pupil''s typed name goes back. Removed with the account.';
alter table public.own_name_ends enable row level security;
-- No policy and no grant: read through my_name_status() and teacher_name_scrolls().
revoke all on public.own_name_ends from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Starting and clearing the 3 weeks
-- ---------------------------------------------------------------------------

create function public.own_name_ends_track()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_made_up_name(new.display_name) or new.role <> 'student' then
    delete from public.own_name_ends where player = new.id;
  else
    insert into public.own_name_ends (player, ends_at) values (new.id, now() + interval '21 days')
    on conflict (player) do update set ends_at = excluded.ends_at;
  end if;
  return new;
end;
$$;
create trigger own_name_ends_track after update of display_name on public.profiles
for each row when (old.display_name is distinct from new.display_name) execute function public.own_name_ends_track();

-- Pupils with a typed name now: 3 weeks from today.
insert into public.own_name_ends (player, ends_at)
select p.id, now() + interval '21 days' from public.profiles p
where p.role = 'student' and not public.is_made_up_name(p.display_name)
on conflict (player) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Putting the made-up name back
-- ---------------------------------------------------------------------------

-- Their last made-up name if nobody has it now, otherwise a new random one. Returns the name. Server only.
create function public.own_name_back(student uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_name text;
  back text;
begin
  select p.display_name into now_name from public.profiles p where p.id = student;
  if now_name is null or public.is_made_up_name(now_name) then
    delete from public.own_name_ends where player = student;
    return now_name;
  end if;
  select h.name into back from public.name_history h
  where h.player = student and public.is_made_up_name(h.name)
    and not exists (select 1 from public.profiles p where lower(p.display_name) = lower(h.name))
  order by h.until desc, h.id desc limit 1;
  update public.profiles set display_name = coalesce(back, public.pick_display_name()) where id = student
  returning display_name into back;
  return back;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Every 10 minutes
-- ---------------------------------------------------------------------------

-- Puts back every typed name whose 3 weeks are up. One pupil failing never stops the rest. Returns how many went back.
create function public.end_own_names()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  who uuid;
  done integer := 0;
begin
  for who in select e.player from public.own_name_ends e where e.ends_at <= now() order by e.ends_at loop
    begin
      perform public.own_name_back(who);
      done := done + 1;
    exception when others then
      raise warning 'end_own_names failed for %: %', who, sqlerrm;
    end;
  end loop;
  return done;
end;
$$;
select cron.schedule('end-own-names', '*/10 * * * *', 'select public.end_own_names()');

-- ---------------------------------------------------------------------------
-- 5. What pupils and teachers see
-- ---------------------------------------------------------------------------

-- { scrolls, waiting: { name, askedAt } | null, last: { name, status, at } | null, canPickToday, typed, typedUntil }.
create or replace function public.my_name_status()
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
    'scrolls', (select count(*)::integer from public.name_scrolls s where s.player = me and s.used_at is null
                and not exists (select 1 from public.name_requests r where r.scroll_id = s.id and r.status = 'pending')),
    'waiting', (select jsonb_build_object('name', r.wanted, 'askedAt', r.created_at) from public.name_requests r
                where r.player = me and r.status = 'pending'),
    'last', (select jsonb_build_object('name', r.wanted, 'status', r.status, 'at', r.answered_at) from public.name_requests r
             where r.player = me and r.status in ('approved', 'declined', 'taken') and r.answered_at > now() - interval '7 days'
             order by r.answered_at desc limit 1),
    'canPickToday', not public.picked_name_today(me) or exists (select 1 from public.profiles p where p.id = me and p.role = 'teacher'),
    'typed', exists (select 1 from public.profiles p where p.id = me and not public.is_made_up_name(p.display_name)),
    'typedUntil', (select e.ends_at from public.own_name_ends e where e.player = me));
end;
$$;

-- { scrolls, waiting: name | null, typed, typedUntil }.
create or replace function public.teacher_name_scrolls(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return jsonb_build_object(
    'scrolls', (select count(*)::integer from public.name_scrolls s where s.player = student and s.used_at is null),
    'waiting', (select r.wanted from public.name_requests r where r.player = student and r.status = 'pending'),
    'typed', exists (select 1 from public.profiles p where p.id = student and not public.is_made_up_name(p.display_name)),
    'typedUntil', (select e.ends_at from public.own_name_ends e where e.player = student));
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.own_name_ends_track(), public.own_name_back(uuid), public.end_own_names(),
  public.my_name_status(), public.teacher_name_scrolls(uuid)
from public, anon, authenticated;
grant execute on function public.my_name_status(), public.teacher_name_scrolls(uuid) to authenticated;
