-- Class Showdown stage 6 (docs/SHOWDOWN-PLAN.md section 4.2): Gold Rush, the second arena. The round (seams, who digs
-- where) lives in the room's hidden round like Boss Bounty's, so the only change is letting a room be a Gold Rush.
-- Nothing is deleted.
alter table public.showdown_rooms drop constraint showdown_rooms_arena_check,
  add constraint showdown_rooms_arena_check check (arena in ('boss', 'goldrush'));

-- A finished Gold Rush pays like Boss Bounty but beats no boss: when done.roster is false, showdown_finish skips the
-- roster and doesn't count a boss beaten for achievements.
create or replace function public.showdown_finish(target bigint, done jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_class uuid;
  p jsonb;
  who uuid;
  the_boss text := done ->> 'boss';
  was_beaten boolean := coalesce((done ->> 'beaten')::boolean, false);
  -- Gold Rush rounds (roster false) pay the same but beat no boss: no roster row, and no boss for achievements.
  boss_round boolean := coalesce((done ->> 'roster')::boolean, true);
  amount integer;
begin
  select r.class_id into room_class from public.showdown_rooms r where r.id = target;
  if room_class is null then
    return 'gone';
  end if;
  insert into public.showdown_finished (room, seed) values (target, (done ->> 'seed')::bigint) on conflict do nothing;
  if not found then
    return 'paid';
  end if;
  if was_beaten and boss_round and the_boss in ('river-titan', 'storm-kraken', 'clockwork-colossus', 'comet-wyrm') then
    insert into public.showdown_roster (class_id, boss, best_ms)
    values (room_class, the_boss, greatest(0, least(coalesce((done ->> 'ms')::integer, 0), 3600000)))
    on conflict (class_id, boss) do update
      set best_ms = least(public.showdown_roster.best_ms, excluded.best_ms), times = public.showdown_roster.times + 1;
  end if;
  for p in select * from jsonb_array_elements(coalesce(done -> 'players', '[]')) loop
    who := (p ->> 'player')::uuid;
    if public.current_class_of(who) is distinct from room_class then
      continue;
    end if;
    perform public.add_game_points(who, 'showdown', least(greatest(coalesce((p ->> 'points')::integer, 0), 0), 10),
      'showdown:' || target || ':' || (done ->> 'seed'));
    amount := least(greatest(coalesce((p ->> 'amount')::integer, 0), 0), 100);
    if amount > 0 and p ->> 'game' = 'goblinstorm' then
      insert into public.goblinstorm_saves (player, gold) values (who, amount)
      on conflict (player) do update set gold = public.goblinstorm_saves.gold + excluded.gold, updated_at = now();
    elsif amount > 0 and p ->> 'game' = 'archery' then
      insert into public.archery_players (player, coins) values (who, amount)
      on conflict (player) do update set coins = public.archery_players.coins + excluded.coins, updated_at = now();
    end if;
    insert into public.showdown_stats as s (player, rounds, bosses_beaten, last_hits, shields, revives, best_streak, bosses)
    values (who, 1, case when was_beaten and boss_round then 1 else 0 end, case when (p ->> 'lastHit')::boolean then 1 else 0 end,
      greatest(coalesce((p ->> 'shields')::integer, 0), 0), greatest(coalesce((p ->> 'revives')::integer, 0), 0),
      greatest(coalesce((p ->> 'bestStreak')::integer, 0), 0), case when was_beaten and boss_round then array[the_boss] else '{}' end)
    on conflict (player) do update set
      rounds = s.rounds + 1,
      bosses_beaten = s.bosses_beaten + excluded.bosses_beaten,
      last_hits = s.last_hits + excluded.last_hits,
      shields = s.shields + excluded.shields,
      revives = s.revives + excluded.revives,
      best_streak = greatest(s.best_streak, excluded.best_streak),
      bosses = (select array_agg(distinct b) from unnest(s.bosses || excluded.bosses) b),
      updated_at = now();
    perform public.game_progress_changed(who, 'showdown');
  end loop;
  return 'ok';
end;
$$;
