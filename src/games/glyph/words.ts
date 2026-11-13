/** Glyph Gates' words: the next-step line and the "why" lines for each named mistake (docs/GLYPH-PLAN.md, mistakes table). */
import { arrowsBetween, fracText, type Frac } from '../../../shared/glyph/fractions';
import type { Judged } from '../../../shared/glyph/play';
import type { PublicWall } from '../../../shared/glyph/walls';
import type { TrapKind } from '../../../shared/glyph/config';

export type Phase = 'tiles' | 'glyphs' | 'open';

/** The words a screen reader says for a fraction: "five sixths", or "20 over 24" for the big ones. */
const NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const PARTS = ['', '', 'half', 'third', 'quarter', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
export function spokenFrac({ n, d }: Frac): string {
  if (d > 12 || n > 12) return `${n} over ${d}`;
  if (d === 2) return n === 1 ? 'one half' : `${NAMES[n]} halves`;
  return `${NAMES[n]} ${PARTS[d]}${n === 1 ? '' : 's'}`;
}

/** The one-sentence next step under the grid: one action, real numbers. */
export function nextStep(gold: Frac, litCount: number, phase: Phase): string {
  if (phase === 'open') return 'The wall is opening!';
  if (phase === 'glyphs') return PICK_GLYPH;
  if (litCount === 0) return `Find the tiles equal to ${fracText(gold)}. You've lit 0.`;
  return `Find the tiles equal to ${fracText(gold)}. You've lit ${litCount}. Press Light the runes when you're done.`;
}

export const WALL_ASK = 'Find the tiles equal to the gold stone';
export const PICK_GLYPH = 'Pick the glyph that matches your green tiles.';
export const NO_MATCH = 'None of the glyphs match your tiles. Look again.';
export const PRESS_LIGHT = 'Press Light the runes.';
/** The results, said and shown the same way. */
export const RESULT_PASSED = 'Temple passed!';
export const RESULT_CLOSE = 'So close. Try again to pass the temple.';
export const LOOK_CLOSELY = "Look closely: that glyph doesn't match your green tiles.";
export const LOOK_CLOSELY_NONE = 'Look closely: one of the glyphs does match your green tiles.';

/**
 * What Bella says for each mistake: the same idea as the shown line, in fixed words (no tile fractions or counts, which change
 * every wall). The shown line starts with these words for the kinds that need no number.
 */
export const WHY_VOICE: Record<TrapKind | 'missed', string> = {
  'add-same': 'Adding the same number to the top and bottom changes the size. Times both by the same number.',
  'top-only': 'Only the top was multiplied, so there are more pieces but they are the same size.',
  'bottom-only': 'Only the bottom was multiplied, so each piece got smaller but you still have the same number of pieces.',
  'same-bottom': 'The pieces are the same size, but you have a different number of them.',
  'same-top': 'Same number of pieces, but the pieces are a different size.',
  'near-miss': 'The top and bottom need the same number of times.',
  'diff-mult': 'The top and bottom were not changed by the same number. Both need the same.',
  missed: 'That tile is worth the same as the gold stone. Times or divide both top and bottom by the same number.',
};

/** The guided first wall's lines, one lit thing at a time (step 0 the stone, 1 tap tiles, 2 press, 3 pick the glyph). */
export function guideLine(step: number, gold: Frac, wrong?: Frac, next?: Frac): string {
  if (step === 0) return `This is the gold stone: ${fracText(gold)}. The tiles to light are the ones worth the same.`;
  if (step === 1) return wrong ? `${fracText(wrong)} is not worth ${fracText(gold)}. Tap it again to put it out.` : `Tap a tile worth ${fracText(gold)}. Try ${next ? fracText(next) : 'one'}.`;
  return step === 2 ? 'Now press Light the runes.' : PICK_GLYPH;
}

export interface Why {
  line: string;
  /** The wrong tile (or the missed one) the picture is about. */
  cell: number;
  kind: TrapKind | 'missed';
}

/** Words for the first thing that was wrong with a go. */
export function whyOf(wall: PublicWall, judged: Judged): Why | null {
  const g = wall.gold;
  if (judged.wrong.length) {
    const cell = judged.wrong[0];
    const t = wall.tiles[cell];
    const kind = judged.mistakes[0] as TrapKind;
    const lines: Record<TrapKind, string> = {
      'add-same': `${WHY_VOICE['add-same']} ${fracText(t)} is not ${fracText(g)}.`,
      'top-only': `${WHY_VOICE['top-only']} ${fracText(t)} is bigger than ${fracText(g)}.`,
      'bottom-only': `Only the bottom was multiplied, so each piece got smaller but you still have ${t.n}. ${fracText(t)} is smaller than ${fracText(g)}.`,
      'same-bottom': `Same pieces, but ${t.n} of them, not ${g.n}. ${fracText(t)} is not ${fracText(g)}.`,
      'same-top': `${WHY_VOICE['same-top']} ${fracText(t)} is not ${fracText(g)}.`,
      'near-miss': nearMiss(g, t),
      'diff-mult': diffMult(g, t),
    };
    return { line: lines[kind], cell, kind };
  }
  if (judged.missed.length) {
    const cell = judged.missed[0];
    const t = wall.tiles[cell];
    const a = arrowsBetween(g, t);
    const how = a.way === 'times' ? `${g.n} × ${a.top} over ${g.d} × ${a.bottom}` : `${g.n} ÷ ${a.top} over ${g.d} ÷ ${a.bottom}`;
    return { line: `${fracText(t)} is ${how}, so it's worth ${fracText(g)} too.`, cell, kind: 'missed' };
  }
  return null;
}

function nearMiss(g: Frac, t: Frac): string {
  const a = arrowsBetween(g, t);
  if (a.top !== null && a.bottom === null) return `${g.n} × ${a.top} = ${t.n}, but ${g.d} × ${a.top} = ${g.d * a.top}, not ${t.d}.`;
  if (a.bottom !== null && a.top === null) return `${g.d} × ${a.bottom} = ${t.d}, but ${g.n} × ${a.bottom} = ${g.n * a.bottom}, not ${t.n}.`;
  return `The top and bottom need the same number of times. ${fracText(t)} is close, but not the same as ${fracText(g)}.`;
}

function diffMult(g: Frac, t: Frac): string {
  const a = arrowsBetween(g, t);
  const sign = a.way === 'times' ? 'times' : 'divided by';
  return `The top was ${sign} ${a.top} but the bottom ${sign} ${a.bottom}. Both need the same.`;
}

/** The sums the ×-arrows show between the gold stone and a tile. */
export function arrowWords(gold: Frac, tile: Frac): string {
  const a = arrowsBetween(gold, tile);
  const op = a.way === 'times' ? '×' : '÷';
  const part = (from: number, k: number | null, to: number) => (k === null ? `no whole number takes ${from} to ${to}` : `${from} ${op} ${k} = ${to}`);
  return `${part(gold.n, a.top, tile.n)}, ${part(gold.d, a.bottom, tile.d)}`;
}
