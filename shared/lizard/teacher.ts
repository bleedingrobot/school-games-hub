/**
 * What a teacher sees of a child's slips (docs/LIZARD-PLAN.md): from the last few challenges' first wrong tries, the slip
 * most often made (digits turned round, face value, a zero in the wrong place, ten more changing the ones). Worked out in the
 * browser from the rounds and taps the teacher function returns.
 */
import { SLIP_MIN, TEACHER_TAPS } from './config';
import { replay, type Tap } from './play';
import type { Round, Slip } from './round';

export const SLIP_WORDS: Record<Slip, string> = {
  reverse: 'puts the digits the wrong way round (74 for 47)',
  face: 'adds the digits instead of reading them as tens and ones (11 for 47)',
  zero: 'writes a zero for the empty place, or too many zeros (407 for 47, 3006 for 306)',
  ignore: 'leaves out the empty place (3 for 30, 36 for 306)',
  ones: 'changes the ones when the tens should change (48 for ten more than 47)',
  way: 'goes the wrong way for more or less',
  join: 'joins the numbers side by side (147 for ten more than 47)',
  near: 'is close but not the number',
};

export interface SlipSummary {
  /** First wrong tries counted (the latest `TEACHER_TAPS`). */
  wrong: number;
  /** The slip made most often (at least `SLIP_MIN` times), or null. */
  top: Slip | null;
  /** How many times. */
  count: number;
}

export function slipSummary(recent: readonly { round: Round; taps: readonly Tap[] }[]): SlipSummary {
  const slips = recent.flatMap((r) => {
    try {
      return replay(r.round, r.taps).slips;
    } catch {
      return [];
    }
  }).slice(0, TEACHER_TAPS);
  const counts = new Map<Slip, number>();
  for (const s of slips) if (s.slip !== 'other') counts.set(s.slip, (counts.get(s.slip) ?? 0) + 1);
  const [top, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  return { wrong: slips.length, top: count >= SLIP_MIN ? top : null, count };
}
