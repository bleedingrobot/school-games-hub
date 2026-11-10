/**
 * What a teacher sees of a child's rows (docs/SWAMPHEN-PLAN.md, "What is recorded for teachers"): from the last few challenges'
 * first taps, the slip the child makes most (added the numbers, mixed up rows and columns, one row short...). Worked out in the
 * browser from the rounds and taps the teacher function returns.
 */
import { SLIP_SHOW_MIN, topSlip } from '../kit/slips';
import { TEACHER_ROUNDS } from './config';
import { replay, type Tap } from './play';
import type { Round, Slip } from './round';

export const SLIP_WORDS: Record<Slip, string> = {
  added: 'added the numbers instead of multiplying',
  joined: 'joined the two numbers side by side',
  short: 'left a row off',
  spare: 'counted a row too many',
  forgot: 'forgot the extra row',
  minus: 'took the rows away',
  rows: 'gave the number of rows',
  turned: 'mixed up rows and columns',
  unturned: 'forgot to turn it round',
  scatter: 'picked shoots not in rows',
  near: 'was close but off',
};

export interface SlipSummary {
  /** Wrong first taps counted (the latest `TEACHER_ROUNDS` challenges). */
  wrong: number;
  /** The slip made most often, when it shows at least `SLIP_SHOW_MIN` times and alone at the top, else null. */
  most: Slip | null;
  counts: Partial<Record<Slip, number>>;
}

export function slipSummary(recent: readonly { round: Round; taps: readonly Tap[] }[]): SlipSummary {
  const counts: Partial<Record<Slip, number>> = {};
  let wrong = 0;
  for (const r of recent.slice(0, TEACHER_ROUNDS)) {
    try {
      for (const s of replay(r.round, r.taps).slips) {
        counts[s] = (counts[s] ?? 0) + 1;
        wrong++;
      }
    } catch {
      // A round that can't be read is left out.
    }
  }
  const named = (Object.entries(counts) as [Slip, number][]).flatMap(([s, n]) => (s === 'near' ? [] : Array<Slip>(n).fill(s)));
  return { wrong, most: topSlip(named, SLIP_SHOW_MIN), counts };
}
