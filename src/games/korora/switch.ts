
/**
 * Is Penguin Pairs in the hub at all? `VITE_KORORA_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const KORORA_ON = true;

export const kororaOn = (): boolean => KORORA_ON || import.meta.env.VITE_KORORA_ON === 'true';
