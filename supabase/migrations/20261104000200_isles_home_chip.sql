-- Sky Isles on the home page "moves left today" chips: an exact edit to my_moves_left() so it also sends 'isles'
-- ({ day, turnsLeft } from the pupil's island, null if they have none yet). src/data/movesLeft.ts reads it.
-- Depends on 20261104000100_isles.sql (the isles_islands table), so it is on hold with it
-- (supabase/migrations-on-hold.txt) until Sky Isles goes live. If the text is not found exactly once, nothing changes.

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
  E'               from public.trader_games g where g.player = me.id)\n',
  E'               from public.trader_games g where g.player = me.id),\n'
  || E'    ''isles'', (select jsonb_build_object(''day'', i.day, ''turnsLeft'', (i.island ->> ''turnsLeft'')::integer)\n'
  || E'               from public.isles_islands i where i.player = me.id and i.island is not null)\n'
]]);
