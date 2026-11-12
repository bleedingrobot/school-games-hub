
/**
 * Is Royal Decree in the hub? On since 6 Nov 2026 (James: "Go live now"), replacing Kingdom Keeper. Once
 * it is in the build, the card hides itself until the pupil's class has the game switched on (the database starts with it
 * on everywhere). Set VITE_DECREE_ON=true in .env.local to try it on your own computer.
 */
const ON = true;

export const decreeOn = (): boolean => ON || import.meta.env.VITE_DECREE_ON === 'true';
