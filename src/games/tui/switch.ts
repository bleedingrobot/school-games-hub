
/**
 * Is Tūī’s Ten Tree in the hub at all? `VITE_TUI_ON=true` in .env.local shows it on your own computer. Even when on, the
 * card hides until the teacher switches the game on for the class (on by default for every class).
 */
const TUI_ON = true;

export const tuiOn = (): boolean => TUI_ON || import.meta.env.VITE_TUI_ON === 'true';
