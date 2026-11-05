-- Clan Quest: beating the same boss again in a season earns less fame each time (5, 4, 3, 2, then 1).
-- The rules (shared/clans/rewards.ts, recordBossWin) put the fame in the saved result as `earned.bossFame`;
-- this re-creates clan_apply_earned (from 20261018002100_clans_rewards.sql, unchanged since) to use it.
-- A result without `bossFame` (saved before this) still earns bossWin for each boss. Points are unchanged.

create or replace function public.clan_apply_earned(who uuid, e jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rules jsonb := public.clan_reward_rules();
  c public.clans;
  w integer := 0;
  b integer := 0;
  v_wars integer := 0;
  k integer := 0;
  r integer := 0;
  v_cries integer := 0;
  v_boss_fame integer;
  v_fame integer;
  v_pending integer;
  v_raw integer;
  per integer := (rules -> 'points' ->> 'minesPerPoint')::integer;
begin
  select * into c from public.clans x where x.player = who for update;
  if not found then
    return;
  end if;
  if jsonb_typeof(e) = 'object' then
    w := coalesce((e ->> 'wins')::integer, 0);
    b := coalesce((e ->> 'bosses')::integer, 0);
    v_wars := coalesce((e ->> 'wars')::integer, 0);
    k := coalesce((e ->> 'kingdomRaids')::integer, 0);
    r := coalesce((e ->> 'classRaids')::integer, 0);
    v_cries := coalesce((e ->> 'cries')::integer, 0);
    -- The rules work out boss fame (it shrinks each time the same boss is beaten in a season). Older saves have none: bossWin each.
    v_boss_fame := coalesce((e ->> 'bossFame')::integer, b * (rules -> 'fame' ->> 'bossWin')::integer);
    if least(w, b, v_wars, k, r, v_cries, v_boss_fame) < 0 or greatest(w, b, v_wars, k, r, v_cries, v_boss_fame) > 100 then
      raise exception 'Those rewards could not be read.' using errcode = '22023';
    end if;
  end if;
  if w + b + v_wars + k + r + v_cries > 0 then
    v_fame := w * (rules -> 'fame' ->> 'mineWin')::integer + v_boss_fame
      + v_wars * (rules -> 'fame' ->> 'warWin')::integer + k * (rules -> 'fame' ->> 'kingdomRaidWin')::integer
      + r * (rules -> 'fame' ->> 'classRaidWin')::integer;
    v_pending := c.wins_pending + w;
    v_raw := v_pending / per + b * (rules -> 'points' ->> 'boss')::integer + v_wars * (rules -> 'points' ->> 'war')::integer;
    update public.clans x set
      fame = x.fame + v_fame,
      wins_pending = v_pending % per,
      stats = x.stats || jsonb_build_object(
        'mineWins', coalesce((x.stats ->> 'mineWins')::integer, 0) + w,
        'bossWins', coalesce((x.stats ->> 'bossWins')::integer, 0) + b,
        'warWins', coalesce((x.stats ->> 'warWins')::integer, 0) + v_wars,
        'kingdomRaids', coalesce((x.stats ->> 'kingdomRaids')::integer, 0) + k,
        'classRaids', coalesce((x.stats ->> 'classRaids')::integer, 0) + r,
        'cries', coalesce((x.stats ->> 'cries')::integer, 0) + v_cries)
    where x.player = who;
    if v_raw > 0 then
      insert into public.clan_scores (player, wins, bosses, wars, points_raw, counts_for_points)
      values (who, w, b, v_wars, v_raw, true);
    end if;
  end if;
  perform public.award_achievements(who, 'clan-quest', now());
end;
$$;
