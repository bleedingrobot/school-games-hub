-- Question skips, stage S.3 (James, 22 Oct 2026): a per-class teacher switch for the question box's skip button.
-- See docs/QUESTION-SKIPS-PLAN.md.
--
-- app_settings.question_skips: 'on' (as before, the default), 'limited' (3 skips per game) or 'off' (no skip button).
-- The website reads it from the settings row and the question box follows it. Teachers are never limited. No game's server
-- function reads it: skipping was never scored, so there is nothing for a server to check.
--
-- Nothing else is changed. Columns only are added to app_settings.

alter table public.app_settings add column question_skips text not null default 'on'
  check (question_skips in ('on', 'limited', 'off'));

create function public.teacher_set_question_skips(mode text, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if mode is null or mode not in ('on', 'limited', 'off') then
    raise exception 'Unknown Skip button setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings set question_skips = mode where id in (select public.settings_to_change(target_class));
end;
$$;

revoke execute on function public.teacher_set_question_skips(text, uuid) from public, anon, authenticated;
grant execute on function public.teacher_set_question_skips(text, uuid) to authenticated;
