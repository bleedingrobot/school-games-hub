import { describe, expect, it } from 'vitest';
import { bandAt, bandIndexForMs, factBandIndex, middle, thinkingMs, typingMsFor, type Answer } from './speed';
import { dayString, daysBetween, emptyState, isKnown, recordAnswer, recordTyping } from './records';

const right = (thinkMs: number, day = '2026-10-19'): Answer => ({ correct: true, thinkMs, day });
const wrong = (day = '2026-10-19'): Answer => ({ correct: false, thinkMs: null, day });

describe('thinking time', () => {
  it('takes the right typing time off and never goes below zero', () => {
    expect(thinkingMs(2500, 1200)).toBe(1300);
    expect(thinkingMs(900, 1200)).toBe(0);
    expect(thinkingMs(0, 0)).toBe(0);
  });

  it('uses the typing time for the answer length', () => {
    const samples = { 1: [500, 600, 700], 2: [1000, 1200, 1100], 3: [] };
    expect(typingMsFor(1, samples)).toBe(600);
    expect(typingMsFor(2, samples)).toBe(1100);
    // No checks yet for 3 digits: use the default.
    expect(typingMsFor(3, samples)).toBe(1500);
  });

  it('uses the middle of the last several checks, so one slow check does not change it', () => {
    const samples = { 1: [500, 520, 480, 510, 9000] };
    expect(typingMsFor(1, samples)).toBe(510);
    expect(middle([3, 1, 2])).toBe(2);
    expect(middle([])).toBeNull();
  });

  it('subtracts the typing time in a recorded answer', () => {
    let s = recordTyping(emptyState(), 2, 1200);
    s = recordTyping(s, 2, 1200);
    const { answer } = recordAnswer(s, 'mul:6x7', 42, 42, 2500, '2026-10-19');
    expect(answer).toEqual({ correct: true, thinkMs: 1300, day: '2026-10-19' });
  });
});

describe('speed bands', () => {
  it('puts each edge in the right band', () => {
    const id = (ms: number) => bandAt(bandIndexForMs(ms)).id;
    expect(id(0)).toBe('bright');
    expect(id(1499)).toBe('bright');
    expect(id(1500)).toBe('light');
    expect(id(3499)).toBe('light');
    expect(id(3500)).toBe('yellow');
    expect(id(4999)).toBe('yellow');
    expect(id(5000)).toBe('orange');
    expect(id(7999)).toBe('orange');
    expect(id(8000)).toBe('blue');
    expect(id(9999)).toBe('blue');
    expect(id(10000)).toBe('grey');
    expect(id(60000)).toBe('grey');
  });

  it('has the agreed labels and no red anywhere', () => {
    const labels = [0, 1, 2, 3, 4, 5].map((i) => bandAt(i).label);
    expect(labels).toEqual(['Just know it!', 'Quick thinking', 'Getting there', 'Working it out', 'Still learning', 'New to me']);
    for (let i = 0; i < 6; i++) {
      const hex = bandAt(i).bg.slice(1);
      const [r, g, b] = [0, 2, 4].map((k) => parseInt(hex.slice(k, k + 2), 16));
      expect(r > 200 && g < 120 && b < 120).toBe(false);
    }
  });
});

describe("a fact's colour", () => {
  it('is the middle of the last 3 answers', () => {
    // 1 s, 1 s, 12 s -> middle is 1 s: still bright green.
    expect(factBandIndex([right(12000), right(1000), right(1000)])).toBe(0);
    // Only the last 3 count.
    expect(factBandIndex([right(12000), right(12000), right(1000), right(1000), right(2000)])).toBe(0);
    expect(factBandIndex([right(1000), right(4000), right(9000)])).toBe(2);
  });

  it('counts a wrong answer as New to me', () => {
    expect(factBandIndex([wrong()])).toBe(5);
    expect(factBandIndex([right(1000), right(1000), wrong()])).toBe(0);
    expect(factBandIndex([right(1000), wrong(), wrong()])).toBe(5);
  });

  it('uses the slower answer when there are only two, and nothing before any answer', () => {
    expect(factBandIndex([])).toBeNull();
    expect(factBandIndex([right(1000), right(4000)])).toBe(2);
    expect(factBandIndex([right(1000)])).toBe(0);
  });
});

describe('known needs bright green on two different days', () => {
  const fast = (s: ReturnType<typeof emptyState>, day: string) => recordAnswer(s, 'mul:6x7', 42, 42, 1300, day).state;

  it('one day is not enough, even with many fast answers', () => {
    let s = emptyState();
    for (let i = 0; i < 5; i++) s = fast(s, '2026-10-19');
    expect(s.records['mul:6x7'].greenDays).toEqual(['2026-10-19']);
    expect(isKnown(s.records['mul:6x7'])).toBe(false);
  });

  it('two different days makes it known', () => {
    let s = fast(emptyState(), '2026-10-19');
    s = fast(s, '2026-10-20');
    expect(isKnown(s.records['mul:6x7'])).toBe(true);
  });

  it('a light green day does not count, and a later slow day does not take known away', () => {
    let s = recordAnswer(emptyState(), 'mul:6x7', 42, 42, 3000, '2026-10-19').state; // light green
    s = fast(s, '2026-10-20');
    expect(isKnown(s.records['mul:6x7'])).toBe(false);
    s = fast(s, '2026-10-21');
    s = fast(s, '2026-10-22');
    expect(isKnown(s.records['mul:6x7'])).toBe(true);
    s = recordAnswer(s, 'mul:6x7', 40, 42, 3000, '2026-10-23').state;
    expect(isKnown(s.records['mul:6x7'])).toBe(true);
  });

  it('a wrong answer is recorded as wrong with no time', () => {
    const { answer, state } = recordAnswer(emptyState(), 'mul:6x7', 40, 42, 2000, '2026-10-19');
    expect(answer).toEqual({ correct: false, thinkMs: null, day: '2026-10-19' });
    expect(state.recent).toEqual([false]);
  });
});

describe('days', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-10-19', '2026-10-20')).toBe(1);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(dayString(new Date(2026, 9, 5))).toBe('2026-10-05');
  });
});
