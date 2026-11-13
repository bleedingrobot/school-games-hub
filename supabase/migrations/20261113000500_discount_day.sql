-- Discount day (James, 13 Nov 2026): a teacher's switch on the Today page that makes every arrow in the Archery
-- Challenge's Armory half price for one class, for the rest of that New Zealand day only. It turns itself off at
-- midnight, like Unlimited turns today (20261105000200).
--
-- 1. app_settings.discount_days: { game id: the NZ date its switch is on for }. An old date means off. Only 'archery'
--    for now; another game can join by adding its id to the list in teacher_set_discount_today() and to
--    DISCOUNT_GAMES in shared/discountDay.ts.
-- 2. teacher_set_discount_today(game, enabled, target_class).
-- The archery server reads the column through settings_of(), and halves the prices itself (shared/archery/shop.ts).

alter table public.app_settings add column discount_days jsonb not null default '{}'::jsonb;

create function public.teacher_set_discount_today(game text, enabled boolean, target_class uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_teacher();
  if enabled is null or game is null or game not in ('archery') then
    raise exception 'Unknown Discount day setting' using errcode = '22023';
  end if;
  perform public.require_settings_target(target_class);
  update public.app_settings
  set discount_days = case when enabled
    then discount_days || jsonb_build_object(game, to_char((now() at time zone 'Pacific/Auckland')::date, 'YYYY-MM-DD'))
    else discount_days - game end
  where id in (select public.settings_to_change(target_class));
end;
$$;

revoke execute on function public.teacher_set_discount_today(text, boolean, uuid) from public, anon, authenticated;
grant execute on function public.teacher_set_discount_today(text, boolean, uuid) to authenticated;
