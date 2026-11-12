
/**
 * Is Robin’s Berry Basket in the hub at all? `VITE_ROBIN_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const ROBIN_ON = true;

export const robinOn = (): boolean => ROBIN_ON || import.meta.env.VITE_ROBIN_ON === 'true';
