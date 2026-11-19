/**
 * Is Goblin Storm in the hub at all? On since 19 Nov 2026 (docs/GOBLINSTORM-PLAN.md, stage 7). `VITE_GOBLINSTORM_ON=true`
 * in .env.local shows it on your own computer. Even when on, the card hides until the teacher switches the game on.
 */
const GOBLINSTORM_ON = true;

export const goblinstormOn = (): boolean => GOBLINSTORM_ON || import.meta.env.VITE_GOBLINSTORM_ON === 'true';
