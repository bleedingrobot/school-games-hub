-- Class quest rewards, stage 3: Bonus Turns Day (docs/QUEST-REWARDS-PLAN.md). A quest in one of the six games with daily
-- turns can give a Bonus Turns Day. The pupil uses it from My rewards on a day they choose: for the rest of that New Zealand
-- day, that game's turn limit is lifted for them alone, exactly as the teacher's "Unlimited turns today" switch does for a
-- class (normal turns first, then extra turns with full game rewards but no hub points).
--
-- How the games see it: settings_of(player) now adds the pupil's own bonus day to the settings row's unlimited_days. Every
-- game reads its turns through settings_of (directly, or through unlimited_today / unlimited_games), so no game changes.

-- ---------------------------------------------------------------------------
-- 1. The bonus days
-- ---------------------------------------------------------------------------

create table public.bonus_turns (
  player uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('dragon-maths', 'clan-quest', 'monsters', 'diamond', 'trader', 'isles')),
  day date not null,
  reward uuid references public.quest_rewards (id) on delete set null,
  primary key (player, day, game)
);
alter table public.bonus_turns enable row level security;
comment on table public.bonus_turns is 'Bonus Turns Days from class quests: one game, one NZ day, one pupil.';

-- Which "Unlimited turns today" game a quest kind is played in, or null if that game has no daily turns.
create function public.quest_turns_game(which text)
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
           when 'monsters_enabled' then 'monsters'
           when 'diamond_enabled' then 'diamond'
           when 'isles_enabled' then 'isles'
         end
  from public.quest_kinds k where k.id = which
$$;

-- As 20261018002400, plus the player's own bonus day for today, added to unlimited_days.
create or replace function public.settings_of(player uuid)
returns setof public.app_settings
language sql
stable
security definer
set search_path = ''
as $$
  select merged.*
  from public.app_settings s
  cross join lateral jsonb_populate_record(s, jsonb_build_object('unlimited_days', s.unlimited_days || coalesce(
    (select jsonb_object_agg(b.game, to_char(b.day, 'YYYY-MM-DD'))
     from public.bonus_turns b
     where b.player = settings_of.player and b.day = (now() at time zone 'Pacific/Auckland')::date),
    '{}'::jsonb))) merged
  where s.id = public.settings_id_of(player)
$$;

-- ---------------------------------------------------------------------------
-- 2. Quests can give a Bonus Turns Day
-- ---------------------------------------------------------------------------

-- As stage 2, plus Bonus Turns Day for quests in a game with daily turns. Mirrors shared/quests/rewards.ts.
-- No longer immutable: it reads the quest's game.
create or replace function public.quest_reward_fits(which text, reward text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select which is not null
     and (reward in ('scroll', 'title') or (reward = 'turns' and public.quest_turns_game(which) is not null))
$$;
revoke execute on function public.quest_reward_fits(text, text), public.quest_turns_game(text) from public, anon, authenticated;

-- As stage 2, plus: a Bonus Turns Day waits unused in My rewards, remembering its game.
create or replace function public.quest_reward_give(who uuid, won_quest uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.class_quests;
  scroll uuid;
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
  end if;
end;
$$;

-- As stage 2, plus 'day': the NZ day a used Bonus Turns Day was for.
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
           'title', m.detail ->> 'title', 'day', m.detail ->> 'day')
         order by m.done_at is not null, m.got_at desc), '[]'::jsonb)
  from mine m
$$;

-- As stage 2, plus a Bonus Turns Day (no choice needed): today, in the quest's game.
create or replace function public.use_quest_reward(reward_id uuid, choice jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.quest_rewards;
  picked text := choice ->> 'title';
  today date := (now() at time zone 'Pacific/Auckland')::date;
  game text;
begin
  perform public.require_school_user();
  select * into r from public.quest_rewards q where q.id = reward_id and q.player = auth.uid() for update;
  if r.id is null then
    raise exception 'That reward isn''t yours.' using errcode = '42501';
  end if;
  if r.used_at is not null then
    raise exception 'You''ve already used that reward.' using errcode = '22023';
  end if;

  if r.reward = 'turns' then
    game := r.detail ->> 'game';
    if game is null then
      raise exception 'That reward can''t be used here yet.' using errcode = '22023';
    end if;
    if public.unlimited_today(auth.uid(), game) then
      raise exception 'You already have unlimited turns in that game today. Save this for another day!' using errcode = '22023';
    end if;
    insert into public.bonus_turns (player, game, day, reward) values (auth.uid(), game, today, r.id);
    update public.quest_rewards q
    set used_at = now(), detail = q.detail || jsonb_build_object('day', to_char(today, 'YYYY-MM-DD'))
    where q.id = r.id;
    return;
  end if;

  if r.reward <> 'title' then
    raise exception 'That reward can''t be used here yet.' using errcode = '22023';
  end if;
  if picked is null or not (picked = any (public.hero_title_ids())) then
    raise exception 'Pick a title from the list.' using errcode = '22023';
  end if;
  if exists (select 1 from public.owned_titles o where o.player = auth.uid() and o.title = picked) then
    raise exception 'You already have that title. Pick a new one!' using errcode = '22023';
  end if;
  insert into public.owned_titles (player, title) values (auth.uid(), picked);
  update public.quest_rewards q set used_at = now(), detail = jsonb_build_object('title', picked) where q.id = r.id;
  update public.profiles p set avatar = p.avatar || jsonb_build_object('title', picked) where p.id = auth.uid();
end;
$$;
