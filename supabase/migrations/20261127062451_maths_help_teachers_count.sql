-- Help me for teachers (James, 27 Nov 2026 NZ): "can you please still tick off skills for teacher accounts even if they use
-- help, im clicking the help button every time to check it". A teacher opening Help me no longer marks their next answer as
-- helped, so it counts on their ladder as usual. Pupils keep the rule: nothing ticks off once help is opened.
-- Same function and arguments as 20261126200655_maths_help_me.sql, with the teacher check added.
create or replace function public.maths_help_opened(kind text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = me and p.role = 'teacher') then
    return;
  end if;
  insert into public.maths_help_pending as h (player, opened_at, kind)
  values (me, now(), left(coalesce(maths_help_opened.kind, ''), 30))
  on conflict (player) do update set opened_at = excluded.opened_at, kind = excluded.kind;
end;
$$;
