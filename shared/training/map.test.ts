import { describe, expect, it } from 'vitest';
import { buildMap, familyLines } from './map';
import { emptyState, recordAnswer } from './records';

const TODAY = '2026-10-20';

describe('facts map', () => {
  it('is 12 x 12 and starts untried', () => {
    const map = buildMap(emptyState(), TODAY);
    expect(map).toHaveLength(12);
    expect(map.every((row) => row.length === 12)).toBe(true);
    expect(map[5][6].timesBand).toBeNull();
    expect(map[5][6].divisionBand).toBeNull();
  });

  it('colours 6 x 7 and 7 x 6 together', () => {
    const s = recordAnswer(emptyState(), 'mul:6x7', 42, 42, 1300, TODAY).state;
    const map = buildMap(s, TODAY);
    expect(map[5][6].timesBand).toBe(0);
    expect(map[6][5].timesBand).toBe(0);
    expect(map[5][6]).toBe(map[6][5]);
    expect(map[5][5].timesBand).toBeNull();
  });

  it('shows division on the same squares, slowest of the two division facts', () => {
    let s = recordAnswer(emptyState(), 'div:42/6', 7, 7, 1300, TODAY).state;
    s = recordAnswer(s, 'div:42/7', 6, 6, 5000, TODAY).state; // yellow
    const cell = buildMap(s, TODAY)[6][5];
    expect(cell.timesBand).toBeNull();
    expect(cell.divisionBand).toBe(2);
    expect(buildMap(s, TODAY)[5][6].divisionBand).toBe(2);
  });

  it('due facts glow but keep their colour', () => {
    const s = recordAnswer(emptyState(), 'mul:6x7', 42, 42, 1300, '2026-10-10').state;
    const cell = buildMap(s, TODAY)[5][6];
    expect(cell.due).toBe(true);
    expect(cell.timesBand).toBe(0);
    expect(buildMap(s, '2026-10-10')[5][6].due).toBe(false);
  });

  it('lists the whole family when a square is tapped', () => {
    const s = recordAnswer(emptyState(), 'mul:6x7', 42, 42, 1300, TODAY).state;
    const lines = familyLines('fam:6x7', s, TODAY).map((l) => l.text);
    expect(lines).toEqual(['6 × 7 = 42', '7 × 6 = 42', '42 ÷ 6 = 7', '42 ÷ 7 = 6']);
    expect(familyLines('fam:8x8', s, TODAY).map((l) => l.text)).toEqual(['8 × 8 = 64', '64 ÷ 8 = 8']);
  });
});
