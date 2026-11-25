-- Ghost Tag (migration 20261125001300_classlive_ghost.sql, Class Live activity 'ghost'): the activity row, the move
-- function's grants, and its trophies. Run on a throw-away copy: scripts/scratch-test.sh classlive supabase/tests/database/classlive_ghost.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is((select moves from public.classlive_activities where id = 'ghost'), true, 'Ghost Tag is a moving activity');
select is((select name from public.classlive_activities where id = 'ghost'), 'Ghost Tag', '... named Ghost Tag for the lobby button');
select ok(has_function_privilege('authenticated', 'public.classlive_ghost_move(bigint, double precision, double precision)', 'execute'), 'signed-in devices can save their spot');
select ok(not has_function_privilege('anon', 'public.classlive_ghost_move(bigint, double precision, double precision)', 'execute'), '... nobody signed out can');
select is((select count(*)::int from public.achievement_types where measure like 'classlive_ghost_%'), 3, 'three Ghost Tag trophies');

select * from finish();
rollback;
