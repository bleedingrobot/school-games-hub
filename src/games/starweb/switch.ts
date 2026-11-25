/**
 * Is Star Web solo in the hub at all? (docs/STARWEB-PLAN.md) `VITE_STARWEB_ON=true` in .env.local shows it on your own
 * computer. Even when on, the card hides until the teacher has the game on for the class (on for every class to start).
 */
const STARWEB_ON = false;

export const starwebOn = (): boolean => STARWEB_ON || import.meta.env.VITE_STARWEB_ON === 'true';
