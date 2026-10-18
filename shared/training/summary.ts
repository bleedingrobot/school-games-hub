/** End-of-session summary: which facts changed colour. Never anything about getting slower. */
import { recordBand, type FactRecord } from './records';
import type { BandIndex } from './speed';

export interface ColourChange {
  factKey: string;
  from: BandIndex | null;
  to: BandIndex;
}

export interface SessionSummary {
  practised: number;
  /** Facts that reached bright green in this session. */
  turnedGreen: ColourChange[];
  /** Facts that moved to a quicker colour (including to green) or got their first colour. */
  improved: ColourChange[];
}

export function summarise(before: Record<string, FactRecord>, after: Record<string, FactRecord>, practisedKeys: readonly string[]): SessionSummary {
  const keys = [...new Set(practisedKeys)];
  const improved: ColourChange[] = [];
  const turnedGreen: ColourChange[] = [];
  for (const factKey of keys) {
    const from = recordBand(before[factKey]);
    const to = recordBand(after[factKey]);
    if (to === null) continue;
    // Getting a first colour only counts if it isn't "New to me": a first wrong answer isn't news.
    const better = from === null ? to < 5 : to < from;
    if (better) improved.push({ factKey, from, to });
    if (to === 0 && from !== 0) turnedGreen.push({ factKey, from, to });
  }
  return { practised: keys.length, turnedGreen, improved };
}

/** One kind sentence about the session. */
export function summaryMessage(s: SessionSummary): string {
  const g = s.turnedGreen.length;
  if (g > 0) return g === 1 ? '1 fact turned green!' : `${g} facts turned green!`;
  const n = s.improved.length;
  if (n > 0) return n === 1 ? '1 fact moved up a colour!' : `${n} facts moved up a colour!`;
  return 'Every time you practise, your facts get stronger.';
}
