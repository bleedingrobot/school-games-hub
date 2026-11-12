
/**
 * Is Toon Flap in the hub at all? On since 11 Nov 2026 (James). `VITE_TOONFLAP_ON=true` in .env.local shows it on your
 * own computer. Even when on, the card hides until the teacher switches the game on for the class (on for every class to start).
 */
const TOONFLAP_ON = true;

export const toonflapOn = (): boolean => TOONFLAP_ON || import.meta.env.VITE_TOONFLAP_ON === 'true';
