-- Smash Quest (id bonkers) stage B.3: the class boss (docs/BONKERS-PLAN.md). James, 27 Nov 2026: "chip all week, finish
-- Friday": every right answer all week dents the class's boss; on Friday each pupil gets one boss fight to finish it.
-- The last Friday of the hub season is the mega boss. James, 28 Nov 2026: "push right on".
--   1. Tables      bonkers_bosses (one per class, season and week) and bonkers_boss_hits (who dented it, and how much).
--   2. The job     bonkers_class_boss(player, season, week, mega, add, finishing): adds damage and returns the boss.
--                  The server function works out the season and week from the school's hub season (shared/bonkers/season.ts).
--   3. Trophies    Friday Boss Trophy (steps: help beat 1, 3, 8) and the Mega Boss Trophy (once a season), to everyone in
--                  the class who dented the boss that week.
-- The numbers (25 health a pupil, 35 for the mega boss, at least 8 pupils, chip up to 80%) are CLASS_BOSS in
-- shared/bonkers/config.ts: keep the two the same.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.bonkers_bosses (
  class_id uuid not null references public.classes (id) on delete cascade,
  season integer not null check (season between 1 and 10000),
  week integer not null check (week between 1 and 52),
  mega boolean not null,
  hp integer not null check (hp > 0),
  dealt integer not null default 0 check (dealt >= 0),
  beaten_at timestamptz,
  primary key (class_id, season, week)
);

create table public.bonkers_boss_hits (
  class_id uuid not null,
  season integer not null,
  week integer not null,
  player uuid not null references public.profiles (id) on delete cascade,
  dealt integer not null default 0 check (dealt >= 0),
  primary key (class_id, season, week, player),
  foreign key (class_id, season, week) references public.bonkers_bosses (class_id, season, week) on delete cascade
);
create index bonkers_boss_hits_by_player on public.bonkers_boss_hits (player);

alter table public.bonkers_bosses enable row level security;
alter table public.bonkers_boss_hits enable row level security;
revoke all on public.bonkers_bosses, public.bonkers_boss_hits from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. The job (service role only)
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort) values
  ('bonkers-friday', 'bonkers', 'Friday Boss Trophy', 'Help your class beat 1, 3 or 8 Friday bosses in Smash Quest.', 'trophy', 'steps', null, 361),
  ('bonkers-mega', 'bonkers', 'Mega Boss Trophy', 'Help your class beat the season''s mega boss in Smash Quest.', 'trophy', 'season', null, 362);

-- The class's boss for a season's week, after adding `add` damage from `player`. Without `finishing` the damage stops
-- at 80% of its health; with it (a Friday boss fight won) it can finish the boss, and then everyone who dented it that
-- week wins the trophy. Null when the player has no class (a teacher with none).
create function public.bonkers_class_boss(player uuid, season integer, week integer, mega boolean, add integer, finishing boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cls uuid;
  pupils integer;
  b public.bonkers_bosses;
  cap integer;
  room integer;
  hitter uuid;
  beaten integer;
begin
  if add < 0 or add > 1000 then
    raise exception 'That damage is not right.' using errcode = '22023';
  end if;
  select m.class_id into cls from public.class_members m where m.student_id = player;
  if cls is null then
    select t.class_id into cls from public.class_teachers t where t.teacher_id = player order by t.class_id limit 1;
  end if;
  if cls is null then
    return null;
  end if;
  select count(*)::int into pupils from public.class_members m where m.class_id = cls;
  insert into public.bonkers_bosses as x (class_id, season, week, mega, hp)
  values (cls, bonkers_class_boss.season, bonkers_class_boss.week, bonkers_class_boss.mega,
    greatest(8, pupils) * case when bonkers_class_boss.mega then 35 else 25 end)
  on conflict (class_id, season, week) do nothing;
  select * into b from public.bonkers_bosses x
  where x.class_id = cls and x.season = bonkers_class_boss.season and x.week = bonkers_class_boss.week for update;

  if add > 0 and b.beaten_at is null then
    cap := case when finishing then b.hp else greatest(b.dealt, floor(b.hp * 0.8)::int) end;
    room := least(add, greatest(0, cap - b.dealt));
    if room > 0 then
      update public.bonkers_bosses x set dealt = x.dealt + room
      where x.class_id = cls and x.season = b.season and x.week = b.week
      returning * into b;
    end if;
    insert into public.bonkers_boss_hits as h (class_id, season, week, player, dealt)
    values (cls, b.season, b.week, bonkers_class_boss.player, room)
    on conflict (class_id, season, week, player) do update set dealt = h.dealt + excluded.dealt;

    if b.dealt >= b.hp then
      update public.bonkers_bosses x set beaten_at = now()
      where x.class_id = cls and x.season = b.season and x.week = b.week
      returning * into b;
      -- Everyone who dented it this week wins: the Friday Boss Trophy's next step, or the season's Mega Boss Trophy.
      for hitter in select h.player from public.bonkers_boss_hits h where h.class_id = cls and h.season = b.season and h.week = b.week loop
        begin
          if b.mega then
            perform public.award_trophy(hitter, 'bonkers-mega');
          else
            select count(*)::int into beaten from public.bonkers_boss_hits h join public.bonkers_bosses y
              on y.class_id = h.class_id and y.season = h.season and y.week = h.week
            where h.player = hitter and not y.mega and y.beaten_at is not null;
            if beaten >= 1 then perform public.award_trophy(hitter, 'bonkers-friday', jsonb_build_object('step', 1)); end if;
            if beaten >= 3 then perform public.award_trophy(hitter, 'bonkers-friday', jsonb_build_object('step', 2)); end if;
            if beaten >= 8 then perform public.award_trophy(hitter, 'bonkers-friday', jsonb_build_object('step', 3)); end if;
          end if;
        exception when others then
          raise warning 'bonkers boss trophy for %: %', hitter, sqlerrm;
        end;
      end loop;
    end if;
  end if;

  return jsonb_build_object('hp', b.hp, 'dealt', b.dealt, 'beaten', b.beaten_at is not null);
end;
$$;

revoke execute on function public.bonkers_class_boss(uuid, integer, integer, boolean, integer, boolean) from public, anon, authenticated;
grant execute on function public.bonkers_class_boss(uuid, integer, integer, boolean, integer, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- 4. New Season: a fresh start (James, 27 Nov 2026: "5 Friday bosses, then the mega boss and a fresh start")
-- ---------------------------------------------------------------------------

-- The hero starts again at level 1 with starting gear, and picks a class again (a class can change at a new season).
-- Kept: stickers, the hats and pets bought, the Monster Book, the counts behind the achievements, adventures waiting.
create function public.bonkers_new_season(players uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bonkers_progress b
  set progress = b.progress || jsonb_build_object(
        'hero', null, 'level', 1, 'stars', 0, 'chests', 0,
        'gear', jsonb_build_object('weapon', 0, 'shoes', 0, 'cape', 0, 'shield', 0)),
      version = b.version + 1, updated_at = now()
  where b.player = any (players);
  -- A New Season mid-adventure: the adventure is closed unsaved (its fights were for the old hero).
  update public.bonkers_adventures a set open = false, finished_at = now()
  where a.player = any (players) and a.open;
$$;

revoke execute on function public.bonkers_new_season(uuid[]) from public, anon, authenticated;

update public.hub_games set season_fn = 'public.bonkers_new_season(uuid[])' where id = 'bonkers';
