-- Games Hub Pulse for teachers (James, 27 Nov 2026 NZ): the site-wide "how is the hub being used" page, live on the teacher
-- area (/teacher/:classId/pulse) instead of only on James's Claude dashboard. Counts only: no pupil names, no maths results
-- per pupil, so it is safe on a projector. Pupils are the school's students who are not hidden; days and hours are NZ time.
--
-- What one "go" is, per game (keep in step with src/teacher/pulse/games.ts):
--   scored_games rows (one per finished, scored game) for every game below that has no table of its own;
--   marble_runs, kingdom_reigns, decree_reigns (finished), toonflap_runs (finished), goblinstorm_runs (finished),
--   circuit_runs, mine_runs, gem_keep_runs, starweb_skies (finished), glyph_goes and orderup_sets (started: few finish),
--   a Foundational game's finished rounds, training_sessions (kind 'quick' = Quick looks, 'facts' = Basic facts training),
--   Star Trader = one per pupil per NZ day they answered a trader question (question_log),
--   Class Live and Class Showdown = one per pupil per session they joined (classlive_players / showdown_players).
-- Games counted from their own table are left out of the scored_games part, so nothing is counted twice.

create function public.pulse_plays(school integer)
returns table (game text, player uuid, at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with kids as (
    select p.id from public.profiles p where p.school_id = school and p.role = 'student' and not p.hidden
  ),
  plays(game, player, at) as (
    select s.game, s.player, s.finished_at from public.scored_games s
    where s.game not in ('toonflap', 'goblinstorm', 'decree', 'mine', 'starweb', 'circuit', 'gem-keep', 'trader', 'classlive', 'showdown', 'kingdom', 'marble')
    union all select 'marble', r.player, r.created_at from public.marble_runs r
    union all select 'kingdom', r.player, r.created_at from public.kingdom_reigns r
    union all select 'decree', r.player, r.finished_at from public.decree_reigns r where r.finished_at is not null
    union all select 'toonflap', r.player, r.finished_at from public.toonflap_runs r where r.finished_at is not null
    union all select 'goblinstorm', r.player, r.finished_at from public.goblinstorm_runs r where r.finished_at is not null
    union all select 'circuit', r.player, r.created_at from public.circuit_runs r
    union all select 'mine', r.player, r.created_at from public.mine_runs r
    union all select 'gem-keep', r.player, r.finished_at from public.gem_keep_runs r
    union all select 'starweb', r.player, r.finished_at from public.starweb_skies r where r.finished_at is not null
    union all select 'glyph', r.player, r.started_at from public.glyph_goes r
    union all select 'orderup', r.player, r.started_at from public.orderup_sets r
    union all select 'trader', q.player, min(q.at) from public.question_log q where q.game = 'trader'
      group by q.player, (q.at at time zone 'Pacific/Auckland')::date
    union all select 'beanstalk', r.player, r.finished_at from public.beanstalk_rounds r where r.finished_at is not null
    union all select 'hop', r.player, r.finished_at from public.hop_rounds r where r.finished_at is not null
    union all select 'pipi', r.player, r.finished_at from public.pipi_rounds r where r.finished_at is not null
    union all select 'korora', r.player, r.finished_at from public.korora_rounds r where r.finished_at is not null
    union all select 'weka', r.player, r.finished_at from public.weka_rounds r where r.finished_at is not null
    union all select 'tui', r.player, r.finished_at from public.tui_rounds r where r.finished_at is not null
    union all select 'robin', r.player, r.finished_at from public.robin_rounds r where r.finished_at is not null
    union all select 'parrot', r.player, r.finished_at from public.parrot_rounds r where r.finished_at is not null
    union all select 'lizard', r.player, r.finished_at from public.lizard_rounds r where r.finished_at is not null
    union all select 'pigeon', r.player, r.finished_at from public.pigeon_rounds r where r.finished_at is not null
    union all select 'swamphen', r.player, r.finished_at from public.swamphen_rounds r where r.finished_at is not null
    union all select case t.kind when 'quick' then 'quick-looks' else 'training' end, t.player, t.finished_at
      from public.training_sessions t where t.finished_at is not null and t.kind in ('quick', 'facts')
    union all select 'classlive', c.player, r.opened_at
      from public.classlive_players c join public.classlive_rooms r on r.id = c.room
    union all select 'showdown', c.player, r.opened_at
      from public.showdown_players c join public.showdown_rooms r on r.id = c.room
  )
  select pl.game, pl.player, pl.at from plays pl join kids k on k.id = pl.player where pl.at is not null
$$;

revoke all on function public.pulse_plays(integer) from public, anon, authenticated;

-- Every figure on the page, for one school, with `today` the NZ date. Answer totals (answer_totals) are the hub's running
-- totals: with one school they are the school's; a second school (docs/plans/second-school/PLAN.md) would need them split.
create function public.pulse_summary(school integer, today date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with pulse_p as materialized (
    select p.game, p.player, p.at, (p.at at time zone 'Pacific/Auckland')::date as d,
           extract(hour from p.at at time zone 'Pacific/Auckland')::integer as h,
           extract(isodow from p.at at time zone 'Pacific/Auckland')::integer as dow
    from public.pulse_plays(school) p
  )
  select jsonb_build_object(
    'asOf', now(),
    'today', today,
    'kpis', (
      select jsonb_build_object(
        'pupils', (select count(*) from public.profiles p where p.school_id = school and p.role = 'student' and not p.hidden),
        'activeToday', count(distinct player) filter (where d = today),
        'active7', count(distinct player) filter (where d > today - 7),
        'activePrev7', count(distinct player) filter (where d > today - 14 and d <= today - 7),
        'active28', count(distinct player) filter (where d > today - 28),
        'activeEver', count(distinct player),
        'playsToday', count(*) filter (where d = today),
        'plays7', count(*) filter (where d > today - 7),
        'playsPrev7', count(*) filter (where d > today - 14 and d <= today - 7),
        'playsEver', count(*),
        'schoolHours7', count(*) filter (where d > today - 7 and dow <= 5 and h >= 9 and h < 15),
        'outsideHours7', count(*) filter (where d > today - 7 and not (dow <= 5 and h >= 9 and h < 15)))
      from pulse_p),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('d', s.d, 'plays', coalesce(x.plays, 0), 'players', coalesce(x.players, 0),
               'answered', coalesce(a.answered, 0), 'correct', coalesce(a.correct, 0)) order by s.d), '[]')
      from generate_series(today - 27, today, interval '1 day') s0(day)
      cross join lateral (select s0.day::date as d) s
      left join (select d, count(*) as plays, count(distinct player) as players from pulse_p group by d) x on x.d = s.d
      left join (select t.day, sum(t.answered) as answered, sum(t.correct) as correct from public.answer_totals t
                 where t.day is not null group by t.day) a on a.day = s.d),
    'games', (
      select coalesce(jsonb_agg(g.row), '[]') from (
        select jsonb_build_object(
          'id', game,
          'today', count(*) filter (where d = today),
          'plays7', count(*) filter (where d > today - 7),
          'playsPrev7', count(*) filter (where d > today - 14 and d <= today - 7),
          'players7', count(distinct player) filter (where d > today - 7),
          'plays28', count(*) filter (where d > today - 28),
          'playsEver', count(*),
          'playersEver', count(distinct player),
          'firstAt', min(at),
          'lastAt', max(at)) as row
        from pulse_p group by game) g),
    'live', (
      select coalesce(jsonb_agg(l), '[]') from (
        select jsonb_build_object('id', r.activity, 'sessions', count(distinct r.id),
                 'sessions28', count(distinct r.id) filter (where (r.opened_at at time zone 'Pacific/Auckland')::date > today - 28),
                 'pupils', count(distinct c.player), 'joins', count(c.player), 'lastAt', max(r.opened_at)) as l
        from public.classlive_rooms r
        join public.classes k on k.id = r.class_id and k.school_id = school
        left join (public.classlive_players c join public.profiles p on p.id = c.player and p.role = 'student' and not p.hidden)
          on c.room = r.id
        where r.activity is not null
        group by r.activity
        union all
        select jsonb_build_object('id', 'showdown-' || r.arena, 'sessions', count(distinct r.id),
                 'sessions28', count(distinct r.id) filter (where (r.opened_at at time zone 'Pacific/Auckland')::date > today - 28),
                 'pupils', count(distinct c.player), 'joins', count(c.player), 'lastAt', max(r.opened_at))
        from public.showdown_rooms r
        join public.classes k on k.id = r.class_id and k.school_id = school
        left join (public.showdown_players c join public.profiles p on p.id = c.player and p.role = 'student' and not p.hidden)
          on c.room = r.id
        group by r.arena) q),
    'classes', (
      select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'students', c.students,
               'playing7', c.playing7, 'plays7', c.plays7, 'playsPrev7', c.prev7) order by c.plays7 desc, c.name), '[]')
      from (
        select k.id, k.name, count(distinct m.student_id) as students,
               (select count(distinct x.player) from pulse_p x join public.class_members mm on mm.student_id = x.player
                 where mm.class_id = k.id and x.d > today - 7) as playing7,
               (select count(*) from pulse_p x join public.class_members mm on mm.student_id = x.player
                 where mm.class_id = k.id and x.d > today - 7) as plays7,
               (select count(*) from pulse_p x join public.class_members mm on mm.student_id = x.player
                 where mm.class_id = k.id and x.d > today - 14 and x.d <= today - 7) as prev7
        from public.classes k
        left join (public.class_members m join public.profiles p on p.id = m.student_id and p.role = 'student' and not p.hidden)
          on m.class_id = k.id
        where k.school_id = school and not k.archived
        group by k.id, k.name) c),
    'hours', (
      select jsonb_agg(jsonb_build_object('h', hh,
               'weekday', (select count(*) from pulse_p x where x.d > today - 28 and x.h = hh and x.dow <= 5),
               'weekend', (select count(*) from pulse_p x where x.d > today - 28 and x.h = hh and x.dow > 5)) order by hh)
      from generate_series(0, 23) hh),
    'answers', (
      select coalesce(jsonb_agg(jsonb_build_object('source', t.source, 'answered', t.answered, 'correct', t.correct,
               'week', t.week, 'weekCorrect', t.week_correct, 'today', t.today) order by t.answered desc), '[]')
      from (
        select a.source, sum(a.answered) as answered, sum(a.correct) as correct,
               coalesce(sum(a.answered) filter (where a.day > today - 7), 0) as week,
               coalesce(sum(a.correct) filter (where a.day > today - 7), 0) as week_correct,
               coalesce(sum(a.answered) filter (where a.day = today), 0) as today
        from public.answer_totals a group by a.source) t)
  )
$$;

revoke all on function public.pulse_summary(integer, date) from public, anon, authenticated;

-- The whole page in one request. Any teacher may read their own school's pulse.
create function public.teacher_pulse()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  school integer;
begin
  perform public.require_teacher();
  school := public.my_school();
  if school is null then
    raise exception 'You aren''t in a school yet.' using errcode = '42501';
  end if;
  return public.pulse_summary(school, (now() at time zone 'Pacific/Auckland')::date);
end;
$$;

revoke all on function public.teacher_pulse() from public, anon;
grant execute on function public.teacher_pulse() to authenticated;
