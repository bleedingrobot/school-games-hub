/**
 * Is Goblin Storm in the hub at all? Off until it goes live (docs/GOBLINSTORM-PLAN.md, stage 7). `VITE_GOBLINSTORM_ON=true`
 * in .env.local shows it on your own computer. Even when on, the card hides until the teacher switches the game on.
 */
const GOBLINSTORM_ON = false;

export const goblinstormOn = (): boolean => GOBLINSTORM_ON || import.meta.env.VITE_GOBLINSTORM_ON === 'true';
