/**
 * Is Marble Rush on the dashboard? Off while it is being built (docs/MARBLE-PLAN.md): there is no
 * dashboard card and no /marble page. To try it on your own computer without changing this file,
 * put VITE_MARBLE_ON=true in .env.local. Going live is James's yes (stage M.8).
 */
const MARBLE_ON = false;

export const marbleOn = (): boolean => MARBLE_ON || import.meta.env.VITE_MARBLE_ON === 'true';
