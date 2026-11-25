-- Toon Flap Relay (migration 20261126000600_classlive_relay.sql, Class Live activity 'relay'): the activity row and its
-- trophies. Run on a throw-away copy: scripts/scratch-test.sh classlive supabase/tests/database/classlive_relay.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is((select moves from public.classlive_activities where id = 'relay'), false, 'Toon Flap Relay has no moving avatars');
select is((select name from public.classlive_activities where id = 'relay'), 'Toon Flap Relay', '... named Toon Flap Relay for the lobby button');
select is((select count(*)::int from public.achievement_types where measure like 'classlive_relay_%'), 3, 'three Toon Flap Relay trophies');

select * from finish();
rollback;
