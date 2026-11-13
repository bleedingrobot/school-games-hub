/**
 * Is Order Up! in the hub at all? `VITE_ORDERUP_ON=true` in .env.local shows it on your own computer. It goes on with the
 * Activities page (src/activities/switch.ts) once levels 1 to 3 are live. Even when on, the card hides until the teacher
 * switch is on for the class (on by default for every class).
 */
const ORDERUP_ON = false;

export const orderupOn = (): boolean => ORDERUP_ON || import.meta.env.VITE_ORDERUP_ON === 'true';
