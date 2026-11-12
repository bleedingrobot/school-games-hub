
/**
 * Is Mine Runner on the dashboard? Off: the game is not in the build at all (docs/MINE-PLAN.md, section 8). Going live
 * turns this on, only with James's word. `VITE_MINE_ON=true` in .env.local shows it on your own computer only.
 * Even when this is on, the card hides itself while the teacher's switch (the Mine Runner panel on the teacher page) is
 * off for the pupil's class, and the database starts with that switch off everywhere.
 */
const ON = true;

export const mineOn = (): boolean => ON || import.meta.env.VITE_MINE_ON === 'true';
