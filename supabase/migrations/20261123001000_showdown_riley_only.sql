-- Class Showdown stage 4 (docs/SHOWDOWN-PLAN.md): on for James's class (Riley) only while it's tried with a real class.
-- Every other class's own settings row, and the school defaults, are switched off. Stage 5 turns it on for every class.
-- Not destructive: it only changes an on/off setting, which teachers can change back on their Games tab.
-- Riley gets its own row first (a copy of the school's defaults) if it has none, so switching the defaults off leaves it on.
select public.give_class_settings(c.id) from public.classes c where c.id = '0de592f6-ec7b-47a2-96b4-6141f6b83cdf';
update public.app_settings set showdown_enabled = (class_id is not distinct from '0de592f6-ec7b-47a2-96b4-6141f6b83cdf'::uuid);
