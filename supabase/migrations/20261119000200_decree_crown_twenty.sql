-- The Royal Crown picture needs 20 perfect reigns in a hub season, not one (James, 19 Nov 2026: one perfect reign took
-- 2-4 minutes, far easier than every other picture). A perfect reign is a full reign with all 8 riddles right
-- (decree_riddles_right). They are counted in season_counts like Training's sessions (20261112002300 section 6), and the
-- 20th of the season gives the Crown. Crowns already won are kept.
--
--   1. The new words
--   2. The watcher counts perfect reigns
--   3. This season's perfect reigns so far are counted

-- 1. The new words
update public.trophy_types set how = 'Rule 20 full reigns with all 8 riddles right, in one season.' where id = 'decree-crown';

-- 2. The watcher: the Seal for any full reign, as before; a perfect one adds to the season's count, and the 20th gives
-- the Crown.
create or replace function public.decree_reign_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'full' and (tg_op = 'INSERT' or old.status is distinct from 'full') then
    perform public.award_trophy(new.player, 'decree-seal', jsonb_build_object('reign', new.id));
    if public.decree_riddles_right(new.answered) >= 8
       and public.season_count_add(new.player, 'decree', 'perfect-reigns') = 20 then
      perform public.award_trophy(new.player, 'decree-crown', jsonb_build_object('perfect_reigns', 20));
    end if;
  end if;
  return null;
exception when others then
  raise warning 'a Royal Decree trophy failed (%)', sqlstate;
  return null;
end;
$$;

-- 3. Perfect reigns already finished in each school's current hub season count towards this season's 20.
insert into public.season_counts (player, game, season, year, key, n)
select d.player, 'decree', public.hub_season(p.school_id),
       extract(year from coalesce(public.hub_season_began(p.school_id, public.hub_season(p.school_id)),
                                  public.nz_day(now())))::integer,
       'perfect-reigns', count(*)
from public.decree_reigns d
join public.profiles p on p.id = d.player
where d.status = 'full' and public.decree_riddles_right(d.answered) >= 8
  and public.hub_season(p.school_id) > 0
  and public.nz_day(coalesce(d.finished_at, d.updated_at)) >= public.hub_season_began(p.school_id, public.hub_season(p.school_id))
group by d.player, p.school_id
on conflict (player, game, season, year, key) do update set n = excluded.n;
