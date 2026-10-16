-- Teachers see each student's real name: the part of their school email before the @
-- (e.g. "jane.smith"). Only the teacher list returns it; profiles still never store it,
-- and students, leaderboards and the lobby never see it.

-- The return type changes, so the old function has to go first.
drop function public.teacher_students();

create function public.teacher_students()
returns table (
  id uuid,
  display_name text,
  real_name text,
  avatar jsonb,
  role text,
  hidden boolean,
  bot_games integer,
  friend_games integer,
  points integer,
  last_played timestamptz,
  joined timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  return query
  select p.id, p.display_name, split_part(u.email, '@', 1)::text, p.avatar, p.role, p.hidden,
         (select count(*)::integer from public.bot_games b where b.player = p.id),
         (select count(*)::integer from public.mp_games m
          where m.status = 'finished' and p.id in (m.first_player, m.second_player))
         + (select count(*)::integer from public.space_games s
          where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4))
         + (select count(*)::integer from public.card_games c
          where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4)),
         public.points_total(p.id),
         greatest(
           (select max(b.finished_at) from public.bot_games b where b.player = p.id),
           (select max(m.finished_at) from public.mp_games m
            where m.status = 'finished' and p.id in (m.first_player, m.second_player)),
           (select max(s.finished_at) from public.space_games s
            where s.status = 'finished' and p.id in (s.seat1, s.seat2, s.seat3, s.seat4)),
           (select max(c.finished_at) from public.card_games c
            where c.status = 'finished' and p.id in (c.seat1, c.seat2, c.seat3, c.seat4))),
         p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  order by p.role desc, split_part(u.email, '@', 1), p.display_name;
end;
$$;

revoke execute on function public.teacher_students() from public, anon, authenticated;
grant execute on function public.teacher_students() to authenticated;
