
/**
 * Is Weka’s Stepping Stones in the hub at all? `VITE_WEKA_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const WEKA_ON = true;

export const wekaOn = (): boolean => WEKA_ON || import.meta.env.VITE_WEKA_ON === 'true';
