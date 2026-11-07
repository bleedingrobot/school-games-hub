-- Tūī's teacher line "hardest facts" (R9): "ten less" facts (14 − 10, 10 + ? = 14) now have their own records, key "tenless:n", next to
-- "tenand:n" (10 + n, n + 10). This lets the student's line look at both. The key check on gem_keep_facts
-- ('^[a-z][a-z0-9]{0,9}:[a-z0-9:+/=?-]{1,40}$') already accepts "tenless:4", so no table changes and no pupil's record is touched.
-- Same signature, so the grants stay.
create or replace function public.teacher_tui_student(student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher_of(student);
  return (select jsonb_build_object('daysDone', h.days_done, 'lastFlowerDay', to_char(h.last_flower_day, 'YYYY-MM-DD'),
                                    'step', h.step, 'level', h.level, 'lastPlayed', h.updated_at,
                                    'hardest', coalesce((
                                      select jsonb_agg(f.fact_key order by f.correct::numeric / f.attempts, f.fact_key)
                                      from (select g.fact_key, g.correct, g.attempts from public.gem_keep_facts g
                                            where g.player = student and g.pack = 'early-facts' and g.attempts >= 2 and g.box < 2
                                              and g.fact_key ~ '^ten(and|less):[1-9]$'
                                            order by g.correct::numeric / g.attempts, g.fact_key limit 3) f), '[]'::jsonb))
          from public.tui_progress h where h.player = student);
end;
$$;
