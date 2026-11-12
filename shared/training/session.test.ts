import { describe, expect, it } from 'vitest';
import { TRAINING_CONFIG } from './config';
import { FACTS } from './facts';
import { buildSession } from './session';
import { emptyState, recordAnswer, type TrainingState } from './records';

const TODAY = '2026-10-20';

/** A student who knows (bright green, two days) every fact on the given steps, times and division (or only times). */
function knows(steps: number[], base: TrainingState = emptyState(), timesOnly = false): TrainingState {
  let s = base;
  for (const f of FACTS) {
    if (!steps.includes(f.step) || (timesOnly && f.kind !== 'mul')) continue;
    s = recordAnswer(s, f.key, f.answer, f.answer, 1200, '2026-10-17').state;
    s = recordAnswer(s, f.key, f.answer, f.answer, 1200, '2026-10-18').state;
  }
  return s;
}

function midway(): TrainingState {
  let s = knows([1]);
  // Some step 2 facts started: a few slow, a few wrong.
  const step2 = FACTS.filter((f) => f.kind === 'mul' && f.step === 2).slice(0, 5);
  step2.forEach((f, i) => {
    s = recordAnswer(s, f.key, i % 2 ? f.answer + 1 : f.answer, f.answer, 6000, '2026-10-19').state;
  });
  return s;
}

describe('session builder', () => {

  it('has the configured number of questions, with correct answers', () => {
    const q = buildSession(midway(), TODAY, 7).questions;
    expect(q).toHaveLength(TRAINING_CONFIG.session.questions);
    expect(TRAINING_CONFIG.session.questions).toBeGreaterThanOrEqual(20);
    expect(TRAINING_CONFIG.session.questions).toBeLessThanOrEqual(30);
    for (const x of q) {
      const f = FACTS.find((f) => f.key === x.factKey)!;
      expect(x.answer).toBe(f.answer);
      expect(x.digits).toBe(String(f.answer).length);
    }
  });

});

