
/**
 * Is Hop's Glow-worm Pond in the hub at all? On since 4 Nov 2026 (docs/HOP-PLAN.md, Stage 5).
 * `VITE_HOP_ON=true` in .env.local shows it on your own computer. Even when on, the card hides until the teacher
 * switches the game on for the class.
 */
const HOP_ON = true;

export const hopOn = (): boolean => HOP_ON || import.meta.env.VITE_HOP_ON === 'true';
