-- Trophies won for maths results stay off the school's public lists (James, 13 Nov 2026: the Royal Crown, won by getting all
-- 8 Royal Decree riddles right, showed in the Hall of fame). docs/LEADERBOARD-PLAN.md.
--
--   1. trophy_types.on_hall: false = never on the Hall of fame or the home page's New trophies. Off for decree-crown.
--      The pupil still sees it in their own cabinet; the trophy itself is unchanged.
--   2. hall_of_fame() and recent_trophies() skip those, by small exact edits (each must match once, or nothing changes).

alter table public.trophy_types add column on_hall boolean not null default true;
comment on column public.trophy_types.on_hall is
  'False for a trophy won by a maths result: it never shows on the Hall of fame or the New trophies strip.';
update public.trophy_types set on_hall = false where id = 'decree-crown';

do $migration$
declare
  edits text[][] := array[
    array['public.hall_of_fame()', 'and t.kind = ''picture'' and t.id <> ''dm-first-five''',
          'and t.kind = ''picture'' and t.id <> ''dm-first-five'' and t.on_hall'],
    array['public.recent_trophies()', 'where w.earned_at > now() - interval ''7 days''',
          'where w.earned_at > now() - interval ''7 days'' and t.on_hall']
  ];
  def text;
  i integer;
begin
  for i in 1 .. array_length(edits, 1) loop
    def := pg_get_functiondef(edits[i][1]::regprocedure);
    if (length(def) - length(replace(def, edits[i][2], ''))) / length(edits[i][2]) <> 1 then
      raise exception '% edit did not match exactly once; nothing was changed', edits[i][1];
    end if;
    execute replace(def, edits[i][2], edits[i][3]);
  end loop;
end;
$migration$;

revoke execute on function public.hall_of_fame(), public.recent_trophies() from public, anon, authenticated;
grant execute on function public.hall_of_fame(), public.recent_trophies() to authenticated;
