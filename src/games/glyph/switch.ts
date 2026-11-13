/**
 * Is Glyph Gates in the hub at all? On since 14 Nov 2026 (docs/GLYPH-PLAN.md). `VITE_GLYPH_ON=true`
 * in .env.local shows it on your own computer. Even when on, the card hides until the teacher has the game on for the class.
 */
const GLYPH_ON = true;

export const glyphOn = (): boolean => GLYPH_ON || import.meta.env.VITE_GLYPH_ON === 'true';
