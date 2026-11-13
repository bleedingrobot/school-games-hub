/**
 * Is Glyph Gates in the hub at all? Off until the game is checked and finished (docs/GLYPH-PLAN.md). `VITE_GLYPH_ON=true`
 * in .env.local shows it on your own computer. Even when on, the card hides until the teacher has the game on for the class.
 */
const GLYPH_ON = false;

export const glyphOn = (): boolean => GLYPH_ON || import.meta.env.VITE_GLYPH_ON === 'true';
