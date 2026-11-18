-- Class quest rewards, stage 5: Game Coins (docs/QUEST-REWARDS-PLAN.md). A quest in one of six games with money can give a
-- pouch of that game's money. The pouch is the quest_rewards row itself (reward 'coins', detail {game, amount}); it waits
-- unopened until the pupil next opens that game, which adds the money to their save and marks the reward used.
--
-- Why the games open it, not the quest: each game rolls its own day and New Season in TypeScript, so money added straight
-- to a save could land in a season about to be reset. Each game's load calls open_coin_pouches after that handling, with
-- the version it just read, so a save in flight is never overwritten. Archery has no versions, so archery_state opens its
-- pouches itself.

-- ---------------------------------------------------------------------------
-- 1. Which game, and how much
-- ---------------------------------------------------------------------------

-- The game a quest kind's pouch is spent in, or null if that game has no money. Mirrors COINS_GAMES in shared/quests/rewards.ts.
create function public.quest_coins_game(which text)
returns text
language sql
stable
set search_path = ''
as $$
  select case k.switch_column
           when 'trader_enabled' then 'trader'
           when 'lord_enabled' then 'dragon-maths'
           when 'clans_enabled' then 'clan-quest'
           when 'clan_raids_enabled' then 'clan-quest'
           when 'archery_enabled' then 'archery'
           when 'diamond_enabled' then 'diamond'
           when 'isles_enabled' then 'isles'
         end
  from public.quest_kinds k where k.id = which
$$;

-- What a pouch holds. Mirrors COIN_POUCH in shared/quests/rewards.ts. Dragon Maths counts forest wins: the game turns
-- them into gold at the hero's level when it opens the pouch.
create function public.quest_coins_amount(game text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case game
           when 'trader' then 200
           when 'dragon-maths' then 5
           when 'clan-quest' then 150
           when 'archery' then 150
           when 'diamond' then 75
           when 'isles' then 75
         end
$$;

-- ---------------------------------------------------------------------------
-- 2. Quests can give Game Coins
-- ---------------------------------------------------------------------------

-- As stage 3, plus Game Coins for quests in a game with money. Mirrors shared/quests/rewards.ts.
create or replace function public.quest_reward_fits(which text, reward text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select which is not null
     and (reward in ('scroll', 'title')
          or (reward = 'turns' and public.quest_turns_game(which) is not null)
          or (reward = 'coins' and public.quest_coins_game(which) is not null))
$$;

-- As stage 3, plus: a pouch waits unopened, remembering its game and amount.
create or replace function public.quest_reward_give(who uuid, won_quest uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.class_quests;
  scroll uuid;
  game text;
begin
  select * into q from public.class_quests cq where cq.id = won_quest;
  if q.id is null then
    return;
  end if;
  if q.reward = 'scroll' then
    insert into public.name_scrolls (player, how) values (who, 'quest') returning id into scroll;
    insert into public.quest_rewards (player, quest, kind, reward, detail)
    values (who, q.id, q.kind, q.reward, jsonb_build_object('scroll', scroll))
    on conflict do nothing;
  elsif q.reward = 'title' then
    insert into public.quest_rewards (player, quest, kind, reward)
    values (who, q.id, q.kind, q.reward)
    on conflict do nothing;
  elsif q.reward = 'turns' and public.quest_turns_game(q.kind) is not null then
    insert into public.quest_rewards (player, quest, kind, reward, detail)
    values (who, q.id, q.kind, q.reward, jsonb_build_object('game', public.quest_turns_game(q.kind)))
    on conflict do nothing;
  elsif q.reward = 'coins' then
    game := public.quest_coins_game(q.kind);
    if game is not null then
      insert into public.quest_rewards (player, quest, kind, reward, detail)
      values (who, q.id, q.kind, q.reward, jsonb_build_object('game', game, 'amount', public.quest_coins_amount(game)))
      on conflict do nothing;
    end if;
  end if;
end;
$$;

-- As stage 3, plus 'game' and 'amount' (a pouch's game, and what it held once opened).
create or replace function public.my_quest_rewards()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select r.*, case
                  when r.used_at is not null then r.used_at
                  when r.reward = 'scroll' then coalesce(
                    s.used_at,
                    (select n.created_at from public.name_requests n where n.scroll_id = s.id and n.status = 'pending'),
                    case when s.id is null then r.got_at end)
                end as done_at
    from public.quest_rewards r
    left join public.name_scrolls s on s.id = (r.detail ->> 'scroll')::uuid
    where r.player = auth.uid() and public.is_school_user())
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id, 'reward', m.reward, 'kind', m.kind, 'gotAt', m.got_at, 'usedAt', m.done_at,
           'title', m.detail ->> 'title', 'day', m.detail ->> 'day',
           'game', m.detail ->> 'game', 'amount', (m.detail ->> 'got')::integer)
         order by m.done_at is not null, m.got_at desc), '[]'::jsonb)
  from mine m
$$;

-- ---------------------------------------------------------------------------
-- 3. Opening pouches
-- ---------------------------------------------------------------------------

-- Opens every unopened pouch the player has for one of the five saved games, if their save is still at expected_version.
-- per_unit multiplies each pouch (Dragon Maths: gold per forest win at the hero's level; 1 for the others).
-- Returns { amount, version } (the money added and the save's new version), or null if there was nothing to open, the save
-- is missing or has moved on (the next load tries again). Called by the game's edge function only.
create function public.open_coin_pouches(player uuid, game text, expected_version integer, per_unit integer default 1)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[];
  total integer;
  new_version integer;
begin
  if game not in ('trader', 'dragon-maths', 'clan-quest', 'diamond', 'isles') or per_unit is null or per_unit < 1 then
    raise exception 'Unknown pouch game.' using errcode = '22023';
  end if;
  select array_agg(r.id), sum((r.detail ->> 'amount')::integer)::integer * per_unit
  into ids, total
  from (select q.id, q.detail from public.quest_rewards q
        where q.player = open_coin_pouches.player and q.reward = 'coins' and q.used_at is null
          and q.detail ->> 'game' = open_coin_pouches.game
        for update) r;
  if ids is null or total is null or total <= 0 then
    return null;
  end if;

  if game = 'trader' then
    update public.trader_games t
    set game = jsonb_set(t.game, '{t,credits}', to_jsonb((t.game #>> '{t,credits}')::bigint + total)),
        net_worth = least(t.net_worth::bigint + total, 2147483647)::integer, version = t.version + 1, updated_at = now()
    where t.player = open_coin_pouches.player and t.version = expected_version
      and jsonb_typeof(t.game #> '{t,credits}') = 'number'
    returning t.version into new_version;
  elsif game = 'dragon-maths' then
    update public.lord_heroes h
    set hero = jsonb_set(h.hero, '{gold}', to_jsonb((h.hero ->> 'gold')::bigint + total)), version = h.version + 1, saved_at = now()
    where h.player = open_coin_pouches.player and h.version = expected_version and jsonb_typeof(h.hero -> 'gold') = 'number'
    returning h.version into new_version;
  elsif game = 'clan-quest' then
    update public.clans c
    set gold = least(c.gold + total, 100000000), version = c.version + 1
    where c.player = open_coin_pouches.player and c.version = expected_version
    returning c.version into new_version;
  elsif game = 'diamond' then
    update public.diamond_players d
    set state = jsonb_set(d.state, '{coins}', to_jsonb(coalesce((d.state ->> 'coins')::bigint, 0) + total)),
        version = d.version + 1, updated_at = now()
    where d.player = open_coin_pouches.player and d.version = expected_version
    returning d.version into new_version;
  elsif game = 'isles' then
    update public.isles_islands i
    set island = jsonb_set(i.island, '{coins}', to_jsonb(coalesce((i.island ->> 'coins')::bigint, 0) + total)),
        version = i.version + 1
    where i.player = open_coin_pouches.player and i.version = expected_version and i.island is not null
    returning i.version into new_version;
  end if;

  if new_version is null then
    return null;
  end if;
  update public.quest_rewards q
  set used_at = now(), detail = q.detail || jsonb_build_object('got', (q.detail ->> 'amount')::integer * per_unit)
  where q.id = any (ids);
  return jsonb_build_object('amount', total, 'version', new_version);
end;
$$;

-- As 20261029000200, plus: opens the player's Archery pouches (no versions here: coins are added in one update) and says
-- how many coins they held as 'pouch' (0 if none).
create or replace function public.archery_state(player uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.archery_players;
  pouch integer;
begin
  perform public.gem_keep_check_player(player);
  insert into public.archery_players (player) values (player) on conflict do nothing;
  perform public.archery_tidy_fights(player);
  with opened as (
    update public.quest_rewards q
    set used_at = now(), detail = q.detail || jsonb_build_object('got', (q.detail ->> 'amount')::integer)
    where q.player = archery_state.player and q.reward = 'coins' and q.used_at is null and q.detail ->> 'game' = 'archery'
    returning (q.detail ->> 'amount')::integer as amount)
  select coalesce(sum(o.amount), 0)::integer into pouch from opened o;
  if pouch > 0 then
    update public.archery_players p set coins = p.coins + pouch, updated_at = now() where p.player = archery_state.player;
  end if;
  select * into me from public.archery_players p where p.player = archery_state.player;
  return public.archery_view(me) || (
    select jsonb_build_object('roundsToday', count(*) filter (where r.earns)::integer, 'coinsToday', coalesce(sum(r.coins), 0)::integer)
    from public.archery_rounds r
    where r.player = archery_state.player and r.created_at > now() - interval '1 day')
    || jsonb_build_object('pouch', pouch);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.quest_coins_game(text), public.quest_coins_amount(text),
  public.open_coin_pouches(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.open_coin_pouches(uuid, text, integer, integer) to service_role;
