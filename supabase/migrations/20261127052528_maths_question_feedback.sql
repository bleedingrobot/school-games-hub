-- "Feedback on this question" (James, 26 Nov 2026): a teacher playing a game can open a tab on the left of the question
-- pop-up and write what is wrong with that question or its Help me. Each note keeps a copy of what the pop-up showed then
-- (the question, its picture and the Help me card), so it can be read later even after the question or help has changed.
-- School admins read the notes on Admin > Question feedback and mark each one fixed or not needed: the tweak list.
create table public.maths_question_feedback (
  id bigint generated always as identity primary key,
  school_id integer not null references public.schools (id) on delete cascade,
  author uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  game text not null default '',
  fact_key text not null default '',
  question jsonb not null,
  picture jsonb,
  help jsonb,
  feedback text not null check (char_length(feedback) between 1 and 2000),
  tags text[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'fixed', 'skip')),
  note text not null default '' check (char_length(note) <= 1000),
  done_at timestamptz
);
create index maths_question_feedback_school on public.maths_question_feedback (school_id, status, created_at desc);
alter table public.maths_question_feedback enable row level security;
revoke all on public.maths_question_feedback from anon, authenticated;

-- A teacher saves a note on the question in front of them. Returns the new note's id.
create function public.maths_feedback_add(item jsonb)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  words text := btrim(coalesce(item ->> 'feedback', ''));
  new_id bigint;
begin
  perform public.require_teacher();
  if words = '' then
    raise exception 'Write a few words first.' using errcode = '22023';
  end if;
  if char_length(words) > 2000 then
    raise exception 'That note is too long.' using errcode = '22023';
  end if;
  if jsonb_typeof(item -> 'question') is distinct from 'object' or octet_length((item -> 'question')::text) > 20000
     or octet_length(coalesce(item -> 'picture', 'null')::text) > 20000
     or octet_length(coalesce(item -> 'help', 'null')::text) > 20000 then
    raise exception 'That question can''t be saved.' using errcode = '22023';
  end if;
  insert into public.maths_question_feedback (school_id, author, game, fact_key, question, picture, help, feedback, tags)
  values (
    public.my_school(), auth.uid(),
    left(coalesce(item ->> 'game', ''), 80),
    left(coalesce(item ->> 'key', ''), 120),
    item -> 'question',
    nullif(item -> 'picture', 'null'::jsonb),
    nullif(item -> 'help', 'null'::jsonb),
    words,
    coalesce((select array_agg(t) from jsonb_array_elements_text(
      case when jsonb_typeof(item -> 'tags') = 'array' then item -> 'tags' else '[]'::jsonb end) t
      where t in ('question', 'help', 'picture', 'other')), '{}'))
  returning id into new_id;
  return new_id;
end;
$$;

-- The tweak list: the school's notes, newest first. `which` is 'open' (still to look at), 'done' (fixed or not needed) or
-- 'all'.
create function public.maths_feedback_list(which text default 'open')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  if which not in ('open', 'done', 'all') then
    raise exception 'Choose open, done or all.' using errcode = '22023';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id, 'at', f.created_at, 'game', f.game, 'key', f.fact_key,
        'question', f.question, 'picture', f.picture, 'help', f.help,
        'feedback', f.feedback, 'tags', to_jsonb(f.tags), 'status', f.status, 'note', f.note, 'doneAt', f.done_at,
        'author', coalesce(p.display_name, ''), 'authorEmail', coalesce(u.email, ''))
        order by f.created_at desc), '[]')
    from (
      select * from public.maths_question_feedback q
      where q.school_id = public.my_school()
        and (which = 'all' or (which = 'open') = (q.status = 'open'))
      order by q.created_at desc
      limit 300) f
    left join public.profiles p on p.id = f.author
    left join auth.users u on u.id = f.author
  );
end;
$$;

-- Tick a note off (fixed / skip), or put it back on the list (open), with an optional line on what was done.
create function public.maths_feedback_set_status(feedback_id bigint, new_status text, done_note text default '')
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.require_school_admin();
  if new_status not in ('open', 'fixed', 'skip') then
    raise exception 'Choose open, fixed or skip.' using errcode = '22023';
  end if;
  update public.maths_question_feedback
  set status = new_status,
      note = left(coalesce(done_note, ''), 1000),
      done_at = case when new_status = 'open' then null else now() end
  where id = feedback_id and school_id = public.my_school();
  if not found then
    raise exception 'That note isn''t there any more.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.maths_feedback_add(jsonb) from public, anon;
revoke all on function public.maths_feedback_list(text) from public, anon;
revoke all on function public.maths_feedback_set_status(bigint, text, text) from public, anon;
grant execute on function public.maths_feedback_add(jsonb) to authenticated;
grant execute on function public.maths_feedback_list(text) to authenticated;
grant execute on function public.maths_feedback_set_status(bigint, text, text) to authenticated;
