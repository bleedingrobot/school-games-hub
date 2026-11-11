/**
 * What a teacher sees of a child's slips (docs/LIZARD-PLAN.md): from the last few challenges' first wrong tries, the slip
 * most often made (digits turned round, face value, a zero in the wrong place, ten more changing the ones). Worked out in the
 * browser from the rounds and taps the teacher function returns.
 */
import { SLIP_SHOW_MIN, topSlip } from '../kit/slips';
import { TEACHER_TAPS } from './config';
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
  /** The slip made most often (at least `SLIP_SHOW_MIN` times and alone at the top), or null. */
  top: Slip | null;
  /** How many times. */
  count: number;
}

/** The usual slip for the page: the one the server saved (last 10 rounds) when there is one, else worked out from the last 3 rounds. */
export function usualSlip(saved: string | null | undefined, recent: readonly { round: Round; taps: readonly Tap[] }[]): SlipSummary & { fromServer: boolean } {
  if (saved && Object.hasOwn(SLIP_WORDS, saved)) return { wrong: 0, top: saved as Slip, count: 0, fromServer: true };
  return { ...slipSummary(recent), fromServer: false };
}

export function slipSummary(recent: readonly { round: Round; taps: readonly Tap[] }[]): SlipSummary {
  const slips = recent.flatMap((r) => {
    try {
      return replay(r.round, r.taps).slips;
    } catch {
      return [];
    }
  }).slice(0, TEACHER_TAPS);
  const named = slips.flatMap((s) => (s.slip === 'other' ? [] : [s.slip]));
  const top = topSlip(named, SLIP_SHOW_MIN);
  return { wrong: slips.length, top, count: top ? named.filter((s) => s === top).length : 0 };
}
