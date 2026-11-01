/**
 * Is Diamond Drop in the hub at all? OFF while it is being built (docs/DIAMOND-PLAN.md, stages 2 to 7). It is not in
 * src/games/registry.ts yet either: that is a merge-step change. `VITE_DIAMOND_ON=true` in .env.local shows it on your
 * own computer while this is false.
 */
const ON = false;

export const diamondOn = (): boolean => ON || import.meta.env.VITE_DIAMOND_ON === 'true';
