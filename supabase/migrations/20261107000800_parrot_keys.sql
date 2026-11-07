-- Parrot's See-saw records its answers under keys like 'eqmiss:8=5+?' and 'eqtf:5+3=4+4' (shared/maths/skillPacks/equalsKeys.ts,
-- pack 'early-facts'). The key check widened in 20261018002700 ('^[a-z][a-z0-9]{0,9}:[a-z0-9:+/-]{1,40}$') refuses '=' and '?',
-- so record_fact_answers would fail the whole batch. This adds those two characters, and nothing else.
--
-- Safe for existing rows: the new pattern accepts everything the old one did (it only adds characters), so no row can fail
-- the check. The pack check ('^[a-z0-9-]{1,30}$') already accepts 'early-facts'. Nothing is stored, and no function changes:
-- space_maths_context and the teacher views already read the 'early-facts' pack.
alter table public.gem_keep_facts drop constraint if exists gem_keep_facts_fact_key_check;
alter table public.gem_keep_facts add constraint gem_keep_facts_fact_key_check
  check (fact_key ~ '^[a-z][a-z0-9]{0,9}:[a-z0-9:+/=?-]{1,40}$');
