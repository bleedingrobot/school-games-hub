
/**
 * Is Lizard’s Bundles in the hub at all? `VITE_LIZARD_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const LIZARD_ON = true;

export const lizardOn = (): boolean => LIZARD_ON || import.meta.env.VITE_LIZARD_ON === 'true';
