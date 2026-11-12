
/**
 * Is Kingdom Keeper in the hub? On since 27 Oct 2026 (James: "you do it all and switch it on"), after the migration and
 * the `kingdom` function went live (docs/KINGDOM-PLAN.md). The card still hides itself until the teacher switches the
 * game on for the pupil's class (the database started with it off everywhere). Off since 6 Nov 2026:
 * replaced by Royal Decree (docs/DECREE-PLAN.md). Its tables and pupils' reigns are kept, and teachers still see its row.
 */
const ON = false;

export const kingdomOn = (): boolean => ON || import.meta.env.VITE_KINGDOM_ON === 'true';
