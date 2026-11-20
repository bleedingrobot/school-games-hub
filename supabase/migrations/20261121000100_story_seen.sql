-- Stories in the older-pupil games (docs/plans/stories/PLAN.md, ST.1): which story pages each pupil has seen,
-- so an opening or a hero's story shows by itself once, on any Chromebook. Nothing existing changes.
-- Nothing here counts towards points or rewards, so a pupil may mark their own row as seen.

create table public.story_seen (
  player uuid not null references public.profiles (id) on delete cascade,
  story text not null check (story ~ '^[a-z][a-z0-9-]{1,48}$'),
  seen_at timestamptz not null default now(),
  primary key (player, story)
);

alter table public.story_seen enable row level security;
revoke all on public.story_seen from anon, authenticated;

-- The stories this pupil has seen ('{}' when none, or when not a school user).
create function public.my_stories_seen()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(s.story order by s.story), '{}')
  from public.story_seen s
  where s.player = auth.uid() and public.is_school_user()
$$;

-- Marks one story seen for this pupil. A bad id or a full list (500) is ignored; nothing is raised.
create function public.mark_story_seen(story text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.story_seen (player, story)
  select auth.uid(), mark_story_seen.story
  where auth.uid() is not null
    and public.is_school_user()
    and mark_story_seen.story ~ '^[a-z][a-z0-9-]{1,48}$'
    and (select count(*) from public.story_seen s where s.player = auth.uid()) < 500
  on conflict do nothing
$$;

revoke execute on function public.my_stories_seen(), public.mark_story_seen(text) from public, anon, authenticated;
grant execute on function public.my_stories_seen(), public.mark_story_seen(text) to authenticated;
