-- Clan Quest: a per-account mine-fights-a-day override, so James can test without waiting for tomorrow.
-- Pupils keep the teacher's setting (1-30). Only accounts listed in clans_fight_overrides get more.

create table public.clans_fight_overrides (
  player uuid primary key references public.profiles (id) on delete cascade,
  fights_per_day integer not null check (fights_per_day between 1 and 2000)
);
alter table public.clans_fight_overrides enable row level security;
revoke all on public.clans_fight_overrides from public, anon, authenticated;

-- Room for an override's daily fights (was 0-100).
alter table public.clans drop constraint clans_fights_left_check;
alter table public.clans add constraint clans_fights_left_check check (fights_left between 0 and 2000);

create or replace function public.clan_fights_per_day(player uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select o.fights_per_day from public.clans_fight_overrides o where o.player = coalesce(clan_fights_per_day.player, auth.uid())),
    (select s.clans_fights_per_day from public.settings_of(coalesce(clan_fights_per_day.player, auth.uid())) s),
    8)
$$;

create or replace function public.clans_settings(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'enabledTopics', to_jsonb(s.clans_topics), 'yearBand', s.clans_year_band,
    'enabledTables', to_jsonb(s.clans_tables),
    'fightsPerDay', coalesce(
      (select o.fights_per_day from public.clans_fight_overrides o where o.player = coalesce(clans_settings.player, auth.uid())),
      s.clans_fights_per_day),
    'season', s.clans_season,
    'typedNames', s.clan_typed_names)
  from public.settings_of(coalesce(player, auth.uid())) s
$$;

-- James's teacher account (jamesriley@douglaspark.school.nz): 2000 fights a day, starting now.
insert into public.clans_fight_overrides (player, fights_per_day)
select id, 2000 from public.profiles where id = 'e5dfc120-92de-4a09-a3fa-acc400dd4990'
on conflict (player) do update set fights_per_day = excluded.fights_per_day;

update public.clans set fights_left = 2000 where player = 'e5dfc120-92de-4a09-a3fa-acc400dd4990';
