/**
 * Is Marble Rush on the dashboard? On since James said go (20 Oct 2026, stage M.8). Setting this back to false hides
 * the dashboard card and the /marble page (VITE_MARBLE_ON=true in .env.local still shows it on your own computer).
 */
const MARBLE_ON = true;

export const marbleOn = (): boolean => MARBLE_ON || import.meta.env.VITE_MARBLE_ON === 'true';
