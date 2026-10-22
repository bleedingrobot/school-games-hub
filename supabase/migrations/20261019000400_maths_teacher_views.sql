-- Maths focus F.7: the teacher skill map, the focus history, and a button to clear a student's placement.
--
-- (docs/MATHS-FOCUS-PLAN.md section 9.) Everything here is for teachers and changes no table or row:
--   * teacher_class_skill_map: one call that hands a teacher the maths records of the students in ONE class they teach, with each
--     student's class settings and ladder facts, so the page can colour a skill map with the same shared maths the games use;
--   * teacher_student_ladder: one student's placement and furthest place, for the student card;
--   * teacher_reset_placement: clears one student's placement so the warm-up is offered again. It never touches the furthest place;
--   * teacher_maths_focus_history: the focuses that have ended (never deleted), with who set each one.
-- Each function checks that the asker teaches the class (or, for a student, that the student is in one of their classes).

-- ---------------------------------------------------------------------------
-- The skill map: records for one class
-- ---------------------------------------------------------------------------

create function public.teacher_class_skill_map(target uuid)
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
            'quickDays', to_jsonb(f.quick_days::text[]))), '[]')
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

-- ---------------------------------------------------------------------------
-- The student card: where the warm-up and the furthest place stand
-- ---------------------------------------------------------------------------

create function public.teacher_student_ladder(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return public.ladder_info(student);
end;
$$;

-- Clears the warm-up result (or the skip) so the student is offered the warm-up again. The furthest place is a different table
-- and is left alone, so a place never moves back. Returns true when there was something to clear.
create function public.teacher_reset_placement(student uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  cleared integer;
begin
  perform public.require_teacher_of(student);
  delete from public.ladder_placements where student_id = student;
  get diagnostics cleared = row_count;
  return cleared > 0;
end;
$$;

-- ---------------------------------------------------------------------------
-- Focus history: every focus that has ended, newest first
-- ---------------------------------------------------------------------------

-- One entry for each "Set focus" press, like teacher_maths_focuses, for the focuses that are over. `since` keeps only those that
-- ended on or after it (a term); leave it empty for all of them. Nothing is ever deleted, so "all" really is all.
create function public.teacher_maths_focus_history(target_class uuid, since timestamptz default null)
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
  if target_class is null or not public.teaches_class(target_class, public.is_school_admin()) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  with mine as (
    select f.*, least(f.ends_at, coalesce(f.ended_at, f.ends_at)) as over_at
    from public.maths_focuses f
    where f.class_id = target_class and f.school_id = public.my_school()
  ),
  batches as (
    select m.batch_id,
           min(m.scope) as scope,
           min(m.skills::text)::text[] as skills,
           bool_or(m.only_these) as only_these,
           min(m.starts_at) as starts_at,
           max(m.over_at) as ended_at,
           min(m.created_at) as created_at,
           (array_agg(m.created_by order by m.created_at))[1] as created_by
    from mine m
    group by m.batch_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'batch', b.batch_id, 'scope', b.scope,
      'targets', (select coalesce(jsonb_agg(jsonb_build_object('id', coalesce(m.group_id, m.student_id),
                    'name', coalesce(g.name, p.display_name)) order by coalesce(g.name, p.display_name)), '[]')
                  from mine m
                  left join public.class_groups g on g.id = m.group_id
                  left join public.profiles p on p.id = m.student_id
                  where m.batch_id = b.batch_id and m.scope <> 'class'),
      'skills', to_jsonb(b.skills), 'onlyThese', b.only_these,
      'startsAt', b.starts_at, 'endsAt', b.ended_at, 'createdAt', b.created_at,
      'setBy', (select coalesce(sp.display_name, '') from public.profiles sp where sp.id = b.created_by),
      'setByReal', (select split_part(su.email, '@', 1) from auth.users su where su.id = b.created_by),
      'status', 'ended') order by b.created_at desc), '[]')
  into result
  from batches b
  where b.ended_at <= now() and (since is null or b.ended_at >= since);
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------

revoke execute on function
  public.teacher_class_skill_map(uuid),
  public.teacher_student_ladder(uuid),
  public.teacher_reset_placement(uuid),
  public.teacher_maths_focus_history(uuid, timestamptz)
from public, anon, authenticated;

-- Each one checks that the asker is a teacher of the class or student.
grant execute on function
  public.teacher_class_skill_map(uuid),
  public.teacher_student_ladder(uuid),
  public.teacher_reset_placement(uuid),
  public.teacher_maths_focus_history(uuid, timestamptz)
to authenticated;
