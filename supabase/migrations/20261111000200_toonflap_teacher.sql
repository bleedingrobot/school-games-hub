-- Toon Flap stage F.5 (docs/TOON-FLAP-PLAN.md): the teacher's lines, and the game switched on for every class (James, 11 Nov 2026:
-- "switch it on for all players"). Teachers can still turn it off for their own class on the Teacher page.

-- The Games table's line for a class: how many have played, levels finished between them, and golds.
create function public.teacher_toonflap_class(target_class uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'players', count(*),
      'levels', coalesce(sum((select count(*) from jsonb_each(t.progress -> 'levels') l(id, rec) where (l.rec ->> 'finishes')::int > 0)), 0),
      'golds', coalesce(sum((select count(*) from jsonb_each(t.progress -> 'levels') l(id, rec) where l.rec ->> 'medal' = 'gold')), 0))
    from public.toonflap_progress t
    join public.my_students() s(id) on s.id = t.player
    where exists (select 1 from public.class_members m where m.student_id = t.player and m.class_id = target_class));
end;
$$;

-- One student's flights: their progress (levels, medals, best times, checks right), the flyer they fly and when they last
-- played; or null if they haven't.
create function public.teacher_toonflap_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('progress', t.progress, 'flyer', t.picks ->> 'flyer', 'lastPlayed', t.updated_at,
                                    'runs', (select count(*) from public.toonflap_runs r where r.player = student and r.finished_at is not null))
          from public.toonflap_progress t where t.player = student);
end;
$$;

revoke execute on function public.teacher_toonflap_class(uuid), public.teacher_toonflap_student(uuid) from public, anon, authenticated;
grant execute on function public.teacher_toonflap_class(uuid), public.teacher_toonflap_student(uuid) to authenticated;

-- On for every class (only the column teacher_set_toonflap() would set).
update public.app_settings set toonflap_enabled = true where not toonflap_enabled;
alter table public.app_settings alter column toonflap_enabled set default true;
