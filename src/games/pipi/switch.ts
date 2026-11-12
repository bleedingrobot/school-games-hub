
/**
 * Is Pipi's Hidden Shells in the hub at all? On since 4 Nov 2026 (docs/PIPI-PLAN.md).
 * `VITE_PIPI_ON=true` in .env.local shows it on your own computer. Even when on, the card hides until the teacher
 * switches the game on for the class.
 */
const PIPI_ON = true;

export const pipiOn = (): boolean => PIPI_ON || import.meta.env.VITE_PIPI_ON === 'true';
