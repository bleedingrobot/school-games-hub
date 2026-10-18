/** Sample records for the preview's "fill the map" button, so every colour and the review glow can be seen. */
import { BANDS } from './config';
import { FACTS } from './facts';
import { emptyState, recordAnswer, type TrainingState } from './records';

/** Middle of each band's thinking-time range, in ms. */
const MID_MS = [900, 2500, 4200, 6500, 9000, 14000];

export function sampleState(today: string, daysAgo: (n: number) => string): TrainingState {
  let s = emptyState();
  s = { ...s, typing: { 1: [600, 650, 620], 2: [1000, 1050, 980], 3: [1400, 1450, 1380] } };
  FACTS.forEach((f, i) => {
    const band = (f.step * 2 + (i % 4) + Math.floor(i / 7)) % BANDS.length;
    const ms = MID_MS[band] + 650; // plus typing time so thinking time lands mid-band
    const days = band === 0 ? [daysAgo(9), daysAgo(8)] : [i % 5 === 0 ? daysAgo(12) : today];
    for (const day of days) s = recordAnswer(s, f.key, f.answer, f.answer, ms, day).state;
    // A few wrong answers on the slowest facts.
    if (band === 5 && i % 3 === 0) s = recordAnswer(s, f.key, f.answer + 1, f.answer, ms, today).state;
  });
  return s;
}
