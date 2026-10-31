-- Clan Quest My Village: the one-off chest sharing is for the SQL editor only.
-- Supabase gives new functions to service_role by default, so take that back too
-- (20261028001000 only took it from public, anon and authenticated).
revoke execute on function public.clan_my_village_share_chests(), public.clan_sync_village_built() from service_role;
