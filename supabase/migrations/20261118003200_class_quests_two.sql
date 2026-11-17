-- Weekly class quests: a daily and a weekly quest at the same time (James, 18 Nov 2026). A class can run one daily quest
-- ('turns' or 'days': play on 5 of 7 days) and one weekly quest ('total' or 'distinct': reach a number in the week) together.
--
--   1. quest_is_daily(): which of the two a rule is
--   2. teacher_start_class_quest() only refuses a second quest of the same kind (daily or weekly)
--   3. teacher_stop_class_quest() can stop one quest (`which`); with no quest given it stops all the class's running quests
--   4. my_class_quests(): both quests for the home page, daily first; the home page answers with it as 'classQuests'
--      (my_class_quest() and 'classQuest' stay as they were, for a page that is still open from before)
--   5. Who can call what

-- ---------------------------------------------------------------------------
-- 1. Daily or weekly
-- ---------------------------------------------------------------------------

create function public.quest_is_daily(rule text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select rule in ('turns', 'days') $$;

-- ---------------------------------------------------------------------------
-- 2. Starting
-- ---------------------------------------------------------------------------

-- Starts a 7-day quest from today. One running daily quest and one running weekly quest per class.
create or replace function public.teacher_start_class_quest(target_class uuid, which text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.nz_day(now());
  daily boolean;
  made uuid;
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select public.quest_is_daily(k.rule) into daily from public.quest_kinds k where k.id = which;
  if daily is null then
    raise exception 'There is no quest like that.' using errcode = '22023';
  end if;
  perform 1 from public.classes c where c.id = target_class for update;
  if exists (select 1 from public.class_quests cq join public.quest_kinds k on k.id = cq.kind
             where cq.class_id = target_class and cq.stopped_at is null and cq.ends_on >= today
               and public.quest_is_daily(k.rule) = daily) then
    raise exception 'This class already has a % quest running. Stop it first.', case when daily then 'daily' else 'weekly' end
      using errcode = '22023';
  end if;
  insert into public.class_quests (class_id, kind, starts_on, ends_on, started_by)
  values (target_class, which, today, today + 6, auth.uid())
  returning id into made;
  return made;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Stopping one quest
-- ---------------------------------------------------------------------------

drop function public.teacher_stop_class_quest(uuid);

-- Stops one of the class's running quests (or all of them when `which` is null). Wins already made stay.
create function public.teacher_stop_class_quest(target_class uuid, which uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  update public.class_quests cq set stopped_at = now()
  where cq.class_id = target_class and (which is null or cq.id = which)
    and cq.stopped_at is null and cq.ends_on >= public.nz_day(now());
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Both quests on the home page
-- ---------------------------------------------------------------------------

-- The player's class quests: for each of daily and weekly, the running one or one that ended in the last 2 days. Daily
-- first. Each is as my_class_quest() answers. An empty list when there is none.
create function public.my_class_quests()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id where public.is_school_user()),
  t as (select public.nz_day(now()) as today),
  q as (
    select distinct on (public.quest_is_daily(k.rule)) cq.*, k.rule, public.quest_is_daily(k.rule) as daily
    from public.class_quests cq join public.quest_kinds k on k.id = cq.kind, me, t
    where cq.class_id in (select public.quest_classes_of(me.id))
      and cq.stopped_at is null and cq.starts_on <= t.today and cq.ends_on >= t.today - 2
    order by public.quest_is_daily(k.rule), cq.starts_on desc, cq.started_at desc)
  select coalesce(jsonb_agg(jsonb_build_object(
    'quest', jsonb_build_object('id', q.id, 'kind', q.kind, 'startsOn', q.starts_on, 'endsOn', q.ends_on, 'daysNeeded', q.days_needed,
                                'rule', q.rule),
    'today', t.today,
    'days', to_jsonb(p.days),
    'count', p.count,
    'target', p.target,
    'won', exists (select 1 from public.quest_wins w where w.quest = q.id and w.player = me.id),
    'classWon', (select count(*) from public.quest_wins w where w.quest = q.id),
    'questsDone', (select count(*) from public.quest_wins w where w.player = me.id)) order by q.daily desc), '[]'::jsonb)
  from q, me, t, lateral public.quest_progress(me.id, q.id) p
$$;

-- The home page gets it in its one answer, as 'classQuests' (same exact-text edit as 20261118000100_class_quests.sql).
do $migration$
declare
  def text := pg_get_functiondef('public.my_home_page()'::regprocedure);
  needle text := '''classQuest'', public.my_class_quest(),';
begin
  if (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 then
    raise exception 'my_home_page edit did not match exactly once; nothing was changed';
  end if;
  def := replace(def, needle, '''classQuests'', public.my_class_quests(), ' || needle);
  execute def;
end;
$migration$;

-- ---------------------------------------------------------------------------
-- 5. Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.quest_is_daily(text), public.my_class_quests(), public.teacher_stop_class_quest(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.my_class_quests(), public.teacher_stop_class_quest(uuid, uuid), public.my_home_page()
to authenticated;
