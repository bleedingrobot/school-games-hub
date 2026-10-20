/**
 * Is Mine Runner on the dashboard? Off: the game is not in the build at all (docs/MINE-PLAN.md, section 8).
 * `VITE_MINE_ON=true` in .env.local shows it on your own computer only.
 */
const ON = false;

export const mineOn = (): boolean => ON || import.meta.env.VITE_MINE_ON === 'true';
