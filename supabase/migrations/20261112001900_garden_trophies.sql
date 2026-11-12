-- Profile rewards for the 11 early-years games and Quick looks (docs/plans/profile/PLAN.md card P9; docs/PROFILE-REVIEW.md
-- section 5). Uses the trophy system from 20261112000800_trophies.sql. Nothing here comes from speed, step level or being
-- first, and nothing gives hub points: only days played and golden prizes finished (docs/LEARNING-DESIGN.md).
--
--   1. trophy_types rows   a Garden Cup per game (steps: bronze at 30 days played, silver at 90, gold at 150), one earned
--                          picture per friend (that friend's painting, won when its 30-day golden prize is finished), and
--                          Quick looks' Garden Gate (the whole garden grown, all 7 stages).
--   2. garden_rewards      gives what a count of days played has earned in one game. Safe to call again.
--   3. Triggers            on each <game>_progress (when days_done goes up to a multiple of 30: every prize, and the cup's
--                          30, 90 and 150, fall on one) and on training_students (Quick looks), so no
--                          game's own finish function changes. A trophy that fails to save never stops a child's finish.
--   4. Back-award          from today's days_done and Quick looks' saved garden.
--
-- A friend's place in its game's friends list is the picture rows' `sort` order, so it must match FRIENDS in the game's
-- shared config (checked by src/avatar/gardenPictures.test.ts). Golden prize k (k = days_done / 30) is the friend the child
-- was with, FRIENDS[(k - 1) % n]; the list goes round again after the last friend.

-- ---------------------------------------------------------------------------
-- 1. What can be won
-- ---------------------------------------------------------------------------

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort)
select v.game || '-cup', v.game, 'Garden Cup', 'Play ' || v.title || ' on 30 days for bronze, 90 for silver and 150 for gold.',
       'trophy', 'steps', null, 5000 + v.n * 20
from (values
  (1, 'beanstalk', 'Kiwi''s Beanstalk'), (2, 'hop', 'Hop''s Glow-worm Pond'), (3, 'pipi', 'Pipi''s Hidden Shells'),
  (4, 'korora', 'Penguin Pairs'), (5, 'weka', 'Weka''s Stepping Stones'), (6, 'tui', 'Tūī''s Ten Tree'),
  (7, 'lizard', 'Lizard''s Bundles'), (8, 'parrot', 'Parrot''s See-saw'), (9, 'pigeon', 'Pigeon''s Number Line'),
  (10, 'robin', 'Robin''s Berry Basket'), (11, 'swamphen', 'Swamp Hen''s Reed Rows')
) v(n, game, title);

-- One picture per friend, in each game's FRIENDS order (the `i` column). The prize's own name is in `how`.
insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort)
select v.game || '-' || v.friend, v.game, v.name,
       'Play 30 days with ' || v.name || ' and win the ' || v.prize || '.', 'picture', 'once', v.game || '-' || v.friend,
       5000 + v.n * 20 + v.i
from (values
  (1, 'beanstalk', 1, 'kiwi', 'Kiwi', 'Golden Egg'), (1, 'beanstalk', 2, 'tui', 'Tūī', 'Golden Egg'),
  (1, 'beanstalk', 3, 'kereru', 'Kererū', 'Golden Egg'), (1, 'beanstalk', 4, 'weta', 'Wētā', 'Golden Egg'),
  (1, 'beanstalk', 5, 'ruru', 'Ruru', 'Golden Egg'), (1, 'beanstalk', 6, 'takahe', 'Takahē', 'Golden Egg'),
  (2, 'hop', 1, 'hop', 'Hop', 'Golden Glow Jar'), (2, 'hop', 2, 'gecko', 'Gecko', 'Golden Glow Jar'),
  (2, 'hop', 3, 'weta', 'Wētā', 'Golden Glow Jar'), (2, 'hop', 4, 'tuatara', 'Tuatara', 'Golden Glow Jar'),
  (2, 'hop', 5, 'kiwi', 'Kiwi', 'Golden Glow Jar'), (2, 'hop', 6, 'ruru', 'Ruru', 'Golden Glow Jar'),
  (3, 'pipi', 1, 'pipi', 'Pipi', 'Golden Pearl'), (3, 'pipi', 2, 'korora', 'Kororā', 'Golden Pearl'),
  (3, 'pipi', 3, 'tuatara', 'Tuatara', 'Golden Pearl'), (3, 'pipi', 4, 'weta', 'Wētā', 'Golden Pearl'),
  (3, 'pipi', 5, 'kiwi', 'Kiwi', 'Golden Pearl'), (3, 'pipi', 6, 'tui', 'Tūī', 'Golden Pearl'),
  (4, 'korora', 1, 'korora', 'Two-Shoes', 'gold dancing shoes'), (4, 'korora', 2, 'hoiho', 'Hoiho', 'gold dancing shoes'),
  (4, 'korora', 3, 'kiwi', 'Kiwi', 'gold dancing shoes'), (4, 'korora', 4, 'pukeko', 'Pūkeko', 'gold dancing shoes'),
  (4, 'korora', 5, 'kereru', 'Kererū', 'gold dancing shoes'), (4, 'korora', 6, 'takahe', 'Takahē', 'gold dancing shoes'),
  (5, 'weka', 1, 'weka', 'Weka', 'Golden Picnic Basket'), (5, 'weka', 2, 'kiwi', 'Kiwi', 'Golden Picnic Basket'),
  (5, 'weka', 3, 'takahe', 'Takahē', 'Golden Picnic Basket'), (5, 'weka', 4, 'kakapo', 'Kākāpō', 'Golden Picnic Basket'),
  (5, 'weka', 5, 'pukeko', 'Pūkeko', 'Golden Picnic Basket'), (5, 'weka', 6, 'kea', 'Kea', 'Golden Picnic Basket'),
  (6, 'tui', 1, 'tui', 'Tūī', 'Golden Nest'), (6, 'tui', 2, 'kereru', 'Kererū', 'Golden Nest'),
  (6, 'tui', 3, 'piwakawaka', 'Pīwakawaka', 'Golden Nest'), (6, 'tui', 4, 'korimako', 'Korimako', 'Golden Nest'),
  (6, 'tui', 5, 'kaka', 'Kākā', 'Golden Nest'),
  (7, 'lizard', 1, 'lizard', 'Lizard', 'Golden Raft'), (7, 'lizard', 2, 'kiwi', 'Kiwi', 'Golden Raft'),
  (7, 'lizard', 3, 'fantail', 'Fantail', 'Golden Raft'), (7, 'lizard', 4, 'bellbird', 'Bellbird', 'Golden Raft'),
  (7, 'lizard', 5, 'kea', 'Kea', 'Golden Raft'),
  (8, 'parrot', 1, 'parrot', 'Parrot', 'Golden Bell'), (8, 'parrot', 2, 'robin', 'Robin', 'Golden Bell'),
  (8, 'parrot', 3, 'kiwi', 'Kiwi', 'Golden Bell'), (8, 'parrot', 4, 'duck', 'Duck', 'Golden Bell'),
  (8, 'parrot', 5, 'owl', 'Owl', 'Golden Bell'),
  (9, 'pigeon', 1, 'pigeon', 'Pigeon', 'Golden Berry Branch'), (9, 'pigeon', 2, 'sparrow', 'Sparrow', 'Golden Berry Branch'),
  (9, 'pigeon', 3, 'fantail', 'Fantail', 'Golden Berry Branch'), (9, 'pigeon', 4, 'bellbird', 'Bellbird', 'Golden Berry Branch'),
  (9, 'pigeon', 5, 'parrot', 'Parrot', 'Golden Berry Branch'),
  (10, 'robin', 1, 'robin', 'Robin', 'Golden Berry Feast'), (10, 'robin', 2, 'kiwi', 'Kiwi', 'Golden Berry Feast'),
  (10, 'robin', 3, 'kea', 'Kea', 'Golden Berry Feast'), (10, 'robin', 4, 'weka', 'Weka', 'Golden Berry Feast'),
  (10, 'robin', 5, 'pukeko', 'Pūkeko', 'Golden Berry Feast'), (10, 'robin', 6, 'tui', 'Tūī', 'Golden Berry Feast'),
  (11, 'swamphen', 1, 'swamphen', 'Swamp Hen', 'Golden Reed Garden'), (11, 'swamphen', 2, 'pigeon', 'Pigeon', 'Golden Reed Garden'),
  (11, 'swamphen', 3, 'kea', 'Kea', 'Golden Reed Garden'), (11, 'swamphen', 4, 'weka', 'Weka', 'Golden Reed Garden'),
  (11, 'swamphen', 5, 'tui', 'Tui', 'Golden Reed Garden'), (11, 'swamphen', 6, 'heron', 'White Heron', 'Golden Reed Garden')
) v(n, game, i, friend, name, prize);

insert into public.trophy_types (id, game, name, how, kind, repeat, art, sort)
values ('quick-looks-gate', 'quick-looks', 'Garden Gate', 'Grow the whole Quick looks garden: all seven beds in flower.',
        'trophy', 'once', null, 5240);

-- ---------------------------------------------------------------------------
-- 2. Giving them
-- ---------------------------------------------------------------------------

-- What `days` days played has earned in one early-years game: each Garden Cup step reached, and, when `days` is a 30-day
-- golden prize, the picture of the friend whose prize it was. With every_prize, the pictures for every prize so far (for
-- the back-award). Safe to call again: award_trophy adds nothing twice. Server only.
create function public.garden_rewards(who uuid, game text, days integer, every_prize boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  friends text[];
  prize integer;
  step integer;
begin
  if days is null or days < 30 then
    return;
  end if;
  for step in 1..3 loop
    if days >= (array[30, 90, 150])[step] then
      perform public.award_trophy(who, game || '-cup', jsonb_build_object('step', step));
    end if;
  end loop;
  select array_agg(t.id order by t.sort) into friends
  from public.trophy_types t where t.game = garden_rewards.game and t.kind = 'picture';
  if friends is null then
    return;
  end if;
  for prize in (case when every_prize then 1 else days / 30 end)..(days / 30) loop
    if every_prize or days % 30 = 0 then
      perform public.award_trophy(who, friends[(prize - 1) % cardinality(friends) + 1], jsonb_build_object('days', prize * 30));
    end if;
  end loop;
end;
$$;

-- The trigger on each <game>_progress: TG_ARGV[0] is the game id. Never stops the finish it rides on.
create function public.garden_rewards_after_finish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.garden_rewards(new.player, tg_argv[0], new.days_done);
  exception when others then
    raise warning 'garden_rewards % for %: %', tg_argv[0], new.player, sqlerrm;
  end;
  return null;
end;
$$;

-- Quick looks: the whole garden is all seven stages finished in a row (typing.q.f = 7, the most the game keeps).
create function public.garden_gate_after_save()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.typing -> 'q' ->> 'f', '') ~ '^[0-9]$' and (new.typing -> 'q' ->> 'f')::integer >= 7
     and not exists (select 1 from public.trophies w where w.player = new.player and w.trophy = 'quick-looks-gate') then
    begin
      perform public.award_trophy(new.player, 'quick-looks-gate');
    exception when others then
      raise warning 'garden gate for %: %', new.player, sqlerrm;
    end;
  end if;
  return null;
end;
$$;

revoke execute on function
  public.garden_rewards(uuid, text, integer, boolean),
  public.garden_rewards_after_finish(),
  public.garden_gate_after_save()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------------

create trigger beanstalk_garden_rewards after update on public.beanstalk_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('beanstalk');
create trigger hop_garden_rewards after update on public.hop_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('hop');
create trigger pipi_garden_rewards after update on public.pipi_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('pipi');
create trigger korora_garden_rewards after update on public.korora_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('korora');
create trigger weka_garden_rewards after update on public.weka_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('weka');
create trigger tui_garden_rewards after update on public.tui_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('tui');
create trigger lizard_garden_rewards after update on public.lizard_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('lizard');
create trigger parrot_garden_rewards after update on public.parrot_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('parrot');
create trigger pigeon_garden_rewards after update on public.pigeon_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('pigeon');
create trigger robin_garden_rewards after update on public.robin_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('robin');
create trigger swamphen_garden_rewards after update on public.swamphen_progress
for each row when (new.days_done > old.days_done and new.days_done % 30 = 0) execute function public.garden_rewards_after_finish('swamphen');

create trigger quick_looks_garden_gate after insert or update of typing on public.training_students
for each row execute function public.garden_gate_after_save();

-- ---------------------------------------------------------------------------
-- 4. Back-award from today's records
-- ---------------------------------------------------------------------------

do $$
declare
  g text;
  r record;
begin
  foreach g in array array['beanstalk', 'hop', 'pipi', 'korora', 'weka', 'tui', 'lizard', 'parrot', 'pigeon', 'robin', 'swamphen'] loop
    for r in execute format('select player, days_done from public.%I where days_done >= 30', g || '_progress') loop
      perform public.garden_rewards(r.player, g, r.days_done, true);
    end loop;
  end loop;
  for r in select s.player from public.training_students s
           where coalesce(s.typing -> 'q' ->> 'f', '') ~ '^[0-9]$' and (s.typing -> 'q' ->> 'f')::integer >= 7 loop
    perform public.award_trophy(r.player, 'quick-looks-gate');
  end loop;
end;
$$;
