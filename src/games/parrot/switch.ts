
/**
 * Is Parrot’s See-saw in the hub at all? `VITE_PARROT_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const PARROT_ON = true;

export const parrotOn = (): boolean => PARROT_ON || import.meta.env.VITE_PARROT_ON === 'true';
