-- Dragon Maths trophies (docs/plans/profile/PLAN.md card P4; docs/PROFILE-REVIEW.md sections 4 and 5; James, 12 Nov 2026).
--
--   dm-first-five   Dragon Head picture: one of the first five pupils in the school to slay the dragon this season
--   dm-slayer       Slayer's Sword trophy: slay the dragon this season (anyone can win it, beside the race)
--
-- Both follow the dragon's own season number (lord_hall.season), not the hub's clock: that is the race they reward.
-- Bronze for the first season won, silver for the second, gold after that (award_trophy, 20261112000800).
--
--   1. The two trophy types.
--   2. lord_give_trophies(player, season): gives them for one Hall of Heroes row. Server only.
--   3. A trigger on lord_hall calls it. lord_commit writes the Hall row on every dragon win, so the trophies are given in
--      the same request, without copying lord_commit (last written in 20261018002500). A failed award never loses the save.
--   4. lord_first_five(): how many first-five places are left in my school this season, for the season road.
--   5. Back-award: everyone already in lord_hall gets their trophies now, dated when they first slew the dragon.

-- ---------------------------------------------------------------------------
-- 1. The trophy types
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('dm-first-five', 'dragon-maths', 'Dragon Head', 'Be one of the first five in your school to slay the dragon this season.',
   'picture', 'season', null, 10),
  ('dm-slayer', 'dragon-maths', 'Slayer''s Sword', 'Slay the dragon this season.', 'trophy', 'season', null, 20);

-- ---------------------------------------------------------------------------
-- 2. Giving them
-- ---------------------------------------------------------------------------

-- Gives the Dragon Maths trophies for one player's Hall of Heroes row in one dragon season. Safe to call again.
-- The race is per school and per season, between pupils only (not teachers, not hidden test pupils): a pupil is in the
-- first five when fewer than five schoolmates first slew the dragon strictly before them, so ties on the same instant
-- all count. A teacher or hidden pupil still gets the Slayer's Sword.
-- Returns { slayer, firstFive } from award_trophy, firstFive null when they are not in the first five.
create function public.lord_give_trophies(player uuid, season integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me record;
  mine timestamptz;
  before_me integer;
  slayer jsonb;
  head jsonb;
begin
  select p.school_id, p.role, p.hidden into me from public.profiles p where p.id = lord_give_trophies.player;
  select hl.first_at into mine from public.lord_hall hl
  where hl.player = lord_give_trophies.player and hl.season = lord_give_trophies.season;
  if me is null or mine is null then
    return jsonb_build_object('slayer', null, 'firstFive', null);
  end if;

  slayer := public.award_trophy(lord_give_trophies.player, 'dm-slayer',
    jsonb_build_object('dragonSeason', lord_give_trophies.season), lord_give_trophies.season);

  if me.role = 'student' and not me.hidden and me.school_id is not null then
    -- One school's race at a time, so two pupils finishing together both see each other's row.
    perform pg_advisory_xact_lock(hashtext('lord-first-five'), me.school_id * 1000 + lord_give_trophies.season);
    select count(*)::integer into before_me
    from public.lord_hall hl
    join public.profiles p on p.id = hl.player
    where hl.season = lord_give_trophies.season and hl.first_at < mine
      and p.school_id = me.school_id and p.role = 'student' and not p.hidden;
    if before_me < 5 then
      head := public.award_trophy(lord_give_trophies.player, 'dm-first-five',
        jsonb_build_object('dragonSeason', lord_give_trophies.season, 'place', before_me + 1), lord_give_trophies.season);
    end if;
  end if;
  return jsonb_build_object('slayer', slayer, 'firstFive', head);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. On every dragon win
-- ---------------------------------------------------------------------------

-- lord_commit adds or updates the player's Hall row when the dragon is beaten. Never lose a save because of a trophy.
create function public.lord_hall_trophies()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.lord_give_trophies(new.player, new.season);
  exception when others then
    raise warning 'giving Dragon Maths trophies failed (%)', sqlstate;
  end;
  return null;
end;
$$;

create trigger lord_hall_trophies
after insert or update of kills on public.lord_hall
for each row execute function public.lord_hall_trophies();

-- ---------------------------------------------------------------------------
-- 4. What the season road shows
-- ---------------------------------------------------------------------------

-- { season, left }: the dragon season number in my school today and how many of its five first-five places are still
-- open (0 to 5). Null season and 5 left before season 1 starts. No names: the Hall of Heroes already shows who.
create function public.lord_first_five()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n integer;
  taken integer;
begin
  perform public.require_school_user();
  n := public.lord_current_season(auth.uid());
  if n is null then
    return jsonb_build_object('season', null, 'left', 5);
  end if;
  select count(*)::integer into taken
  from public.lord_hall hl
  join public.profiles p on p.id = hl.player
  where hl.season = n and p.school_id = public.my_school() and p.role = 'student' and not p.hidden;
  return jsonb_build_object('season', n, 'left', greatest(0, 5 - taken));
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock new functions
-- ---------------------------------------------------------------------------

revoke execute on function
  public.lord_give_trophies(uuid, integer),
  public.lord_hall_trophies(),
  public.lord_first_five()
from public, anon, authenticated;
grant execute on function public.lord_first_five() to authenticated;
grant execute on function public.lord_give_trophies(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Back-award everyone already in the Hall of Heroes
-- ---------------------------------------------------------------------------

-- Oldest first, so each win is dated when the dragon was first slain that season.
do $$
declare
  h record;
begin
  for h in select hl.player, hl.season, hl.first_at from public.lord_hall hl order by hl.season, hl.first_at, hl.player loop
    perform public.lord_give_trophies(h.player, h.season);
    update public.trophies w set earned_at = h.first_at
    where w.player = h.player and w.trophy in ('dm-slayer', 'dm-first-five') and w.season = h.season
      and w.earned_at > h.first_at;
  end loop;
end;
$$;
