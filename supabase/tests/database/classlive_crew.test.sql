-- Saboteur Crew (migration 20261126000200_classlive_crew.sql, Class Live activity 'crew'): the activity row, the move
-- function's grants, and its trophies. Run on a throw-away copy: scripts/scratch-test.sh classlive supabase/tests/database/classlive_crew.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is((select moves from public.classlive_activities where id = 'crew'), true, 'Saboteur Crew is a moving activity');
select is((select name from public.classlive_activities where id = 'crew'), 'Saboteur Crew', '... named Saboteur Crew for the lobby button');
select ok(has_function_privilege('authenticated', 'public.classlive_crew_move(bigint, double precision, double precision)', 'execute'), 'signed-in devices can save their spot');
select ok(not has_function_privilege('anon', 'public.classlive_crew_move(bigint, double precision, double precision)', 'execute'), '... nobody signed out can');
select is((select count(*)::int from public.achievement_types where measure like 'classlive_crew_%'), 3, 'three Saboteur Crew trophies');

select * from finish();
rollback;
