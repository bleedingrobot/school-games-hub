import { beforeEach, describe, expect, it } from 'vitest';
import { discover, factFor, loadStarChart } from './starChart';

beforeEach(() => localStorage.clear());

describe('the Star chart', () => {
  it('finds facts only for your own rocket', () => {
    expect(factFor({ kind: 'star', seat: 1, square: 9, star: 'pulsar' }, 1)).toBe('pulsar');
    expect(factFor({ kind: 'star', seat: 2, square: 9, star: 'pulsar' }, 1)).toBeNull();
    expect(factFor({ kind: 'star', seat: 1, square: 9, star: 'pulsar' }, null)).toBeNull();
    expect(factFor({ kind: 'force-field', seat: 0, square: 40 }, 0)).toBe('black-hole');
    expect(factFor({ kind: 'gravity', seat: 0, gravity: 'low', source: 'square' }, 0)).toBe('low-gravity');
    // The neutron star shows its own fact, not heavy gravity's as well.
    expect(factFor({ kind: 'gravity', seat: 0, gravity: 'heavy', source: 'neutron-star' }, 0)).toBeNull();
    expect(factFor({ kind: 'docked', seat: 3 }, 3)).toBe('space-station');
    // Everyone sees a supernova burn out.
    expect(factFor({ kind: 'supernova-spent', square: 50 }, null)).toBe('nebula');
    expect(factFor({ kind: 'dice', seat: 0, dice: [4] }, 0)).toBeNull();
  });

  it('remembers what you found, once each', () => {
    expect(discover('comet')).toBe(true);
    expect(discover('comet')).toBe(false);
    expect(discover('matariki')).toBe(true);
    expect([...loadStarChart()].sort()).toEqual(['comet', 'matariki']);
  });

  it('ignores anything odd in storage', () => {
    localStorage.setItem('sgh-space-star-chart', JSON.stringify(['comet', 'not-a-fact', 7]));
    expect([...loadStarChart()]).toEqual(['comet']);
    localStorage.setItem('sgh-space-star-chart', '{oops');
    expect(loadStarChart().size).toBe(0);
  });
});
