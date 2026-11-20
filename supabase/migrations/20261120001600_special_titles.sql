-- Special titles: Hero Titles given by hand for something remarkable (first: Ultimate Dragon Slayer, for Bubbly Bear 1).
-- They are never on the quest-reward list (use_quest_reward still only takes hero_title_ids()), so the only way to own
-- one is a row added in owned_titles by James. Once owned, set_my_title and my_titles treat it like any other title.

-- Mirrors SPECIAL_TITLES in shared/quests/titles.ts (shared/quests/titles.test.ts checks they match).
create function public.special_title_ids()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'ultimate-dragon-slayer'
  ]::text[]
$$;

revoke execute on function public.special_title_ids() from public, anon, authenticated;

alter table public.owned_titles drop constraint owned_titles_title_check;
alter table public.owned_titles add constraint owned_titles_title_check
  check (title = any (public.hero_title_ids()) or title = any (public.special_title_ids()));
