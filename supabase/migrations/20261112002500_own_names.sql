-- Earn your own name (docs/PROFILE-REVIEW.md section 6; docs/plans/profile/PLAN.md card P11; 12 Nov 2026).
--
-- A pupil who earns a Name Scroll may type a player name. It is shown to nobody but the pupil and their teachers until a
-- teacher says Yes; until then the old name stays. Teachers see the past names and can put the made-up name back.
--
--   1. profiles.display_name   now also allows an approved typed name (2 to 14 letters, one space); unique ignoring case
--   2. own_name_check          the server's letter and rude-word checks (lists as in shared/clans/words.ts; a test checks)
--   3. name_scrolls            given by the server (gold in two games, or a third earned picture) or by a teacher
--   4. name_requests           one waiting request per pupil, copied from Class Warp's warp_requests
--   5. name_history            every name a player had, for teachers; also gives the once-a-day limit on made-up names
--   6. Pupil: my_name_status, ask_for_my_name, cancel_my_name_request; choose_my_name now once a day
--   7. Teacher: teacher_name_requests, teacher_answer_name, teacher_name_history, teacher_made_up_name_back,
--      teacher_give_name_scroll
--
-- choose_my_name keeps its name, arguments and grants (first written in 20261015000100, never changed since).

-- ---------------------------------------------------------------------------
-- 1. The name rule
-- ---------------------------------------------------------------------------

alter table public.profiles drop constraint profiles_display_name_check;
alter table public.profiles add constraint profiles_display_name_check check (
  display_name ~ '^[A-Z][a-z]+ [A-Z][a-z]+ [1-9][0-9]?$'
  or (display_name ~ '^[A-Z][a-z]+( [A-Z][a-z]+)?$' and char_length(display_name) between 2 and 14)
);
-- "Bob" and "bob" are the same name. Made-up names already differ by more than case, so this adds no clash today.
create unique index profiles_display_name_any_case on public.profiles (lower(display_name));

-- A made-up name (two list words and a number) or not.
create function public.is_made_up_name(n text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select n ~ '^[A-Z][a-z]+ [A-Z][a-z]+ [1-9][0-9]?$' $$;

-- ---------------------------------------------------------------------------
-- 2. The checks
-- ---------------------------------------------------------------------------

-- The rude-word lists, word for word as NEVER_INSIDE and NEVER_ALONE in shared/clans/words.ts (src/profile/ownName.test.ts
-- checks they match). Each letter may be typed more than once ("fuuuck" is caught).
create function public.rude_inside_words()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array[
  'fuck', 'fuk', 'fck', 'shit', 'cunt', 'bitch', 'bastard', 'wank', 'twat', 'bollock', 'nigg', 'fagot', 'faggot',
  'retard', 'slut', 'whore', 'porn', 'penis', 'vagina', 'boob', 'dildo', 'hitler', 'pedo', 'sexy', 'horny',
  'poop', 'pussy', 'skank', 'tits', 'arsehole', 'asshole', 'dickhead', 'killyourself'
]::text[] $$;

create function public.rude_alone_words()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array[
  'ass', 'arse', 'butt', 'bum', 'poo', 'pee', 'piss', 'cock', 'dick', 'tit', 'hell', 'damn', 'crap', 'sex', 'fag', 'hoe',
  'nob', 'knob', 'prick', 'wee', 'weewee', 'willy', 'fart', 'stupid', 'dumb', 'idiot', 'loser', 'ugly', 'fat', 'kill', 'die',
  'dead', 'gay', 'homo', 'nude', 'naked', 'drug', 'drugs', 'weed', 'beer', 'vape', 'rape', 'kys', 'kkk', 'shag', 'puta', 'nazi'
]::text[] $$;

-- "boob" becomes b+o+o+b+, as stretchy() in shared/clans/words.ts.
create function public.stretchy_rule(words text[])
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg((select string_agg(ch || '+', '' order by i) from unnest(string_to_array(w, null)) with ordinality as c(ch, i)), '|')
  from unnest(words) as w
$$;

-- A typed name, tidied ("te  ahi" -> "Te Ahi"), or an error a child can read. Never saves anything.
-- `who` is the pupil asking, so their own real name (from the school email) is refused too.
create function public.own_name_check(typed text, who uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  trimmed text := regexp_replace(btrim(coalesce(typed, '')), '\s+', ' ', 'g');
  whole text;
  parts text[];
  email_bits text[];
begin
  if trimmed = '' then
    raise exception 'Type a name.' using errcode = '22023';
  end if;
  if trimmed !~ '^[A-Za-z]+( [A-Za-z]+)?$' then
    raise exception 'Use letters only (one space is fine).' using errcode = '22023';
  end if;
  if char_length(trimmed) < 2 or trimmed ~ '(^| )[A-Za-z]( |$)' then
    raise exception 'Each word needs at least 2 letters.' using errcode = '22023';
  end if;
  if char_length(trimmed) > 14 then
    raise exception 'A name can be up to 14 letters long.' using errcode = '22023';
  end if;
  whole := lower(replace(trimmed, ' ', ''));
  parts := string_to_array(lower(trimmed), ' ');
  if whole ~ public.stretchy_rule(public.rude_inside_words())
     or whole ~ ('^(?:' || public.stretchy_rule(public.rude_alone_words()) || ')$')
     or exists (select 1 from unnest(parts) p where p ~ ('^(?:' || public.stretchy_rule(public.rude_alone_words()) || ')$')) then
    raise exception 'Please pick a kinder name.' using errcode = '22023';
  end if;
  -- Their own real name: any run of 3 or more letters in the part of their school email before the @.
  if who is not null then
    select array_agg(b) into email_bits
    from (select u.email from auth.users u where u.id = who) e,
         regexp_split_to_table(lower(split_part(e.email, '@', 1)), '[^a-z]+') b
    where char_length(b) >= 3;
    if exists (select 1 from unnest(parts) p where p = any (coalesce(email_bits, '{}'))) or whole = any (coalesce(email_bits, '{}')) then
      raise exception 'Please don''t use your real name. Make one up!' using errcode = '22023';
    end if;
  end if;
  return initcap(lower(trimmed));
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Name Scrolls
-- ---------------------------------------------------------------------------

-- One typed name per scroll. 'two-golds' and 'pictures' come once ever, from the server; a teacher can give more, one at a time.
create table public.name_scrolls (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  how text not null check (how in ('two-golds', 'pictures', 'teacher')),
  given_at timestamptz not null default now(),
  given_by uuid references public.profiles (id) on delete set null,
  -- When a teacher said Yes to the name it was used for. Null = still free (or waiting on a request).
  used_at timestamptz
);
create unique index name_scrolls_once on public.name_scrolls (player, how) where how <> 'teacher';
create index name_scrolls_player on public.name_scrolls (player);
comment on table public.name_scrolls is 'Earn your own name: each scroll lets a pupil ask for one typed name. Removed with the account.';

-- Gives any scroll the pupil has earned and not been given: gold trophies in two different games (not 'hub' rewards),
-- or three different earned pictures. Safe to call again. Returns how many it gave.
create function public.give_name_scrolls(who uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  given integer := 0;
  added integer;
begin
  if (select count(distinct t.game) from public.trophy_counts(who) c join public.trophy_types t on t.id = c.trophy
      where c.level >= 3 and t.game <> 'hub') >= 2 then
    insert into public.name_scrolls (player, how) values (who, 'two-golds') on conflict do nothing;
    get diagnostics added = row_count;
    given := given + added;
  end if;
  if (select count(*) from public.trophy_counts(who) c join public.trophy_types t on t.id = c.trophy where t.kind = 'picture') >= 3 then
    insert into public.name_scrolls (player, how) values (who, 'pictures') on conflict do nothing;
    get diagnostics added = row_count;
    given := given + added;
  end if;
  return given;
end;
$$;

-- Every trophy win checks for a scroll. A failure only warns, so a game's save never fails because of it.
create function public.trophies_give_name_scrolls()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.give_name_scrolls(new.player);
  exception when others then
    raise warning 'give_name_scrolls failed for %: %', new.player, sqlerrm;
  end;
  return new;
end;
$$;
create trigger trophies_give_name_scrolls after insert on public.trophies
for each row execute function public.trophies_give_name_scrolls();

-- Anyone who has earned one already.
select public.give_name_scrolls(p.player) from (select distinct player from public.trophies) p;

-- ---------------------------------------------------------------------------
-- 4. Requests (copied from warp_requests)
-- ---------------------------------------------------------------------------

create table public.name_requests (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  -- The pupil's class when they asked (null if in none: then only a school admin sees it).
  class_id uuid references public.classes (id) on delete set null,
  scroll_id uuid not null references public.name_scrolls (id) on delete cascade,
  wanted text not null check (wanted ~ '^[A-Z][a-z]+( [A-Z][a-z]+)?$' and char_length(wanted) between 2 and 14),
  -- 'taken': the teacher said Yes but someone else had the name by then; the scroll is free again.
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled', 'taken')),
  created_at timestamptz not null default now(),
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz
);
-- A pupil waits on one request at a time.
create unique index name_requests_one_pending on public.name_requests (player) where status = 'pending';
create index name_requests_class on public.name_requests (class_id) where status = 'pending';
comment on table public.name_requests is
  'Earn your own name: typed names waiting for a teacher. Never shown to other pupils. Removed with the account.';

-- ---------------------------------------------------------------------------
-- 5. Name history
-- ---------------------------------------------------------------------------

-- A name a player had, and when it stopped being theirs. Kept for teachers (the newest 30 per player).
create table public.name_history (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  until timestamptz not null default now(),
  -- Who changed it: the player themself (a made-up name from the lists), a teacher, or nobody (the server).
  changed_by uuid references public.profiles (id) on delete set null
);
create index name_history_player on public.name_history (player, until desc);
comment on table public.name_history is 'Earn your own name: past player names, for teachers. Removed with the account.';

create function public.remember_old_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.name_history (player, name, changed_by) values (old.id, old.display_name, auth.uid());
  delete from public.name_history h
  where h.player = old.id and h.id not in (select k.id from public.name_history k where k.player = old.id order by k.until desc, k.id desc limit 30);
  return new;
end;
$$;
create trigger remember_old_name after update of display_name on public.profiles
for each row when (old.display_name is distinct from new.display_name) execute function public.remember_old_name();

alter table public.name_scrolls enable row level security;
alter table public.name_requests enable row level security;
alter table public.name_history enable row level security;
-- No policy and no grant: everything goes through the functions below.
revoke all on public.name_scrolls, public.name_requests, public.name_history from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. What a pupil does
-- ---------------------------------------------------------------------------

-- A free scroll: not used, and not held by a waiting request.
create function public.free_name_scroll(who uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id from public.name_scrolls s
  where s.player = who and s.used_at is null
    and not exists (select 1 from public.name_requests r where r.scroll_id = s.id and r.status = 'pending')
  order by s.given_at, s.id limit 1
$$;

-- Did they pick a made-up name themself today (NZ day)?
create function public.picked_name_today(who uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.name_history h
    where h.player = who and h.changed_by = who and public.nz_day(h.until) = public.nz_day(now()))
$$;

-- { scrolls, waiting: { name, askedAt } | null, last: { name, status, at } | null, canPickToday, typed }.
-- `last` is the newest answer in the past 7 days, so the pupil hears "No" or "taken". Only ever their own.
create function public.my_name_status()
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
    'typed', exists (select 1 from public.profiles p where p.id = me and not public.is_made_up_name(p.display_name)));
end;
$$;

-- Ask for a typed name. Uses a free scroll; nothing changes until a teacher says Yes. Returns the tidied name.
create function public.ask_for_my_name(typed text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  scroll uuid;
  tidy text;
begin
  perform public.require_school_user();
  if exists (select 1 from public.name_requests r where r.player = me and r.status = 'pending') then
    raise exception 'Your teacher hasn''t answered your last name yet.' using errcode = '22023';
  end if;
  scroll := public.free_name_scroll(me);
  if scroll is null then
    raise exception 'You need a Name Scroll to make up your own name.' using errcode = '42501';
  end if;
  tidy := public.own_name_check(typed, me);
  -- Only names already in use count: a classmate's waiting name is never shown or hinted at.
  if exists (select 1 from public.profiles p where lower(p.display_name) = lower(tidy) and p.id <> me) then
    raise exception 'Someone already has that name. Try another.' using errcode = '23505';
  end if;
  if exists (select 1 from public.profiles p where p.id = me and p.display_name = tidy) then
    raise exception 'That''s your name already!' using errcode = '22023';
  end if;
  insert into public.name_requests (player, class_id, scroll_id, wanted)
  values (me, public.current_class_of(me), scroll, tidy);
  return tidy;
end;
$$;

create function public.cancel_my_name_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  update public.name_requests set status = 'cancelled', answered_at = now()
  where player = auth.uid() and status = 'pending';
end;
$$;

-- Student: pick a new name from the word lists. The number is chosen for them. Pupils may change it once a day (NZ).
create or replace function public.choose_my_name(adjective text, animal text)
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
  if public.picked_name_today(auth.uid()) and not public.is_teacher() then
    raise exception 'You can pick a new name once a day. Come back tomorrow!' using errcode = '22023';
  end if;
  new_name := public.pick_display_name(adjective, animal);
  update public.profiles set display_name = new_name where id = auth.uid();
  return new_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. What a teacher does
-- ---------------------------------------------------------------------------

-- Typed names waiting for my Yes, from the pupils I may manage. The pupil's current name and real name sit beside it.
create function public.teacher_name_requests()
returns table(id uuid, class_id uuid, class_name text, student_id uuid, student_name text, real_name text, wanted text, asked_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select r.id, r.class_id, c.name, r.player, p.display_name, split_part(u.email, '@', 1)::text, r.wanted, r.created_at
  from public.name_requests r
  join public.profiles p on p.id = r.player
  left join auth.users u on u.id = r.player
  left join public.classes c on c.id = r.class_id
  where r.status = 'pending' and r.player in (select public.my_students())
  order by r.created_at;
end;
$$;

-- Yes or No. Yes swaps the name in now (the old one goes to the history) and uses the scroll; No leaves the scroll free.
-- Returns { status: 'approved' | 'declined' | 'taken', name }.
create function public.teacher_answer_name(request uuid, approve boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  asked public.name_requests;
  tidy text;
begin
  perform public.require_teacher();
  select * into asked from public.name_requests r
  where r.id = request and r.status = 'pending' and r.player in (select public.my_students())
  for update;
  if not found then
    raise exception 'That name isn''t waiting any more.' using errcode = '22023';
  end if;
  if approve is null then
    raise exception 'Say Yes or No.' using errcode = '22023';
  end if;
  if not approve then
    update public.name_requests set status = 'declined', answered_by = auth.uid(), answered_at = now() where id = request;
    return jsonb_build_object('status', 'declined', 'name', asked.wanted);
  end if;
  tidy := public.own_name_check(asked.wanted, asked.player);
  begin
    update public.profiles set display_name = tidy where id = asked.player;
  exception when unique_violation then
    update public.name_requests set status = 'taken', answered_by = auth.uid(), answered_at = now() where id = request;
    return jsonb_build_object('status', 'taken', 'name', tidy);
  end;
  update public.name_scrolls set used_at = now() where id = asked.scroll_id;
  update public.name_requests set status = 'approved', answered_by = auth.uid(), answered_at = now() where id = request;
  return jsonb_build_object('status', 'approved', 'name', tidy);
end;
$$;

-- The names a pupil had, newest first: [{ name, until, by: 'pupil' | 'teacher' | null, madeUp }].
create function public.teacher_name_history(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return coalesce((
    select jsonb_agg(jsonb_build_object('name', h.name, 'until', h.until,
      'by', case when h.changed_by = student then 'pupil' when h.changed_by is not null then 'teacher' end,
      'madeUp', public.is_made_up_name(h.name)) order by h.until desc, h.id desc)
    from public.name_history h where h.player = student), '[]'::jsonb);
end;
$$;

-- Put the made-up name back: their last made-up name if nobody has it now, otherwise a new random one. Returns the name.
create function public.teacher_made_up_name_back(student uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_name text;
  back text;
begin
  perform public.require_teacher_of(student);
  select p.display_name into now_name from public.profiles p where p.id = student;
  if public.is_made_up_name(now_name) then
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

-- A teacher can give a pupil a scroll. Only one unused teacher scroll at a time. Returns true if a new one was given.
create function public.teacher_give_name_scroll(student uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  if exists (select 1 from public.name_scrolls s where s.player = student and s.how = 'teacher' and s.used_at is null) then
    return false;
  end if;
  insert into public.name_scrolls (player, how, given_by) values (student, 'teacher', auth.uid());
  return true;
end;
$$;

-- What the teacher's pupil page shows: { scrolls, waiting: name | null, typed }.
create function public.teacher_name_scrolls(student uuid)
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
    'typed', exists (select 1 from public.profiles p where p.id = student and not public.is_made_up_name(p.display_name)));
end;
$$;

-- Old answers go after 30 days, as with Class Warp. The scroll keeps its used_at; the history keeps the names.
create function public.tidy_name_requests()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.name_requests where status <> 'pending' and created_at < now() - interval '30 days';
$$;
select cron.schedule('tidy-name-requests', '41 3 * * *', 'select public.tidy_name_requests()');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.is_made_up_name(text), public.rude_inside_words(), public.rude_alone_words(), public.stretchy_rule(text[]),
  public.own_name_check(text, uuid), public.give_name_scrolls(uuid), public.trophies_give_name_scrolls(),
  public.remember_old_name(), public.free_name_scroll(uuid), public.picked_name_today(uuid),
  public.my_name_status(), public.ask_for_my_name(text), public.cancel_my_name_request(),
  public.teacher_name_requests(), public.teacher_answer_name(uuid, boolean), public.teacher_name_history(uuid),
  public.teacher_made_up_name_back(uuid), public.teacher_give_name_scroll(uuid), public.teacher_name_scrolls(uuid),
  public.tidy_name_requests()
from public, anon, authenticated;

grant execute on function
  public.my_name_status(), public.ask_for_my_name(text), public.cancel_my_name_request(),
  public.teacher_name_requests(), public.teacher_answer_name(uuid, boolean), public.teacher_name_history(uuid),
  public.teacher_made_up_name_back(uuid), public.teacher_give_name_scroll(uuid), public.teacher_name_scrolls(uuid)
to authenticated;
