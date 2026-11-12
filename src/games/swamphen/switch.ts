
/**
 * Is Swamp Hen’s Reed Rows in the hub at all? `VITE_SWAMPHEN_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const SWAMPHEN_ON = true;

export const swamphenOn = (): boolean => SWAMPHEN_ON || import.meta.env.VITE_SWAMPHEN_ON === 'true';
