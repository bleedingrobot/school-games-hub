-- "Reset my turns in every game" for teachers (James, 23 Nov 2026): one button on a teacher's own profile page gives back
-- today's turns in every game with a daily limit, for the teacher's own account only, so they can keep trying games out.
-- Pupils can't use it: the function refuses anyone who isn't a teacher.
--
-- Games that keep a "left today" count are topped back up to a full day (never lowered, so saved-up turns stay):
--   Clan Quest fights (and the free wake), Dragon Maths forest and arena fights, skills, master try and health,
--   Star Trader jumps, Sky Isles turns (and races and challenges), Diamond Drop's new level, Toon Flap's new level.
--   Each save's version goes up by one, so an open game tab reloads instead of saving over it.
-- Games that count today's plays instead (Maths Monsters battles, Toon Flap wins and Sky Dashes, Goblin Storm runs,
-- Marble Rush runs) get a Bonus Turns Day for today (bonus_turns), exactly like a pupil's quest reward: no plays are
-- deleted, and those games are unlimited for the teacher until midnight.
--
-- Returns the names of the games the teacher has played that were reset (or given a bonus day), for the button's message.

create function public.teacher_reset_my_turns()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  s public.app_settings;
  today_date date := (now() at time zone 'Pacific/Auckland')::date;
  done text[] := '{}';
begin
  if me is null or not public.is_teacher() then
    raise exception 'Only teachers can reset their turns.' using errcode = '42501';
  end if;
  select * into s from public.settings_of(me);

  -- Clan Quest
  update public.clans c
  set fights_left = greatest(c.fights_left, public.clan_fights_per_day(me)), wakes_today = 0, version = c.version + 1
  where c.player = me;
  if found then done := done || 'Clan Quest'::text; end if;

  -- Dragon Maths
  update public.lord_heroes h
  set hero = h.hero || jsonb_build_object(
        'forestLeft', greatest(coalesce((h.hero ->> 'forestLeft')::integer, 0), coalesce(s.lord_forest_per_day, 10)),
        'arenaLeft', 3, 'skillLeft', 3, 'masterTried', false, 'hp', coalesce(h.hero -> 'maxHp', h.hero -> 'hp')),
      version = h.version + 1
  where h.player = me and h.hero is not null;
  if found then done := done || 'Dragon Maths'::text; end if;

  -- Star Trader
  update public.trader_games g
  set game = jsonb_set(g.game, '{t,jumpsLeft}',
        to_jsonb(greatest(coalesce((g.game -> 't' ->> 'jumpsLeft')::integer, 0), coalesce(s.trader_jumps, 10)))),
      version = g.version + 1
  where g.player = me and g.game -> 't' is not null;
  if found then done := done || 'Star Trader'::text; end if;

  -- Sky Isles
  update public.isles_islands i
  set island = i.island || jsonb_build_object(
        'turnsLeft', greatest(coalesce((i.island ->> 'turnsLeft')::integer, 0), 6),
        'racesToday', 0, 'winsToday', 0, 'challengedToday', 0, 'racedWith', '[]'::jsonb),
      version = i.version + 1
  where i.player = me and i.island is not null;
  if found then done := done || 'Sky Isles'::text; end if;

  -- Diamond Drop: today's new level opens again.
  update public.diamond_players d
  set state = d.state || '{"newLevelDate": null}'::jsonb, version = d.version + 1
  where d.player = me;
  if found then done := done || 'Diamond Drop'::text; end if;

  -- Toon Flap: today's new level opens again (wins and Sky Dashes get the bonus day below).
  update public.toonflap_progress t
  set progress = t.progress || '{"openedDay": null}'::jsonb, version = t.version + 1
  where t.player = me;

  -- Games that count today's plays: a Bonus Turns Day for today.
  insert into public.bonus_turns (player, game, day)
  select me, g, today_date from unnest(array['monsters', 'toonflap', 'goblinstorm', 'marble']) g
  on conflict do nothing;
  done := done || array['Maths Monsters', 'Toon Flap', 'Goblin Storm', 'Marble Rush'];

  return done;
end;
$$;

revoke all on function public.teacher_reset_my_turns() from public, anon;
grant execute on function public.teacher_reset_my_turns() to authenticated;
