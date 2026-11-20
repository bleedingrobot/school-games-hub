-- Class quest rewards, stage 1 (docs/QUEST-REWARDS-PLAN.md): the teacher picks a reward when starting a quest; everyone who
-- finishes it gets that reward. Stage 1 gives only the Rename Scroll (a Name Scroll, used through the own-name flow); the
-- other four rewards are listed so the teacher can see them coming, and later stages switch them on in quest_reward_fits.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

-- Every quest has one reward. Quests started before rewards read as 'scroll' but gave nothing (nothing is back-dated).
alter table public.class_quests
  add column reward text not null default 'scroll' check (reward in ('scroll', 'title', 'turns', 'frame', 'coins'));

-- A Name Scroll can now come from a quest. Quests can give many, so there is no once-ever index for it.
alter table public.name_scrolls drop constraint name_scrolls_how_check;
alter table public.name_scrolls add constraint name_scrolls_how_check check (how in ('two-golds', 'pictures', 'teacher', 'quest'));

-- One row per reward a player got from a quest win. Unused rewards wait on the profile ("My rewards").
-- detail: what it became, e.g. {"scroll": <name_scrolls id>}.
create table public.quest_rewards (
  id uuid primary key default gen_random_uuid(),
  player uuid not null references public.profiles (id) on delete cascade,
  quest uuid references public.class_quests (id) on delete set null,
  kind text not null references public.quest_kinds (id),
  reward text not null check (reward in ('scroll', 'title', 'turns', 'frame', 'coins')),
  got_at timestamptz not null default now(),
  used_at timestamptz,
  detail jsonb not null default '{}'::jsonb,
  unique (quest, player)
);
create index quest_rewards_player on public.quest_rewards (player);
alter table public.quest_rewards enable row level security;
comment on table public.quest_rewards is 'Rewards from weekly class quests. Kept through New Season; removed with the account.';

-- ---------------------------------------------------------------------------
-- 2. Which rewards a quest can give
-- ---------------------------------------------------------------------------

-- Stage 1: the Rename Scroll only. Later stages replace this (Hero Title for every quest, Bonus Turns for games with daily
-- turns, Quest Frame for every quest, Game Coins for games with money). Mirrors shared/quests/rewards.ts.
create function public.quest_reward_fits(which text, reward text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select reward = 'scroll' and which is not null
$$;

-- ---------------------------------------------------------------------------
-- 3. Giving the reward
-- ---------------------------------------------------------------------------

-- Gives the quest's reward to whoever just won it. A Rename Scroll becomes a Name Scroll at once.
create function public.quest_reward_give(who uuid, won_quest uuid)
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
  end if;
end;
$$;

-- Every new win gives its reward. A failure only warns, so a game's save never fails because of it.
create function public.quest_wins_give_reward()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.quest is not null then
    begin
      perform public.quest_reward_give(new.player, new.quest);
    exception when others then
      raise warning 'quest_reward_give failed for %: %', new.player, sqlerrm;
    end;
  end if;
  return new;
end;
$$;
create trigger quest_wins_give_reward after insert on public.quest_wins
for each row execute function public.quest_wins_give_reward();

-- ---------------------------------------------------------------------------
-- 4. Starting a quest with a reward
-- ---------------------------------------------------------------------------

drop function public.teacher_start_class_quest(uuid, text);

-- As before, plus the reward (default the Rename Scroll). Refuses a reward that doesn't fit the quest.
create function public.teacher_start_class_quest(target_class uuid, which text, reward text default 'scroll')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.nz_day(now());
  made uuid;
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.quest_kinds k where k.id = which) then
    raise exception 'There is no quest like that.' using errcode = '22023';
  end if;
  if not public.quest_reward_fits(which, coalesce(reward, '')) then
    raise exception 'That reward can''t be given for this quest.' using errcode = '22023';
  end if;
  perform 1 from public.classes c where c.id = target_class for update;
  if exists (select 1 from public.class_quests cq
             where cq.class_id = target_class and cq.stopped_at is null and cq.ends_on >= today) then
    raise exception 'This class already has a quest running. Stop it first.' using errcode = '22023';
  end if;
  insert into public.class_quests (class_id, kind, starts_on, ends_on, started_by, reward)
  values (target_class, which, today, today + 6, auth.uid(), reward)
  returning id into made;
  return made;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Reads
-- ---------------------------------------------------------------------------

-- As stage 2, plus 'reward' (the quest's reward) and 'myReward' (mine from this quest, once won).
create or replace function public.my_class_quest()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  t as (select public.nz_day(now()) as today),
  q as (
    select cq.* from public.class_quests cq, me, t
    where cq.class_id in (select public.quest_classes_of(me.id))
      and cq.stopped_at is null and cq.starts_on <= t.today and cq.ends_on >= t.today - 2
    order by cq.starts_on desc, cq.started_at desc
    limit 1)
  select jsonb_build_object(
    'quest', jsonb_build_object('id', q.id, 'kind', q.kind, 'startsOn', q.starts_on, 'endsOn', q.ends_on, 'daysNeeded', q.days_needed,
                                'rule', k.rule, 'reward', q.reward),
    'today', t.today,
    'days', to_jsonb(p.days),
    'count', p.count,
    'target', p.target,
    'won', exists (select 1 from public.quest_wins w where w.quest = q.id and w.player = me.id),
    'myReward', (select r.id from public.quest_rewards r where r.quest = q.id and r.player = me.id),
    'classWon', (select count(*) from public.quest_wins w where w.quest = q.id),
    'questsDone', (select count(*) from public.quest_wins w where w.player = me.id))
  from q join public.quest_kinds k on k.id = q.kind, me, t, lateral public.quest_progress(me.id, q.id) p
$$;

-- My quest rewards, unused first. A Rename Scroll counts as used once its Name Scroll is used or waiting on the teacher.
create function public.my_quest_rewards()
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
           'id', m.id, 'reward', m.reward, 'kind', m.kind, 'gotAt', m.got_at, 'usedAt', m.done_at)
         order by m.done_at is not null, m.got_at desc), '[]'::jsonb)
  from mine m
$$;

-- As stage 2, plus each quest's 'reward'.
create or replace function public.teacher_class_quests(target_class uuid, which uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  shown public.class_quests;
  settings jsonb;
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class, true) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select * into shown from public.class_quests cq
  where cq.class_id = target_class and (which is null or cq.id = which)
  order by cq.starts_on desc, cq.started_at desc limit 1;
  select to_jsonb(s) into settings from public.app_settings s where s.class_id = target_class;

  return jsonb_build_object(
    'today', public.nz_day(now()),
    -- A kind with no switch is always on; null (not known) when the class has no settings row of its own.
    'switches', (select coalesce(jsonb_object_agg(k.id, case when k.switch_column is null then true
                                                             else (settings ->> k.switch_column)::boolean end), '{}'::jsonb)
                 from public.quest_kinds k),
    'quests', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', cq.id, 'kind', cq.kind, 'startsOn', cq.starts_on, 'endsOn', cq.ends_on, 'stoppedAt', cq.stopped_at,
                 'reward', cq.reward,
                 'won', (select count(*) from public.quest_wins w where w.quest = cq.id))
               order by cq.starts_on desc, cq.started_at desc)
               from (select * from public.class_quests x where x.class_id = target_class
                     order by x.starts_on desc, x.started_at desc limit 30) cq), '[]'::jsonb),
    'shown', shown.id,
    'pupils', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', m.id,
                 'teacher', m.teacher,
                 'name', case when m.teacher then p.display_name end,
                 'days', coalesce(to_jsonb(pr.days), '[]'::jsonb),
                 'count', coalesce(pr.count, 0),
                 'target', pr.target,
                 'won', shown.id is not null and exists (select 1 from public.quest_wins w where w.quest = shown.id and w.player = m.id),
                 'questsDone', (select count(*) from public.quest_wins w where w.player = m.id)) order by m.teacher)
               from (select cm.student_id as id, false as teacher from public.class_members cm where cm.class_id = target_class
                     union
                     select ct.teacher_id, true from public.class_teachers ct where ct.class_id = target_class) m
               join public.profiles p on p.id = m.id and p.role = case when m.teacher then 'teacher' else 'student' end
               left join lateral public.quest_progress(m.id, shown.id) pr on true), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.quest_reward_fits(text, text), public.quest_reward_give(uuid, uuid), public.quest_wins_give_reward(),
  public.teacher_start_class_quest(uuid, text, text), public.my_quest_rewards()
from public, anon, authenticated;

grant execute on function
  public.teacher_start_class_quest(uuid, text, text), public.my_quest_rewards(), public.my_class_quest(),
  public.teacher_class_quests(uuid, uuid)
to authenticated;
