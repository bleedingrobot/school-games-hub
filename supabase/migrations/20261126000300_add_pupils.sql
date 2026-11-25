-- Teachers add new pupils by school email, with a sign-in badge from day one (badge plan card B6, James 25 Nov 2026;
-- docs/plans/badge-review/ADD-PUPILS.md).
--
-- A teacher pastes school emails on the "Add pupils" page. The "pupils" server function asks
-- pupils_may_create (server key only) which of them may get a new account, makes those accounts with the
-- sign-in service (email marked as checked, no password, no email sent), and the page then calls
-- teacher_add_pupils_by_email as the teacher: every pupil is put in the class (unless they're already in
-- another class) and gets a badge. When the pupil later signs in with Google, the sign-in service links the
-- Google sign-in to the same account because the school email matches, so nothing is lost either way.
--
--   pupils_may_create(teacher, emails)       server key only: the emails with no account yet, on the teacher's school domain.
--   teacher_add_pupils_by_email(class, emails)  what happened to each email, with the badge of each pupil in the class.
--   teacher_find_pupils(words)               search the pupils I may see (my classes; a school admin: the whole school), with badges.

-- Server key only. Of these emails, the ones that may get a new pupil account made by this teacher: a real school email
-- on the teacher's own school's domain, with no account yet. Empty if the caller isn't a teacher at an active school.
create function public.pupils_may_create(teacher uuid, emails text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct e.email), '{}')
  from (select lower(trim(x)) as email from unnest(coalesce(emails, '{}')) as x) e
  join public.profiles t on t.id = teacher and t.role = 'teacher'
  join public.schools s on s.id = t.school_id and s.active
  where cardinality(emails) <= 100
    and e.email ~ '^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9.-]+$'
    and public.school_for_email(e.email) = t.school_id
    and not exists (select 1 from auth.users u where lower(u.email) = e.email)
$$;

-- Teacher: put these pupils (by school email) in one of my classes and make their badges. One row per email, in the order
-- given (repeats left out), saying what happened:
--   added       now in this class (they had no class, or only the school's starting class)
--   here        already in this class
--   other-class in another class (named): left there; their teacher can move them
--   teacher     a teacher's account: left alone
--   no-account  no account yet (the server couldn't make one): try again
--   not-school  not an email on this school's domain
-- Pupils in this class come back with their badge, to print.
create function public.teacher_add_pupils_by_email(target_class uuid, emails text[])
returns table (email text, outcome text, player uuid, display_name text, real_name text, code text, class_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  one text;
  who uuid;
  who_role text;
  was uuid;
  results jsonb := '[]'::jsonb;
  what text;
  seen text[] := '{}';
begin
  perform public.require_teacher();
  if target_class is null or not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  if cardinality(emails) > 100 then
    raise exception 'Add up to 100 pupils at a time.' using errcode = '22023';
  end if;

  foreach one in array coalesce(emails, '{}') loop
    one := lower(trim(one));
    continue when one = '' or one = any(seen);
    seen := seen || one;
    who := null;
    who_role := null;
    was := null;
    what := null;
    if public.school_for_email(one) is distinct from public.my_school() then
      what := 'not-school';
    else
      select p.id, p.role into who, who_role
      from auth.users u join public.profiles p on p.id = u.id
      where lower(u.email) = one and p.school_id = public.my_school();
      if who is null then
        what := 'no-account';
      elsif who_role <> 'student' then
        what := 'teacher';
        who := null;
      else
        was := public.current_class_of(who);
        if was = target_class then
          what := 'here';
        elsif was is not null and was is distinct from (select s.default_class from public.schools s where s.id = public.my_school()) then
          what := 'other-class';
        else
          perform public.put_in_class(who, target_class, 'teacher');
          what := 'added';
        end if;
        if what in ('here', 'added') then
          insert into public.pupil_badges (player, code, made_by)
          values (who, public.new_badge_code(), auth.uid())
          on conflict on constraint pupil_badges_pkey do nothing;
        end if;
      end if;
    end if;
    results := results || jsonb_build_object('email', one, 'outcome', what, 'player', who, 'class', was);
  end loop;

  return query
    select r ->> 'email',
           r ->> 'outcome',
           case when r ->> 'outcome' in ('added', 'here') then (r ->> 'player')::uuid end,
           case when r ->> 'outcome' in ('added', 'here') then p.display_name end,
           split_part(r ->> 'email', '@', 1),
           case when r ->> 'outcome' in ('added', 'here') then b.code end,
           case when r ->> 'outcome' = 'other-class' then c.name end
    from jsonb_array_elements(results) with ordinality as x (r, n)
    left join public.profiles p on p.id = (r ->> 'player')::uuid
    left join public.pupil_badges b on b.player = p.id
    left join public.classes c on c.id = (r ->> 'class')::uuid
    order by x.n;
end;
$$;

-- Teacher: find pupils I may see by name, email name or player name (at least 2 letters), with their badge (made the first
-- time) and class. Up to 30. A school admin searches the whole school; other teachers their own classes.
create function public.teacher_find_pupils(words text)
returns table (player uuid, display_name text, real_name text, code text, class_name text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  q text := lower(trim(coalesce(words, '')));
  pattern text;
  found uuid[];
begin
  perform public.require_teacher();
  if length(q) < 2 then
    return;
  end if;
  q := left(q, 60);
  -- "ava kingi" also finds ava.kingi@...: spaces match any separator.
  pattern := '%' || regexp_replace(replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_'), '\s+', '%', 'g') || '%';

  select array_agg(p.id) into found
  from (
    select p.id from public.profiles p
    join auth.users u on u.id = p.id
    where p.id in (select public.my_students())
      and p.role = 'student'
      and (lower(split_part(u.email, '@', 1)) like pattern or lower(p.display_name) like pattern)
    order by lower(split_part(u.email, '@', 1))
    limit 30
  ) p;
  if found is null then
    return;
  end if;

  insert into public.pupil_badges (player, code, made_by)
  select f, public.new_badge_code(), auth.uid() from unnest(found) f
  on conflict on constraint pupil_badges_pkey do nothing;

  return query
    select p.id, p.display_name, split_part(u.email, '@', 1)::text, b.code, c.name
    from public.profiles p
    join auth.users u on u.id = p.id
    join public.pupil_badges b on b.player = p.id
    left join public.class_members m on m.student_id = p.id
    left join public.classes c on c.id = m.class_id and not c.archived
    where p.id = any(found)
    order by lower(split_part(u.email, '@', 1));
end;
$$;

revoke all on function public.pupils_may_create(uuid, text[]) from public, anon, authenticated;
revoke all on function public.teacher_add_pupils_by_email(uuid, text[]) from public, anon;
revoke all on function public.teacher_find_pupils(text) from public, anon;
grant execute on function public.pupils_may_create(uuid, text[]) to service_role;
grant execute on function public.teacher_add_pupils_by_email(uuid, text[]) to authenticated;
grant execute on function public.teacher_find_pupils(text) to authenticated;
