-- Class quest rewards, stage 4: Quest Frames (docs/QUEST-REWARDS-PLAN.md). A teacher can start any quest with a Quest Frame
-- as its reward. A win leaves an unused reward in My rewards; the pupil picks a frame from a fixed list, owns it for good,
-- and wears it around their avatar. Like the Hero Title, the worn frame lives in the avatar (its `frame` key), so every
-- screen that gets the avatar gets the frame. Only the server writes that key.

-- ---------------------------------------------------------------------------
-- 1. The list and who owns what
-- ---------------------------------------------------------------------------

-- Mirrors shared/quests/frames.ts (shared/quests/frames.test.ts checks they match).
create function public.quest_frame_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['vine', 'flame', 'starfield', 'crystal', 'ocean', 'autumn', 'laurel', 'glow-worm']::text[]
$$;

create table public.owned_frames (
  player uuid not null references public.profiles (id) on delete cascade,
  frame text not null check (frame = any (public.quest_frame_ids())),
  got_at timestamptz not null default now(),
  primary key (player, frame)
);
alter table public.owned_frames enable row level security;
comment on table public.owned_frames is 'Quest Frames won from class quests. Kept through New Season; removed with the account.';

-- ---------------------------------------------------------------------------
-- 2. Quests can give a Quest Frame
-- ---------------------------------------------------------------------------

-- As stage 5, plus Quest Frame for every quest. Mirrors shared/quests/rewards.ts.
create or replace function public.quest_reward_fits(which text, reward text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select which is not null
     and (reward in ('scroll', 'title', 'frame')
          or (reward = 'turns' and public.quest_turns_game(which) is not null)
          or (reward = 'coins' and public.quest_coins_game(which) is not null))
$$;

-- As stage 5, plus: a Quest Frame waits unused in My rewards until the pupil picks one.
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
  elsif q.reward in ('title', 'frame') then
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

-- As stage 5, plus 'frame': the frame a used Quest Frame became.
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
           'title', m.detail ->> 'title', 'day', m.detail ->> 'day', 'frame', m.detail ->> 'frame',
           'game', m.detail ->> 'game', 'amount', (m.detail ->> 'got')::integer)
         order by m.done_at is not null, m.got_at desc), '[]'::jsonb)
  from mine m
$$;

-- ---------------------------------------------------------------------------
-- 3. Using a reward, and wearing a frame
-- ---------------------------------------------------------------------------

-- As stage 3, plus a Quest Frame, choice {"frame": "<id>"}. The new frame is worn straight away.
create or replace function public.use_quest_reward(reward_id uuid, choice jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.quest_rewards;
  picked text := choice ->> 'title';
  picked_frame text := choice ->> 'frame';
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

  if r.reward = 'frame' then
    if picked_frame is null or not (picked_frame = any (public.quest_frame_ids())) then
      raise exception 'Pick a frame from the list.' using errcode = '22023';
    end if;
    if exists (select 1 from public.owned_frames o where o.player = auth.uid() and o.frame = picked_frame) then
      raise exception 'You already have that frame. Pick a new one!' using errcode = '22023';
    end if;
    insert into public.owned_frames (player, frame) values (auth.uid(), picked_frame);
    update public.quest_rewards q set used_at = now(), detail = jsonb_build_object('frame', picked_frame) where q.id = r.id;
    update public.profiles p set avatar = p.avatar || jsonb_build_object('frame', picked_frame) where p.id = auth.uid();
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

-- Wears one of my frames, or none (null).
create function public.set_my_frame(frame text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  if set_my_frame.frame is null then
    update public.profiles p set avatar = p.avatar - 'frame' where p.id = auth.uid();
    return;
  end if;
  if not exists (select 1 from public.owned_frames o where o.player = auth.uid() and o.frame = set_my_frame.frame) then
    raise exception 'You haven''t won that frame yet.' using errcode = '22023';
  end if;
  update public.profiles p set avatar = p.avatar || jsonb_build_object('frame', set_my_frame.frame) where p.id = auth.uid();
end;
$$;

-- My frames: { owned: [ids, oldest first], wearing: id or null }.
create function public.my_frames()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'owned', coalesce((select jsonb_agg(o.frame order by o.got_at, o.frame) from public.owned_frames o where o.player = auth.uid()),
                      '[]'::jsonb),
    'wearing', (select p.avatar ->> 'frame' from public.profiles p where p.id = auth.uid()))
  where public.is_school_user()
$$;

-- As 20261119000500, plus: the worn frame is the server's too, so saving a new look keeps both title and frame.
create or replace function public.save_my_avatar(avatar jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean jsonb;
  lvl integer;
  worn jsonb;
begin
  perform public.require_school_user();
  if not public.is_valid_avatar(avatar) then
    raise exception 'That avatar isn''t valid.' using errcode = '22023';
  end if;
  clean := save_my_avatar.avatar - 'picTier' - 'title' - 'frame';
  if clean ? 'pic' then
    select c.level into lvl
    from public.trophy_counts(auth.uid()) c join public.trophy_types t on t.id = c.trophy
    where c.trophy = clean ->> 'pic' and t.kind = 'picture';
    if lvl is null then
      raise exception 'You haven''t won that picture yet.' using errcode = '22023';
    end if;
    clean := clean || jsonb_build_object('picTier', public.trophy_tier(lvl));
  end if;
  select jsonb_strip_nulls(jsonb_build_object('title', p.avatar ->> 'title', 'frame', p.avatar ->> 'frame')) into worn
  from public.profiles p where p.id = auth.uid();
  update public.profiles set avatar = clean || coalesce(worn, '{}'::jsonb) where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.quest_frame_ids(), public.set_my_frame(text), public.my_frames() from public, anon, authenticated;
grant execute on function public.set_my_frame(text), public.my_frames() to authenticated;
