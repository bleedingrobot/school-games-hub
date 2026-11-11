-- Game sets (teacher controls card C8): a teacher saves "today's games" (every game's on/off) as a named set for a class, and
-- switches the class to a saved set in one tap.
--
-- class_game_sets has row level security on and NO grants to anon or signed-in users, so nobody reads or writes it directly.
-- Teachers go through four functions, each of which checks the class with require_settings_target (a teacher must teach it):
--   teacher_game_sets(target_class)                 the class's saved sets, newest first
--   teacher_save_game_set(target_class, set_name, games)   saves one (at most 20 a class; names 1 to 40 letters)
--   teacher_use_game_set(set_id)                    calls teacher_set_games with the set, so it changes only game switches,
--                                                   by the same column check, in one UPDATE
--   teacher_delete_game_set(set_id)                 deletes one set of a class the teacher teaches (their own action)
-- `games` is { "<switch column>": true|false }. Save checks its shape only; teacher_set_games refuses any column that is not
-- a game switch when the set is used. Nothing existing is dropped or changed.

create table public.class_game_sets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  games jsonb not null check (jsonb_typeof(games) = 'object'),
  made_by uuid default auth.uid(),
  made_at timestamptz not null default now()
);
create index class_game_sets_class_idx on public.class_game_sets (class_id);
alter table public.class_game_sets enable row level security;
revoke all on public.class_game_sets from anon, authenticated;

create function public.teacher_game_sets(target_class uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'games', s.games) order by s.made_at desc, s.id)
    from public.class_game_sets s
    where s.class_id = target_class
  ), '[]'::jsonb);
end;
$$;
revoke execute on function public.teacher_game_sets(uuid) from public, anon, authenticated;
grant execute on function public.teacher_game_sets(uuid) to authenticated;

create function public.teacher_save_game_set(target_class uuid, set_name text, games jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_name text := btrim(coalesce(set_name, ''));
  k text;
  v jsonb;
  new_id uuid;
begin
  perform public.require_teacher();
  perform public.require_settings_target(target_class);
  if char_length(new_name) not between 1 and 40 then
    raise exception 'Give the set a name of 1 to 40 letters.' using errcode = '22023';
  end if;
  if jsonb_typeof(games) is distinct from 'object' or (select count(*) from jsonb_object_keys(games)) > 80 then
    raise exception 'Those games couldn''t be read.' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(games) loop
    if k !~ '^[a-z0-9_]{1,60}$' or jsonb_typeof(v) is distinct from 'boolean' then
      raise exception 'Those games couldn''t be read.' using errcode = '22023';
    end if;
  end loop;
  if (select count(*) from public.class_game_sets where class_id = target_class) >= 20 then
    raise exception 'This class has 20 sets already. Delete one first.' using errcode = '54000';
  end if;
  insert into public.class_game_sets (class_id, name, games, made_by)
  values (target_class, new_name, games, auth.uid())
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.teacher_save_game_set(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.teacher_save_game_set(uuid, text, jsonb) to authenticated;

create function public.teacher_use_game_set(set_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.class_game_sets;
begin
  perform public.require_teacher();
  select * into s from public.class_game_sets where id = set_id;
  if not found then
    raise exception 'That set isn''t there any more.' using errcode = 'P0002';
  end if;
  -- Checks the teacher teaches the class, refuses any column that is not a game switch, and updates in one statement.
  perform public.teacher_set_games(s.games, s.class_id);
end;
$$;
revoke execute on function public.teacher_use_game_set(uuid) from public, anon, authenticated;
grant execute on function public.teacher_use_game_set(uuid) to authenticated;

create function public.teacher_delete_game_set(set_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_class uuid;
begin
  perform public.require_teacher();
  select class_id into owner_class from public.class_game_sets where id = set_id;
  if not found then
    raise exception 'That set isn''t there any more.' using errcode = 'P0002';
  end if;
  perform public.require_settings_target(owner_class);
  delete from public.class_game_sets where id = set_id;
end;
$$;
revoke execute on function public.teacher_delete_game_set(uuid) from public, anon, authenticated;
grant execute on function public.teacher_delete_game_set(uuid) to authenticated;
