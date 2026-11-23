/**
 * Class Live's painted pictures (docs/CLASSLIVE-ART-PLAN.md), found by file name. A picture not painted yet gives null,
 * and the drawn stand-in shows instead.
 */
const ART = import.meta.glob('./art/paint/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>;

/** `painted('mural', 'whale')` or `painted('back', 'star-sky', true)` (the 800 px copy). */
export function painted(folder: string, file: string, small = false): string | null {
  return ART[`./art/paint/${folder}/${file}${small ? '-800' : ''}.webp`] ?? ART[`./art/paint/${folder}/${file}.webp`] ?? null;
}
