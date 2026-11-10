-- S14: a lucky guess is not a quick answer. record_fact_answers gets a last argument `min_ms` (default 0): a right
-- answer faster than that is still saved (attempts, correct, time) but is not "quick", so its box and quick days stay.
-- The default of 0 keeps every caller that sends seven arguments exactly as it was. Nothing else about the function
-- changes. Old rows are not touched.
drop function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer);

-- `answers` = [{ key, correct, ms, at (ms since 1970) }], oldest first.
-- Returns how many answers were added (0 if this batch was seen before).
create function public.record_fact_answers(
  player uuid,
  pack text,
  batch_id uuid,
  answers jsonb,
  quick_ms integer,
  fluent_days integer,
  top_box integer,
  min_ms integer default 0
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  f public.gem_keep_facts;
  answered timestamptz;
  day date;
  added integer := 0;
begin
  perform public.gem_keep_check_player(player);
  insert into public.fact_answer_batches (player, batch_id) values (player, batch_id) on conflict do nothing;
  if not found then
    return 0;
  end if;
  for a in
    select e ->> 'key' as key, (e ->> 'correct')::boolean as correct, (e ->> 'ms')::integer as ms,
           (e ->> 'at')::bigint as at
    from jsonb_array_elements(answers) with ordinality as x(e, n)
    order by x.n
  loop
    answered := to_timestamp(a.at / 1000.0);
    day := (answered at time zone 'Pacific/Auckland')::date;
    select * into f from public.gem_keep_facts g
    where g.player = record_fact_answers.player and g.pack = record_fact_answers.pack and g.fact_key = a.key
    for update;
    if not found then
      f := row(player, pack, a.key, 0, 0, 0, 0, null, '{}', now())::public.gem_keep_facts;
    end if;
    f.attempts := f.attempts + 1;
    f.correct := f.correct + case when a.correct then 1 else 0 end;
    f.avg_ms := round(f.avg_ms + (a.ms - f.avg_ms)::numeric / f.attempts);
    f.last_seen := answered;
    if not a.correct then
      f.box := 1;
    elsif a.ms >= min_ms and a.ms <= quick_ms then
      if not day = any (f.quick_days) then
        f.quick_days := (select coalesce(array_agg(d order by n), '{}') from (
          select d, n from unnest(f.quick_days || day) with ordinality as q(d, n)
          order by n desc limit fluent_days) last_days);
      end if;
      f.box := least(f.box + 1, case when cardinality(f.quick_days) >= fluent_days then top_box else top_box - 1 end);
    end if;
    insert into public.gem_keep_facts as g (player, pack, fact_key, attempts, correct, avg_ms, box, last_seen, quick_days)
    values (player, pack, a.key, f.attempts, f.correct, f.avg_ms, f.box, f.last_seen, f.quick_days)
    on conflict on constraint gem_keep_facts_pkey do update set
      attempts = excluded.attempts, correct = excluded.correct, avg_ms = excluded.avg_ms, box = excluded.box,
      last_seen = excluded.last_seen, quick_days = excluded.quick_days, updated_at = now();
    added := added + 1;
  end loop;
  return added;
end;
$$;

revoke execute on function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer, integer)
from public, anon, authenticated;
grant execute on function public.record_fact_answers(uuid, text, uuid, jsonb, integer, integer, integer, integer) to service_role;
