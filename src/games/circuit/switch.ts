/**
 * Is Circuit Racer in the hub at all? ON since Stage 6 (23 Nov 2026, docs/CIRCUIT-PLAN.md).
 * `VITE_CIRCUIT_ON=true` in .env.local shows it on your own computer. Even when on, the card hides until the teacher
 * switches the game on for the class (on for every class by default).
 */
const CIRCUIT_ON = true;

export const circuitOn = (): boolean => CIRCUIT_ON || import.meta.env.VITE_CIRCUIT_ON === 'true';
