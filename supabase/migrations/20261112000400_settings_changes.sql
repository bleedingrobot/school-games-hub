-- Teacher controls C6: who changed a setting, and when.
--
-- Every change to a class's settings row is written to settings_changes, one row per column that changed, by a trigger on
-- app_settings. So it covers every teacher_set_* function, now and later, without touching any of them. Teachers read it
-- through teacher_settings_changes() (with their name); the table itself is also readable only for classes they teach.
-- Pupils can reach neither. Nothing here deletes or rewrites rows, and New Season / end of year leave them alone.

create table public.settings_changes (
  id bigint generated always as identity primary key,
  class_id uuid not null references public.classes (id) on delete cascade,
  changed_by uuid,                                   -- auth.uid() of the saver; null for a change made by the server itself
  changed_at timestamptz not null default now(),
  setting text not null,                             -- the app_settings column
  old_value jsonb,
  new_value jsonb
);
create index settings_changes_by_class on public.settings_changes (class_id, changed_at desc, id desc);

alter table public.settings_changes enable row level security;
revoke all on public.settings_changes from anon, authenticated;
grant select on public.settings_changes to authenticated;
-- The rule below calls teaches_class() as the signed-in teacher, so they need to be able to call it (it only answers about
-- their own classes).
grant execute on function public.teaches_class(uuid, boolean) to authenticated;
create policy "Teachers read the changes for their classes" on public.settings_changes
  for select to authenticated
  using (public.teaches_class(class_id));
-- No insert, update or delete policy: only the trigger below writes, and nothing removes.

-- One statement per saved row: one log row for each column whose value changed (id, class_id and school_id are skipped).
create function public.log_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.settings_changes (class_id, changed_by, setting, old_value, new_value)
  select new.class_id, auth.uid(), n.key, o.value, n.value
  from jsonb_each(to_jsonb(new)) n
  join jsonb_each(to_jsonb(old)) o on o.key = n.key
  where n.value is distinct from o.value and n.key not in ('id', 'class_id', 'school_id');
  return null;
end;
$$;

create trigger app_settings_log_change
  after update on public.app_settings
  for each row when (new.class_id is not null)
  execute function public.log_settings_change();

-- What a teacher sees for a class: newest first, with who changed it. `latest_per_setting` gives only the newest change
-- for each setting (the "Changed by you, 9:12am" lines); otherwise the last `max_rows` changes (Recent changes).
create function public.teacher_settings_changes(target_class uuid, max_rows integer default 20, latest_per_setting boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  if not public.teaches_class(target_class) then
    raise exception 'That isn''t one of your classes.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', r.id, 'changedAt', r.changed_at, 'changedBy', r.changed_by,
        'name', p.display_name, 'realName', split_part(u.email, '@', 1),
        'setting', r.setting, 'oldValue', r.old_value, 'newValue', r.new_value) order by r.changed_at desc, r.id desc)
    from (
      select * from (
        select c.*, case when latest_per_setting
                         then row_number() over (partition by c.setting order by c.changed_at desc, c.id desc) else 1 end as nth
        from public.settings_changes c where c.class_id = target_class
      ) x
      where x.nth = 1
      order by x.changed_at desc, x.id desc
      limit least(greatest(coalesce(max_rows, 20), 1), 500)
    ) r
    left join public.profiles p on p.id = r.changed_by
    left join auth.users u on u.id = r.changed_by
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.log_settings_change(), public.teacher_settings_changes(uuid, integer, boolean)
from public, anon, authenticated;
grant execute on function public.teacher_settings_changes(uuid, integer, boolean) to authenticated;
