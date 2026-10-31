-- Drops the four old class reports that had no class and read the whole school (docs/TEACHER-VIEW-PLAN.md, section 6,
-- stage 3, and section 9: decided by James, 28 Oct 2026).
--
-- Each was replaced by a report for one class, which the website now calls:
--   teacher_gem_keep_class(target_class)    20261028000100
--   teacher_monster_class(target_class)     20261028000200
--   teacher_lord_class(target_class)        20261028000300 (re-created to read the school's season in 20261028000400)
--   teacher_clan_maths_class(target_class)  20261028000500
--
-- The order on the live site matters, or teachers' class reports break:
--   1. Apply all four of those migrations.
--   2. Then publish the website from this branch (it calls only the class reports, with no fallback to the old ones).
--   3. Only then apply this migration. Until step 2, the published website still calls the old reports.
--
-- Nothing else in the database calls these functions. teacher_lord_class() was re-created by 20261028000400 to read the
-- school's season; it goes too.

drop function public.teacher_gem_keep_class();
drop function public.teacher_monster_class();
drop function public.teacher_lord_class();
drop function public.teacher_clan_maths_class();
