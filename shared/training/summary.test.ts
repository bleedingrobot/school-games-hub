import { describe, expect, it } from 'vitest';
import { emptyState, recordAnswer } from './records';
import { summarise, summaryMessage } from './summary';

describe('end-of-session summary', () => {
  it('counts facts practised and facts that turned green', () => {
    let before = emptyState();
    before = recordAnswer(before, 'mul:2x3', 6, 6, 6000, '2026-10-19').state; // orange
    let after = recordAnswer(before, 'mul:2x3', 6, 6, 1000, '2026-10-20').state;
    after = recordAnswer(after, 'mul:2x3', 6, 6, 1000, '2026-10-20').state; // middle of last 3 is now bright
    after = recordAnswer(after, 'mul:2x4', 8, 8, 1000, '2026-10-20').state; // new, bright
    after = recordAnswer(after, 'mul:2x5', 3, 10, 1000, '2026-10-20').state; // wrong: not news
    const s = summarise(before.records, after.records, ['mul:2x3', 'mul:2x3', 'mul:2x4', 'mul:2x5']);
    expect(s.practised).toBe(3);
    expect(s.turnedGreen.map((c) => c.factKey).sort()).toEqual(['mul:2x3', 'mul:2x4']);
    expect(summaryMessage(s)).toBe('2 facts turned green!');
  });

  it('is always kind', () => {
    const empty = { practised: 5, turnedGreen: [], improved: [] };
    expect(summaryMessage(empty)).not.toMatch(/slow|worse|red/i);
    expect(summaryMessage({ ...empty, turnedGreen: [{ factKey: 'a', from: 1, to: 0 }] })).toBe('1 fact turned green!');
  });
});
