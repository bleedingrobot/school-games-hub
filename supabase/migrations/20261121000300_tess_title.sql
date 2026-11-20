-- A second hand-given special title: 🏅 Tess the Best! Nepotism Award! for Lucky Lynx 65.

-- Mirrors SPECIAL_TITLES in shared/quests/titles.ts (shared/quests/titles.test.ts checks they match).
create or replace function public.special_title_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'ultimate-dragon-slayer',
    'tess-the-best'
  ]::text[]
$$;

revoke execute on function public.special_title_ids() from public, anon, authenticated;

-- Give it to Lucky Lynx 65 and put it on straight away (she can change it in My titles).
-- Skipped on any copy of the database without her account.
insert into public.owned_titles (player, title)
select p.id, 'tess-the-best' from public.profiles p where p.id = 'a5aea855-1217-405b-b709-b391510ad0d0'
on conflict do nothing;

update public.profiles p set avatar = coalesce(p.avatar, '{}'::jsonb) || jsonb_build_object('title', 'tess-the-best')
where p.id = 'a5aea855-1217-405b-b709-b391510ad0d0';
