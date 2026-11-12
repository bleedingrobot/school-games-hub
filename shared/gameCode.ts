// Game codes, in their own file so pages that only read a code don't bring the chess and checkers rules (dashboard plan D7).

/** Game codes use these: no vowels (so no rude words) and no lookalikes like O/0 or I/1. */
export const CODE_ALPHABET = 'CDFGHJKMNPQRTVWXY34679';
export const CODE_LENGTH = 5;

/** Tidies up what a student typed: any case, spaces or dashes are fine. Null if it can't be a code. */
export function normaliseCode(typed: unknown): string | null {
  if (typeof typed !== 'string' || typed.length > 20) return null;
  const code = typed.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== CODE_LENGTH || [...code].some((c) => !CODE_ALPHABET.includes(c))) return null;
  return code;
}
