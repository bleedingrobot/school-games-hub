-- Quick looks (subitising) settings live inside training_students.typing under "q" ({p, s, f, g}).
-- Saving a student replaced the whole typing column, so an older Training tab (one that never opened
-- Quick looks) wiped "q", and the student had to do the starting check again. Now:
--   - a save without "q" keeps the "q" already saved;
--   - a save with "q" never lowers "f" (stages finished in a row), like sessions_done.
-- An exact edit to record_training_student(); if the text is not found exactly once, nothing changes.

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

select pg_temp.edit_function('public.record_training_student(uuid,jsonb,boolean,integer)', array[array[
  E'    typing = excluded.typing,\n',
  E'    typing = case\n'
  || E'      when excluded.typing ? ''q'' and jsonb_typeof(s.typing -> ''q'' -> ''f'') = ''number''\n'
  || E'           and jsonb_typeof(excluded.typing -> ''q'' -> ''f'') = ''number''\n'
  || E'        then jsonb_set(excluded.typing, ''{q,f}'',\n'
  || E'          to_jsonb(greatest((s.typing -> ''q'' ->> ''f'')::numeric, (excluded.typing -> ''q'' ->> ''f'')::numeric)))\n'
  || E'      when excluded.typing ? ''q'' then excluded.typing\n'
  || E'      when s.typing ? ''q'' then excluded.typing || jsonb_build_object(''q'', s.typing -> ''q'')\n'
  || E'      else excluded.typing\n'
  || E'    end,\n'
]]);
