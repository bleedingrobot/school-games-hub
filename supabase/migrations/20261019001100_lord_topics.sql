-- Dragon Maths: the teacher's topic switches.
--
-- Each class's settings row gets a list of the maths topics Dragon Maths may ask about. All eight are on to start.
-- At least one must stay on. lord_settings() hands the list to the game (and to the teacher page) and
-- teacher_set_lord() accepts and checks a new list; leave 'topics' out and the list is left as it was.
-- The `lord` function does the rest: it refuses a question from a switched-off topic, and the game picks only from
-- the switched-on ones (a moment whose own topics are all off uses whichever topics are on; a forest event about a
-- switched-off topic is not found in the forest). No data changes, so nothing here needs a clean-up on the way out.

alter table public.app_settings
  add column lord_topics text[] not null
    default '{place-value,add-sub,times-tables,division,fractions,decimals,money,patterns}'
    check (lord_topics <@ '{place-value,add-sub,times-tables,division,fractions,decimals,money,patterns}' and cardinality(lord_topics) >= 1);

create or replace function public.lord_settings(player uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('enabled', s.lord_enabled, 'forestPerDay', s.lord_forest_per_day,
    'seasonStart', to_char(s.lord_season_start, 'YYYY-MM-DD'), 'pausedSince', to_char(s.lord_paused_since, 'YYYY-MM-DD'),
    'topics', to_jsonb(s.lord_topics))
  from public.settings_of(coalesce(player, auth.uid())) s
$$;

-- `settings` = { enabled: boolean, forestPerDay?: 1-30, seasonStart?: 'YYYY-MM-DD' | null, topics?: ['add-sub', ...] }.
-- The rest is as before (the season pause runs for each class that is changed).
create or replace function public.teacher_set_lord(settings jsonb, target_class uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.app_settings;
  per_day integer;
  start date;
  paused date;
  was_on boolean;
  now_on boolean;
  topics text[];
  today date := public.nz_day(now());
  from_day date;
begin
  perform public.require_teacher();
  if jsonb_typeof(settings) is distinct from 'object' or jsonb_typeof(settings -> 'enabled') is distinct from 'boolean' then
    raise exception 'Those settings couldn''t be read.' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  now_on := (settings ->> 'enabled')::boolean;
  if settings ? 'forestPerDay' then
    if jsonb_typeof(settings -> 'forestPerDay') is distinct from 'number'
       or (settings ->> 'forestPerDay')::numeric <> trunc((settings ->> 'forestPerDay')::numeric)
       or (settings ->> 'forestPerDay')::numeric not between 1 and 30 then
      raise exception 'Forest fights a day must be a whole number from 1 to 30.' using errcode = '22023';
    end if;
  end if;
  if settings ? 'seasonStart' then
    if jsonb_typeof(settings -> 'seasonStart') <> 'null'
       and not (jsonb_typeof(settings -> 'seasonStart') = 'string' and (settings ->> 'seasonStart') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then
      raise exception 'That start date couldn''t be read.' using errcode = '22023';
    end if;
  end if;
  if settings ? 'topics' then
    if jsonb_typeof(settings -> 'topics') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements(settings -> 'topics') e where jsonb_typeof(e) <> 'string') then
      raise exception 'Those topics couldn''t be read.' using errcode = '22023';
    end if;
    select coalesce(array_agg(distinct t order by t), '{}') into topics from jsonb_array_elements_text(settings -> 'topics') as t;
    if not topics <@ '{place-value,add-sub,times-tables,division,fractions,decimals,money,patterns}' then
      raise exception 'Those topics couldn''t be read.' using errcode = '22023';
    end if;
    if cardinality(topics) = 0 then
      raise exception 'Leave at least one topic on.' using errcode = '22023';
    end if;
  end if;
  for cfg in
    select s.* from public.app_settings s where s.id in (select public.settings_to_change(target_class)) for update
  loop
    per_day := cfg.lord_forest_per_day;
    start := cfg.lord_season_start;
    paused := cfg.lord_paused_since;
    was_on := cfg.lord_enabled;
    if settings ? 'forestPerDay' then
      per_day := (settings ->> 'forestPerDay')::integer;
    end if;
    if settings ? 'seasonStart' then
      if jsonb_typeof(settings -> 'seasonStart') = 'null' then
        start := null;
      else
        start := (settings ->> 'seasonStart')::date;
      end if;
      paused := null;
    elsif was_on and not now_on then
      paused := today;
    elsif now_on and not was_on and paused is not null then
      -- Only the days the season was already running count as paused.
      if start is not null then
        from_day := greatest(paused, start);
        if today > from_day then
          start := start + (today - from_day);
        end if;
      end if;
      paused := null;
    end if;
    if now_on and start is null then
      start := today;
    end if;
    update public.app_settings set
      lord_enabled = now_on, lord_forest_per_day = per_day, lord_season_start = start, lord_paused_since = paused,
      lord_topics = case when settings ? 'topics' then topics else lord_topics end
    where id = cfg.id;
  end loop;
  return public.lord_settings();
end;
$$;
