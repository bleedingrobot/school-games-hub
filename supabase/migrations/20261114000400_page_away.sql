-- Leaving the game page (James, 14 Nov 2026 NZ: "can we tell if a pupil alt-tabs or switches to a calculator app?").
--
-- A web page can tell when it is hidden (another tab or app in front) or loses focus (another window clicked), but never
-- which app, and a second device is invisible. So this is a signal, not proof: it may be a calculator, a chat, or a break.
-- James: "It's only going to be a problem if some kids do it a lot", so the teacher sees frequent leavers, not every event.
--
-- The website (src/data/pageAway.ts) notes each time a pupil leaves a game page and comes back after 3 seconds or more,
-- with how long they were away and the kind of question showing, if a question box was open.
--
-- 1. page_away: one row per time away. Kept 60 days. Pupils can't read or write it.
-- 2. log_page_away(): the website sends its notes here. Teachers' own notes are not kept.
-- 3. teacher_page_away(): per pupil in a class over the last few days: times away, times away during a question, time away,
--    long breaks (over 10 minutes, not counted as times away), questions shown, days, the game most left.
-- 4. A daily tidy that forgets rows older than 60 days.

create table public.page_away (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,30}$'),
  spot text check (spot is null or char_length(spot) between 1 and 40),
  kind text not null check (kind in ('tab', 'window')),
  away_ms integer not null check (away_ms between 0 and 86400000),
  at timestamptz not null,
  created_at timestamptz not null default now()
);

create index page_away_player_at on public.page_away (player, at desc);
create index page_away_at on public.page_away (at);

alter table public.page_away enable row level security;
revoke all on public.page_away from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saving (the signed-in pupil, from the website)
-- ---------------------------------------------------------------------------
-- `items` = [{ game, spot (string or null), kind ('tab' | 'window'), ms, at (ms since 1970, when they left) }], at most 50.
-- Items that can't be read are left out. A time in the future becomes now; anything over 2 days old is dropped. At most
-- 500 a day are kept per pupil. A teacher's notes are not kept. Returns how many were stored.
create function public.log_page_away(items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  today integer;
  stored integer;
begin
  perform public.require_school_user();
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 50 then
    raise exception 'Those notes could not be read.' using errcode = '22023';
  end if;
  if public.is_teacher() then
    return 0;
  end if;
  select count(*) into today from public.page_away a where a.player = me and a.created_at > now() - interval '1 day';
  if today >= 500 then
    return 0;
  end if;
  insert into public.page_away (player, game, spot, kind, away_ms, at)
  select me, e ->> 'game', nullif(e ->> 'spot', ''), e ->> 'kind',
         least(greatest(round((e ->> 'ms')::numeric), 0), 86400000)::integer,
         least(to_timestamp((e ->> 'at')::numeric / 1000.0), now())
  from jsonb_array_elements(items) as x(e)
  where jsonb_typeof(e) = 'object'
    and jsonb_typeof(e -> 'game') = 'string' and (e ->> 'game') ~ '^[a-z0-9-]{1,30}$'
    and (e -> 'spot' is null or jsonb_typeof(e -> 'spot') = 'null'
         or (jsonb_typeof(e -> 'spot') = 'string' and char_length(e ->> 'spot') between 1 and 40))
    and jsonb_typeof(e -> 'kind') = 'string' and (e ->> 'kind') in ('tab', 'window')
    and jsonb_typeof(e -> 'ms') = 'number' and (e ->> 'ms')::numeric >= 3000
    and jsonb_typeof(e -> 'at') = 'number' and (e ->> 'at')::numeric between 0 and 1e14
    and to_timestamp((e ->> 'at')::numeric / 1000.0) > now() - interval '2 days'
  limit 500 - today;
  get diagnostics stored = row_count;
  return stored;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading (teachers)
-- ---------------------------------------------------------------------------
-- For one class the teacher teaches, over the last `days` days (1 to 60), pupils who left at least once:
--   [{ id, name, realName, times, duringQuestion, awaySecs, longBreaks, questions, days, topGame, lastAt }], most times first.
-- times: away 3 seconds to 10 minutes. longBreaks: away over 10 minutes (a break, not counted in times).
-- awaySecs: time away over those `times`. questions: questions shown to the pupil in the same days (question_log).
create function public.teacher_page_away(target_class uuid, days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  kids uuid[];
  since timestamptz;
begin
  perform public.require_teacher();
  if days is null or days < 1 or days > 60 then
    raise exception 'Choose between 1 and 60 days.' using errcode = '22023';
  end if;
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  since := now() - make_interval(days => days);
  select coalesce(array_agg(s.id), '{}') into kids
  from public.my_students() s(id)
  where exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.player, 'name', p.display_name, 'realName', split_part(u.email, '@', 1),
        'times', t.times, 'duringQuestion', t.during_question, 'awaySecs', t.away_secs, 'longBreaks', t.long_breaks,
        'questions', (select count(*)::integer from public.question_log q where q.player = t.player and q.at > since),
        'days', t.days, 'lastAt', t.last_at,
        'topGame', (
          select a.game from public.page_away a
          where a.player = t.player and a.at > since and a.away_ms <= 600000
          group by a.game order by count(*) desc, a.game limit 1))
        order by t.times desc, t.during_question desc, p.display_name), '[]')
    from (
      select a.player,
             count(*) filter (where a.away_ms <= 600000)::integer as times,
             count(*) filter (where a.away_ms <= 600000 and a.spot is not null)::integer as during_question,
             coalesce(sum(a.away_ms) filter (where a.away_ms <= 600000), 0)::bigint / 1000 as away_secs,
             count(*) filter (where a.away_ms > 600000)::integer as long_breaks,
             count(distinct (a.at at time zone 'Pacific/Auckland')::date) filter (where a.away_ms <= 600000)::integer as days,
             max(a.at) as last_at
      from public.page_away a
      where a.player = any (kids) and a.at > since
      group by a.player) t
    join public.profiles p on p.id = t.player
    join auth.users u on u.id = t.player
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Tidy
-- ---------------------------------------------------------------------------
create function public.page_away_tidy()
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.page_away where at < now() - interval '60 days' $$;

select cron.schedule('tidy-page-away', '23 3 * * *', 'select public.page_away_tidy()');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
revoke execute on function
  public.log_page_away(jsonb), public.teacher_page_away(uuid, integer), public.page_away_tidy()
from public, anon, authenticated;
grant execute on function public.log_page_away(jsonb), public.teacher_page_away(uuid, integer) to authenticated;
