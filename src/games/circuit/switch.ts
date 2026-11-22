/**
 * Is Circuit Racer in the hub at all? OFF while it is built (docs/CIRCUIT-PLAN.md: switched on in Stage 6).
 * `VITE_CIRCUIT_ON=true` in .env.local shows it on your own computer. Even when on, the card hides until the teacher
 * switches the game on for the class (on for every class by default).
 */
const CIRCUIT_ON = false;

export const circuitOn = (): boolean => CIRCUIT_ON || import.meta.env.VITE_CIRCUIT_ON === 'true';
