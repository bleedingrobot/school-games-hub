-- Toon Flap and Goblin Storm join Bonus Turns Day and the home page's "Left today" card chips (James, 20 Nov 2026).
--
-- 1. A Toon Flap or Goblin Storm class quest can give a Bonus Turns Day (quest_turns_game, the bonus_turns check).
--    Both games already read unlimited_days through settings_of, which adds a pupil's bonus day, so no game changes.
-- 2. my_moves_left() also sends 'toonflap' ({ wins, dashes, dashOpen } today) and 'goblinstorm' ({ runs } today), for the
--    home cards (src/data/movesLeft.ts). An exact edit: if the text is not found exactly once, nothing changes.

create or replace function public.quest_turns_game(which text)
returns text
language sql
stable
set search_path = ''
as $$
  select case k.switch_column
           when 'trader_enabled' then 'trader'
           when 'lord_enabled' then 'dragon-maths'
           when 'clans_enabled' then 'clan-quest'
           when 'clan_raids_enabled' then 'clan-quest'
           when 'monsters_enabled' then 'monsters'
           when 'diamond_enabled' then 'diamond'
           when 'isles_enabled' then 'isles'
           when 'toonflap_enabled' then 'toonflap'
           when 'goblinstorm_enabled' then 'goblinstorm'
         end
  from public.quest_kinds k where k.id = which
$$;

alter table public.bonus_turns drop constraint bonus_turns_game_check;
alter table public.bonus_turns add constraint bonus_turns_game_check
  check (game in ('dragon-maths', 'clan-quest', 'monsters', 'diamond', 'trader', 'isles', 'toonflap', 'goblinstorm'));

create or replace function pg_temp.edit_function(sig text, edits text[][])
returns void
language plpgsql
as $$
declare
  def text := pg_get_functiondef(sig::regprocedure);
  i integer;
begin
  for i in 1 .. array_length(edits, 1) loop
    if (length(def) - length(replace(def, edits[i][1], ''))) / length(edits[i][1]) <> 1 then
      raise exception '% edit % did not match exactly once; nothing was changed', sig, i;
    end if;
    def := replace(def, edits[i][1], edits[i][2]);
  end loop;
  execute def;
end;
$$;

select pg_temp.edit_function('public.my_moves_left()', array[array[
  E'               from public.isles_islands i where i.player = me.id and i.island is not null)\n',
  E'               from public.isles_islands i where i.player = me.id and i.island is not null),\n'
  || E'    ''toonflap'', (select jsonb_build_object(\n'
  || E'                   ''wins'', (select count(*) from public.toonflap_runs r where r.player = me.id and r.level <> ''dash''\n'
  || E'                            and r.finished_day = (now() at time zone ''Pacific/Auckland'')::date),\n'
  || E'                   ''dashes'', (select count(*) from public.toonflap_runs r where r.player = me.id and r.level = ''dash''\n'
  || E'                              and r.started_day = (now() at time zone ''Pacific/Auckland'')::date),\n'
  || E'                   ''dashOpen'', coalesce((p.progress -> ''levels'' -> ''donut'' ->> ''finishes'')::integer, 0) > 0)\n'
  || E'                 from public.toonflap_progress p where p.player = me.id),\n'
  || E'    ''goblinstorm'', (select jsonb_build_object(''runs'', count(*)) from public.goblinstorm_runs r\n'
  || E'                    where r.player = me.id and r.day = (now() at time zone ''Pacific/Auckland'')::date)\n'
]]);
