/**
 * Is Archery Challenge in the hub? Off: the game isn't in the build at all (docs/ARCHERY-PLAN.md, section 7).
 * Going live turns this on, only with James's word. `VITE_ARCHERY_ON=true` in .env.local shows it on your
 * own computer only.
 */
const ON = false;

export const archeryOn = (): boolean => ON || import.meta.env.VITE_ARCHERY_ON === 'true';
