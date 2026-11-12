
/**
 * Is Sky Isles in the hub? On since 4 Nov 2026 (James's yes, stage S.8). Each class still has its own teacher switch,
 * off until the teacher turns it on. Set back to false to take the card out of the build again.
 */
const ON = true;

export const islesOn = (): boolean => ON || import.meta.env.VITE_ISLES_ON === 'true';
