-- Class quest rewards, stage 2: Hero Titles (docs/QUEST-REWARDS-PLAN.md). A teacher can now start any quest with a Hero Title
-- as its reward. A win leaves an unused reward in My rewards; the pupil picks a title from a fixed list, owns it for good, and
-- wears it under their name. The worn title lives in the avatar's `title` key, so every screen that already gets the avatar
-- (leaderboards included) gets the title with it. Only the server writes that key.

-- ---------------------------------------------------------------------------
-- 1. The list and who owns what
-- ---------------------------------------------------------------------------

-- Mirrors shared/quests/titles.ts (src/quests/titles.test.ts checks they match).
create function public.hero_title_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'the-brave', 'the-kind', 'the-curious', 'the-bold', 'the-wise', 'the-cheerful', 'the-patient', 'the-steady',
    'moon-walker', 'star-seeker', 'gem-finder', 'dragon-friend', 'kind-captain', 'cloud-rider', 'wave-surfer',
    'number-explorer', 'puzzle-solver', 'map-maker', 'treasure-hunter', 'forest-ranger', 'sky-sailor', 'comet-chaser',
    'glow-worm-keeper', 'kiwi-guardian', 'storm-dancer', 'quest-keeper', 'rainbow-maker', 'monster-tamer',
    'castle-builder', 'river-runner', 'mountain-climber', 'light-bringer'
  ]::text[]
$$;

create table public.owned_titles (
  player uuid not null references public.profiles (id) on delete cascade,
  title text not null check (title = any (public.hero_title_ids())),
  got_at timestamptz not null default now(),
  primary key (player, title)
);
alter table public.owned_titles enable row level security;
comment on table public.owned_titles is 'Hero Titles won from class quests. Kept through New Season; removed with the account.';

-- ---------------------------------------------------------------------------
-- 2. Quests can now give a Hero Title
-- ---------------------------------------------------------------------------

-- As stage 1, plus Hero Title for every quest. Mirrors shared/quests/rewards.ts.
create or replace function public.quest_reward_fits(which text, reward text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select reward in ('scroll', 'title') and which is not null
$$;

-- As stage 1, plus: a Hero Title waits unused in My rewards until the pupil picks one.
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
  end if;
end;
$$;

-- As stage 1, plus 'title': the title a used Hero Title became.
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
           'title', m.detail ->> 'title')
         order by m.done_at is not null, m.got_at desc), '[]'::jsonb)
  from mine m
$$;

-- ---------------------------------------------------------------------------
-- 3. Using a reward, and wearing a title
-- ---------------------------------------------------------------------------

-- Spends one of my unused rewards. Stage 2: a Hero Title, choice {"title": "<id>"}. The new title is worn straight away.
create function public.use_quest_reward(reward_id uuid, choice jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.quest_rewards;
  picked text := choice ->> 'title';
begin
  perform public.require_school_user();
  select * into r from public.quest_rewards q where q.id = reward_id and q.player = auth.uid() for update;
  if r.id is null then
    raise exception 'That reward isn''t yours.' using errcode = '42501';
  end if;
  if r.used_at is not null then
    raise exception 'You''ve already used that reward.' using errcode = '22023';
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

-- Wears one of my titles, or none (null).
create function public.set_my_title(title text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_school_user();
  if set_my_title.title is null then
    update public.profiles p set avatar = p.avatar - 'title' where p.id = auth.uid();
    return;
  end if;
  if not exists (select 1 from public.owned_titles o where o.player = auth.uid() and o.title = set_my_title.title) then
    raise exception 'You haven''t won that title yet.' using errcode = '22023';
  end if;
  update public.profiles p set avatar = p.avatar || jsonb_build_object('title', set_my_title.title) where p.id = auth.uid();
end;
$$;

-- My titles: { owned: [ids, oldest first], wearing: id or null }.
create function public.my_titles()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'owned', coalesce((select jsonb_agg(o.title order by o.got_at, o.title) from public.owned_titles o where o.player = auth.uid()),
                      '[]'::jsonb),
    'wearing', (select p.avatar ->> 'title' from public.profiles p where p.id = auth.uid()))
  where public.is_school_user()
$$;

-- As 20261112000800, plus: the worn title is the server's, never what the browser sent, so saving a new look keeps it.
create or replace function public.save_my_avatar(avatar jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean jsonb;
  lvl integer;
  worn text;
begin
  perform public.require_school_user();
  if not public.is_valid_avatar(avatar) then
    raise exception 'That avatar isn''t valid.' using errcode = '22023';
  end if;
  clean := save_my_avatar.avatar - 'picTier' - 'title';
  if clean ? 'pic' then
    select c.level into lvl
    from public.trophy_counts(auth.uid()) c join public.trophy_types t on t.id = c.trophy
    where c.trophy = clean ->> 'pic' and t.kind = 'picture';
    if lvl is null then
      raise exception 'You haven''t won that picture yet.' using errcode = '22023';
    end if;
    clean := clean || jsonb_build_object('picTier', public.trophy_tier(lvl));
  end if;
  select p.avatar ->> 'title' into worn from public.profiles p where p.id = auth.uid();
  if worn is not null then
    clean := clean || jsonb_build_object('title', worn);
  end if;
  update public.profiles set avatar = clean where id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function public.hero_title_ids(), public.use_quest_reward(uuid, jsonb), public.set_my_title(text), public.my_titles()
from public, anon, authenticated;
grant execute on function public.use_quest_reward(uuid, jsonb), public.set_my_title(text), public.my_titles() to authenticated;
