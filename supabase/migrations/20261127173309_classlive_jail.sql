-- Class Live: Real-life Four Corners (docs/JAIL-PLAN.md). Nothing is deleted; only rows and one new function are added
-- (docs/CLASSLIVE-PLAN.md section 5 "Adding an activity").
--
--   1. The 'jail' activity: the class plays Four Corners for real in the room, nobody moves an avatar (moves = false).
--      Shared iPads are jail stations: an out pupil taps their name and answers questions to get back in.
--   2. classlive_class_pupils(class): the class list for the stations (id and name), read by the classlive function when
--      the teacher opens the room. Server only.
--   3. One trophy, counted from each player's `extra` in classlive_finish: jail_backs (times back in the game).

insert into public.classlive_activities (id, name, moves, max_speed, reward_line, sort) values
  ('jail', 'Real-life Four Corners', false, 0.6, null, 17);

create function public.classlive_class_pupils(target_class uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by p.display_name), '[]'::jsonb)
  from public.class_members m
  join public.profiles p on p.id = m.student_id
  where m.class_id = target_class and p.role = 'student'
$$;

revoke execute on function public.classlive_class_pupils(uuid) from public, anon, authenticated;
grant execute on function public.classlive_class_pupils(uuid) to service_role;

insert into public.achievement_measures (measure) values ('classlive_jail_backs');

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort, how, tier) values
  ('classlive-jail-backs', 'classlive', 'Jailbreak', '🔓', 'classlive_jail_backs', 10, 47, 'Answer your way out of jail 10 times in Real-life Four Corners.', 1);
