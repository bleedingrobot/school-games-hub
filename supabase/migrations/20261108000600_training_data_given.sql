-- Quick looks: the teacher's page needs the answer a child gave (not just right or wrong) to say the usual slip
-- (too many, too few, one away). training_data now returns `given` with each saved answer. Nothing is stored
-- or changed; the function is only read, and an extra field is ignored by anything that does not use it.
create or replace function public.training_data(who uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'answers', (select coalesce(jsonb_agg(jsonb_build_object(
        'key', a.fact_key, 'given', a.given, 'correct', a.correct, 'ms', a.answer_ms, 'typingMs', a.typing_ms,
        'day', to_char(a.day, 'YYYY-MM-DD'), 'at', (extract(epoch from a.answered_at) * 1000)::bigint)
        order by a.answered_at, a.id), '[]')
      from public.training_answers a where a.player = who),
    'student', (select jsonb_build_object('typing', s.typing, 'autoSubmit', s.auto_submit, 'sessionsDone', s.sessions_done)
      from public.training_students s where s.player = who)
  )
$$;
