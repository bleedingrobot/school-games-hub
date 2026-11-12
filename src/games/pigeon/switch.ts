
/**
 * Is Pigeon’s Number Line in the hub at all? `VITE_PIGEON_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const PIGEON_ON = true;

export const pigeonOn = (): boolean => PIGEON_ON || import.meta.env.VITE_PIGEON_ON === 'true';
