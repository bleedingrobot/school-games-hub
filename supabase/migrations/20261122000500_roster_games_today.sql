-- The Students tab: which games each student played today and how many questions in each.
--
-- teacher_class_overview(target_class) also sends 'today': one entry per game a student was shown questions in today (the
-- school's day, Pacific/Auckland), most questions first, as [{ "game": "dragon-maths", "shown": 12 }, ...]. Everything else,
-- and every check, is as before.

create or replace function public.teacher_class_overview(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null then
    raise exception 'Choose a class first.' using errcode = '22023';
  end if;
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return (
    with roster as (
      select * from public.teacher_students(target_class)
    ),
    asked as (
      select q.player, count(*)::integer as shown, count(*) filter (where q.skipped)::integer as skipped, max(q.at) as last_at
      from public.question_log q
      where q.player in (select r.id from roster r) and q.at > now() - interval '7 days'
      group by q.player
    ),
    per_game as (
      select q.player, q.game, count(*)::integer as shown
      from public.question_log q
      where q.player in (select r.id from roster r)
        and q.at > now() - interval '2 days'
        and (q.at at time zone 'Pacific/Auckland')::date = (now() at time zone 'Pacific/Auckland')::date
      group by q.player, q.game
    ),
    today as (
      select g.player, jsonb_agg(jsonb_build_object('game', g.game, 'shown', g.shown) order by g.shown desc, g.game) as games
      from per_game g
      group by g.player
    )
    select jsonb_build_object(
      'students', coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'name', r.display_name, 'realName', r.real_name, 'avatar', r.avatar, 'hidden', r.hidden,
          'games', r.bot_games + r.friend_games, 'points', r.points, 'lastPlayed', r.last_played,
          'lastActive', greatest(r.last_played, a.last_at),
          'shown', coalesce(a.shown, 0), 'skipped', coalesce(a.skipped, 0),
          'today', coalesce(t.games, '[]'),
          'focus', public.maths_focus_of(r.id))
        order by r.display_name), '[]'))
    from roster r
    left join asked a on a.player = r.id
    left join today t on t.player = r.id
  );
end;
$$;
