-- Skill map K5: when a pupil first answered each fact, so the Skill map can say how long they have been on a skill and who is
-- stuck (on a Learning skill for 14 days or more).
--   * gem_keep_facts.first_seen: set when a row is first made. Rows already there stay empty (null): we never guess.
--   * record_fact_answers: same function, same arguments, body copied from 20261111000600_fact_wrong_answers.sql. The only
--     change is the new row it builds for a first answer, which needs a value for the new column (the insert's own column list
--     leaves first_seen to its default, and an update never touches it).
--   * teacher_class_skill_map: each fact also returns `firstSeen` (epoch ms, or null).
-- Nothing is dropped or deleted.
alter table public.gem_keep_facts add column first_seen timestamptz;
alter table public.gem_keep_facts alter column first_seen set default now();

create or replace function public.record_fact_answers(
  player uuid,
  pack text,
  batch_id uuid,
  answers jsonb,
  quick_ms integer,
  fluent_days integer,
  top_box integer,
  min_ms integer default 0
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  f public.gem_keep_facts;
  answered timestamptz;
  day date;
  added integer := 0;
begin
  perform public.gem_keep_check_player(player);
  insert into public.fact_answer_batches (player, batch_id) values (player, batch_id) on conflict do nothing;
  if not found then
    return 0;
  end if;
  for a in
    select e ->> 'key' as key, (e ->> 'correct')::boolean as correct, (e ->> 'ms')::integer as ms,
           (e ->> 'at')::bigint as at, e ->> 'given' as given
    from jsonb_array_elements(answers) with ordinality as x(e, n)
    order by x.n
  loop
    answered := to_timestamp(a.at / 1000.0);
    day := (answered at time zone 'Pacific/Auckland')::date;
    select * into f from public.gem_keep_facts g
    where g.player = record_fact_answers.player and g.pack = record_fact_answers.pack and g.fact_key = a.key
    for update;
    if not found then
      f := row(player, pack, a.key, 0, 0, 0, 0, null, '{}', now(), '[]'::jsonb, now())::public.gem_keep_facts;
    end if;
    f.attempts := f.attempts + 1;
    f.correct := f.correct + case when a.correct then 1 else 0 end;
    f.avg_ms := round(f.avg_ms + (a.ms - f.avg_ms)::numeric / f.attempts);
    f.last_seen := answered;
    if not a.correct then
      f.box := 1;
      -- P10: remember what they said, the last three wrong answers (oldest first). An old client sends no `given`.
      if a.given is not null and a.given <> '' then
        f.wrong_recent := (select coalesce(jsonb_agg(v order by n), '[]'::jsonb) from (
          select v, n from jsonb_array_elements(f.wrong_recent || to_jsonb(left(a.given, 20))) with ordinality as w(v, n)
          order by n desc limit 3) last_wrong);
      end if;
    elsif a.ms >= min_ms and a.ms <= quick_ms then
      if not day = any (f.quick_days) then
        f.quick_days := (select coalesce(array_agg(d order by n), '{}') from (
          select d, n from unnest(f.quick_days || day) with ordinality as q(d, n)
          order by n desc limit fluent_days) last_days);
      end if;
      f.box := least(f.box + 1, case when cardinality(f.quick_days) >= fluent_days then top_box else top_box - 1 end);
    end if;
    insert into public.gem_keep_facts as g (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen, quick_days, wrong_recent)
    values (player, pack, a.key, f.attempts, f.correct, f.avg_ms, f.box, f.last_seen, f.quick_days, f.wrong_recent)
    on conflict on constraint gem_keep_facts_pkey do update set
      attempts = excluded.attempts, correct = excluded.correct, avg_ms = excluded.avg_ms, box = excluded.box,
      last_seen = excluded.last_seen, quick_days = excluded.quick_days, wrong_recent = excluded.wrong_recent, updated_at = now();
    added := added + 1;
  end loop;
  return added;
end;
$$;


create or replace function public.teacher_class_skill_map(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform public.require_teacher();
  if not public.teaches_class(target, public.is_school_admin()) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'class', jsonb_build_object(
      'id', c.id, 'name', c.name, 'yearLevel', c.year_level,
      'auto', coalesce((select s.maths_auto from public.app_settings s where s.class_id = c.id), false)),
    'students', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.display_name, 'realName', split_part(u.email, '@', 1),
        'ladder', public.ladder_info(p.id),
        'settings', public.gem_keep_settings(p.id),
        'facts', (select coalesce(jsonb_agg(jsonb_build_object(
            'key', f.fact_key, 'attempts', f.attempts, 'correct', f.correct, 'avgMs', f.avg_ms, 'box', f.box,
            'lastSeen', coalesce((extract(epoch from f.last_seen) * 1000)::bigint, 0),
            'quickDays', to_jsonb(f.quick_days::text[]),
            'wrong', f.wrong_recent,
            'firstSeen', (extract(epoch from f.first_seen) * 1000)::bigint)), '[]')
          from public.gem_keep_facts f
          where f.player = p.id and f.pack in ('times-tables', 'early-facts', 'add-sub', 'division', 'generated')))
        order by p.display_name), '[]')
      from public.class_members m
      join public.profiles p on p.id = m.student_id
      left join auth.users u on u.id = p.id
      where m.class_id = c.id))
  into result
  from public.classes c where c.id = target;
  return result;
end;
$$;

revoke execute on function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer, integer)
from public, anon, authenticated;
grant execute on function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer, integer) to service_role;

revoke execute on function public.teacher_class_skill_map(uuid) from public, anon, authenticated;
grant execute on function public.teacher_class_skill_map(uuid) to authenticated;
