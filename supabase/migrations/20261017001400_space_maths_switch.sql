-- Mission Control maths, stage M.5: the teacher's switch and three achievements.
--
-- 1. app_settings.space_maths: 'off', 'choose' (students choose, the default) or 'on' (everyone).
--    Students read it like the reactions switch; the space-game and save-bot-game functions check it too.
-- 2. Three achievements, measured from the per-game counts kept in scored_games.space:
--    maths_right (right answers), boosts (powered-up wormholes), escapes (half-falls from a black hole).

alter table public.app_settings add column space_maths text not null default 'choose'
  check (space_maths in ('off', 'choose', 'on'));

create function public.teacher_set_space_maths(mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if mode is null or mode not in ('off', 'choose', 'on') then
    raise exception 'Unknown maths setting' using errcode = '22023';
  end if;
  update public.app_settings set space_maths = mode where id;
end;
$$;

alter table public.achievement_types drop constraint achievement_types_measure_check;
alter table public.achievement_types add constraint achievement_types_measure_check
  check (measure in ('games', 'wins', 'beat_very_easy', 'beat_easy', 'beat_medium', 'friend_wins', 'rank',
    'checkmates', 'crowns', 'friend_games', 'wormholes', 'blocks', 'star_kinds', 'docks',
    'zero_hands', 'triples', 'knock_wins', 'saved_by_three',
    'levels_won', 'level_keys', 'three_star_levels', 'stars',
    'maths_right', 'boosts', 'escapes'));

-- Same as Stage 11 (Gem Keep), plus the three maths counts.
create or replace function public.progress_counts(who uuid, which_game text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'games', count(*),
    'wins', count(*) filter (where s.result = 'won'),
    'beat_very_easy', count(*) filter (where s.result = 'won' and s.bot_level = 'very-easy'),
    'beat_easy', count(*) filter (where s.result = 'won' and s.bot_level = 'easy'),
    'beat_medium', count(*) filter (where s.result = 'won' and s.bot_level = 'medium'),
    'friend_wins', count(*) filter (where s.result = 'won' and s.kind = 'friend'),
    'checkmates', count(*) filter (where s.result = 'won' and s.reason = 'checkmate'),
    'crowns', coalesce(sum(s.crowns), 0),
    'rank', coalesce((select r.best_rank from public.ratings r where r.player = who and r.game = which_game), 0),
    'friend_games', count(*) filter (where s.kind = 'friend'),
    'wormholes', coalesce(sum((s.space ->> 'wormholes')::integer), 0),
    'blocks', coalesce(sum((s.space ->> 'blocks')::integer), 0),
    'docks', count(*) filter (where (s.space ->> 'docked')::boolean),
    'star_kinds', (select count(distinct star) from public.scored_games s2,
                     jsonb_array_elements_text(coalesce(s2.space -> 'stars', '[]')) as star
                   where s2.player = who and s2.game = which_game),
    'maths_right', coalesce(sum((s.space ->> 'mathsRight')::integer), 0),
    'boosts', coalesce(sum((s.space ->> 'boosts')::integer), 0),
    'escapes', coalesce(sum((s.space ->> 'escapes')::integer), 0),
    'zero_hands', coalesce(sum((s.card101 ->> 'zeroHands')::integer), 0),
    'triples', coalesce(sum((s.card101 ->> 'triples')::integer), 0),
    'knock_wins', coalesce(sum((s.card101 ->> 'knockWins')::integer), 0),
    'saved_by_three', coalesce(sum((s.card101 ->> 'savedByThree')::integer), 0),
    'levels_won', (select count(*) from public.gem_keep_progress g where g.player = who and g.wins > 0),
    'level_keys', (select count(*) from public.gem_keep_progress g where g.player = who and g.key_passed),
    'three_star_levels', (select count(*) from public.gem_keep_progress g where g.player = who and g.best_stars = 3),
    'stars', (select coalesce(sum(g.best_stars), 0) from public.gem_keep_progress g where g.player = who)
  )
  from public.scored_games s
  where s.player = who and s.game = which_game
$$;

insert into public.achievement_types (id, game, name, emoji, measure, goal, sort) values
  ('space-mission-control', 'space', 'Mission Control: 10 right answers in space games', '🧮', 'maths_right', 10, 7),
  ('space-wormhole-booster', 'space', 'Wormhole booster: power up a wormhole', '⚡', 'boosts', 1, 8),
  ('space-great-escape', 'space', 'Great escape: escape half a black hole with maths', '🕳️', 'escapes', 1, 9);

revoke execute on function public.teacher_set_space_maths(text) from public, anon, authenticated;
grant execute on function public.teacher_set_space_maths(text) to authenticated;
