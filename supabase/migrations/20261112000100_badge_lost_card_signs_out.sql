-- Badge review card B1 (docs/plans/badge-review/REVIEW.md), James 11 Nov 2026.
--
-- "Lost card" gave the pupil a new code, so the old card stopped working, but anyone already signed in
-- with the old card stayed signed in, with no time limit. Now it also ends every sign-in that pupil has
-- (their sessions; their refresh tokens go with them), so a lost or photographed card can't keep playing
-- as them. A device that was signed in is sent back to the sign-in page when its current sign-in key
-- runs out (within the hour) and can't be renewed. The pupil scans their new card to come back.

create or replace function public.teacher_renew_badge(pupil uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  fresh text := public.new_badge_code();
begin
  perform public.require_teacher_of(pupil);
  if not exists (select 1 from public.profiles p where p.id = pupil and p.role = 'student') then
    raise exception 'Badges are for students only.' using errcode = '22023';
  end if;
  insert into public.pupil_badges as b (player, code, made_by)
  values (pupil, fresh, auth.uid())
  on conflict on constraint pupil_badges_pkey
  do update set code = excluded.code, made_at = now(), made_by = excluded.made_by, used_at = null;
  -- Sign this pupil out everywhere (only this pupil: checked above that they are a student the teacher manages).
  delete from auth.sessions s where s.user_id = pupil;
  return fresh;
end;
$$;

revoke all on function public.teacher_renew_badge(uuid) from public, anon;
grant execute on function public.teacher_renew_badge(uuid) to authenticated;
