-- Makes my_progress() much cheaper without changing what it returns.
--
-- Every game page asks for it. It worked out the full set of progress counts (progress_counts, about fifty
-- figures across many tables) once for EVERY achievement, 50 to 77 times a call. On 19 Oct 2026 a whole class
-- doing this at once timed the database out. The counts only depend on the game, so now they are worked out
-- once per game (9 times) and shared by that game's achievements.
--
-- This edits the function as it is now, rather than writing out a fresh copy, so it keeps whatever else the
-- live version has (the class switches from settings_of, Bond Match in "recent" once that is merged). Each
-- piece of text it changes must be found exactly once; if not, this stops and changes nothing.
--
-- The three "is this game switched on?" checks (Monsters, Dragon Maths, Clan Quest) also looked up the class
-- settings again for every hidden achievement. They now look the switches up once. That part is only done if the
-- function has the class-settings form (settings_of) it has today.
do $migration$
declare
  def text := pg_get_functiondef('public.my_progress()'::regprocedure);
  edits text[][] := array[
    array[
      E'  week as (select public.nz_week_start(now()) as start)\n  select jsonb_build_object(',
      E'  week as (select public.nz_week_start(now()) as start),\n'
      || E'  -- progress_counts depends only on the game, so it is worked out once per game, not once per achievement.\n'
      || E'  counts as materialized (select g.game, public.progress_counts(me.id, g.game) as c\n'
      || E'                          from me, (select distinct at0.game from public.achievement_types at0) g)\n'
      || E'  select jsonb_build_object('
    ],
    array[
      E'(public.progress_counts(me.id, at.game) ->> at.measure)::integer',
      E'(pc.c ->> at.measure)::integer'
    ],
    array[
      E'left join public.achievements a on a.player = me.id and a.achievement = at.id\n',
      E'left join public.achievements a on a.player = me.id and a.achievement = at.id\n'
      || E'              left join counts pc on pc.game = at.game\n'
    ]
  ];
  i integer;
  needle text;
  switches text[][] := array[
    array['(select s.monsters_enabled from public.settings_of(auth.uid()) s)', '(select sw.monsters_enabled from sw)'],
    array['(select s.lord_enabled from public.settings_of(auth.uid()) s)', '(select sw.lord_enabled from sw)'],
    array['(select s.clans_enabled from public.settings_of(auth.uid()) s)', '(select sw.clans_enabled from sw)']
  ];
  anchor text := E'from me, (select distinct at0.game from public.achievement_types at0) g)';
  can_switch boolean := true;
begin
  for i in 1 .. array_length(edits, 1) loop
    needle := edits[i][1];
    if (length(def) - length(replace(def, needle, ''))) / length(needle) <> 1 then
      raise exception 'my_progress faster-version edit % did not match exactly once; nothing was changed', i;
    end if;
    def := replace(def, needle, edits[i][2]);
  end loop;
  -- The switches, looked up once (skipped, and nothing else affected, if the function doesn't look the way we expect).
  for i in 1 .. array_length(switches, 1) loop
    needle := switches[i][1];
    can_switch := can_switch and (length(def) - length(replace(def, needle, ''))) / length(needle) = 1;
  end loop;
  if can_switch then
    for i in 1 .. array_length(switches, 1) loop
      def := replace(def, switches[i][1], switches[i][2]);
    end loop;
    def := replace(def, anchor, anchor || E',\n'
      || E'  sw as materialized (select s.monsters_enabled, s.lord_enabled, s.clans_enabled from public.settings_of(auth.uid()) s)');
  end if;
  execute def;
end
$migration$;
