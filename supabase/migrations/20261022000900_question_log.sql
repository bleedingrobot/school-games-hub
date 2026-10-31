-- Question skips, stage S.1 (James, 22 Oct 2026: "too many kids are skipping questions during the games").
-- See docs/QUESTION-SKIPS-PLAN.md.
--
-- Until now no game kept a record of a question a student closed, skipped, ran out of time on or rolled past: only the
-- answers. So the teacher couldn't see who skips. Every game shows its questions in the same box (src/maths/QuestionModal),
-- and the box now notes each question it showed: answered, or closed without an answer (skipped). The website collects those
-- notes and sends them in small batches.
--
-- 1. question_log: one row per question shown. Kept 60 days. Students can't read or write it.
-- 2. log_questions(): the website sends its notes here. Only what the box saw is stored (which game, which kind of question,
--    answered or skipped, how long it was on screen). Nothing here is marked, scored or added to the maths records: the
--    games' own servers still do all of that. A student could leave notes out, but that only hides their own skips.
-- 3. teacher_question_skips(): per student in a class, over the last few days: questions shown, answered, skipped, and
--    the kind of question they skip most; plus the class's totals for each kind of question.
-- 4. A daily tidy that forgets rows older than 60 days.

create table public.question_log (
  id bigint generated always as identity primary key,
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,30}$'),
  spot text not null check (char_length(spot) between 1 and 40),
  skipped boolean not null,
  shown_ms integer not null check (shown_ms between 0 and 3600000),
  at timestamptz not null,
  created_at timestamptz not null default now()
);
create index question_log_player_at on public.question_log (player, at desc);
create index question_log_at on public.question_log (at);

alter table public.question_log enable row level security;
revoke all on public.question_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Saving (the signed-in student, from the website)
-- ---------------------------------------------------------------------------

-- `items` = [{ game, spot, skipped, ms, at (ms since 1970) }], at most 100. Items that can't be read are left out (never an
-- error: a note is never worth a failed request). A time in the future becomes now, and anything more than 2 days old is
-- dropped. At most 3,000 notes a day are kept per student, so a stuck browser can't fill the table.
-- Returns how many were stored.
create function public.log_questions(items jsonb)
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
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) > 100 then
    raise exception 'Those notes could not be read.' using errcode = '22023';
  end if;
  select count(*) into today from public.question_log q where q.player = me and q.created_at > now() - interval '1 day';
  if today >= 3000 then
    return 0;
  end if;
  insert into public.question_log (player, game, spot, skipped, shown_ms, at)
  select me, e ->> 'game', e ->> 'spot', (e ->> 'skipped')::boolean,
         least(greatest(round((e ->> 'ms')::numeric), 0), 3600000)::integer,
         least(to_timestamp((e ->> 'at')::numeric / 1000.0), now())
  from jsonb_array_elements(items) as x(e)
  where jsonb_typeof(e) = 'object'
    and jsonb_typeof(e -> 'game') = 'string' and (e ->> 'game') ~ '^[a-z0-9-]{1,30}$'
    and jsonb_typeof(e -> 'spot') = 'string' and char_length(e ->> 'spot') between 1 and 40
    and jsonb_typeof(e -> 'skipped') = 'boolean'
    and jsonb_typeof(e -> 'ms') = 'number'
    and jsonb_typeof(e -> 'at') = 'number' and (e ->> 'at')::numeric between 0 and 1e14
    and to_timestamp((e ->> 'at')::numeric / 1000.0) > now() - interval '2 days'
  limit 3000 - today;
  get diagnostics stored = row_count;
  return stored;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reading (teachers)
-- ---------------------------------------------------------------------------

-- For one class the teacher teaches (or, with no class, all their students), over the last `days` days (1 to 60):
--   students: [{ id, name, realName, shown, answered, skipped, topSkip: { game, spot, skipped } | null }], most skipped first
--   spots:    [{ game, spot, shown, skipped }], most skipped first
-- Students who saw no questions are left out of `students`.
create function public.teacher_question_skips(target_class uuid default null, days integer default 7)
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
  if target_class is not null and not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  since := now() - make_interval(days => days);
  select coalesce(array_agg(s.id), '{}') into kids
  from public.my_students() s(id)
  where target_class is null or exists (select 1 from public.class_members m where m.student_id = s.id and m.class_id = target_class);

  return jsonb_build_object(
    'students', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'id', t.player, 'name', p.display_name, 'realName', split_part(u.email, '@', 1),
          'shown', t.shown, 'answered', t.shown - t.skipped, 'skipped', t.skipped,
          'topSkip', (
            select jsonb_build_object('game', q.game, 'spot', q.spot, 'skipped', count(*))
            from public.question_log q
            where q.player = t.player and q.at > since and q.skipped
            group by q.game, q.spot order by count(*) desc, q.game, q.spot limit 1))
          order by t.skipped desc, t.shown desc, p.display_name), '[]')
      from (
        select q.player, count(*)::integer as shown, count(*) filter (where q.skipped)::integer as skipped
        from public.question_log q
        where q.player = any (kids) and q.at > since
        group by q.player) t
      join public.profiles p on p.id = t.player
      join auth.users u on u.id = t.player),
    'spots', (
      select coalesce(jsonb_agg(jsonb_build_object('game', s.game, 'spot', s.spot, 'shown', s.shown, 'skipped', s.skipped)
          order by s.skipped desc, s.shown desc, s.game, s.spot), '[]')
      from (
        select q.game, q.spot, count(*)::integer as shown, count(*) filter (where q.skipped)::integer as skipped
        from public.question_log q
        where q.player = any (kids) and q.at > since
        group by q.game, q.spot) s));
end;
$$;

-- ---------------------------------------------------------------------------
-- Tidy
-- ---------------------------------------------------------------------------

create function public.question_log_tidy()
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.question_log where at < now() - interval '60 days' $$;

select cron.schedule('tidy-question-log', '17 3 * * *', 'select public.question_log_tidy()');

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.log_questions(jsonb), public.teacher_question_skips(uuid, integer), public.question_log_tidy()
from public, anon, authenticated;
grant execute on function public.log_questions(jsonb), public.teacher_question_skips(uuid, integer) to authenticated;
