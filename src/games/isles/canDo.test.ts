import { describe, expect, it } from 'vitest';
import { newIsland, type Island } from '../../../shared/isles/engine';
import { upgradeChoice } from './canDo';

const island = (change: Partial<Island>): Island => ({ ...newIsland(), ...change });

describe('upgradeChoice: the "Upgrade a building" button', () => {
  it('lists the buildings that can be upgraded now (never the empty spot)', () => {
    // Level 2 costs 4 x the build price: Farm and House 100, Dock 120, Mine 140. With 120 coins, all but the Mine.
    const up = upgradeChoice(island({ coins: 120 }));
    expect(up.why).toBeNull();
    expect(up.spots).toEqual([0, 1, 3, 4]);
  });

  it('says why when there are not enough coins, with the numbers', () => {
    expect(upgradeChoice(island({ coins: 12 })).why).toBe('Not enough coins. Upgrading your Farm to level 2 needs 100 coins. You have 12.');
  });

  it('says why when there are not enough sky crystals', () => {
    const start = newIsland();
    const spots = start.spots.map((s) => (s.kind === 'empty' ? s : { ...s, level: 2 }));
    expect(upgradeChoice(island({ spots, coins: 9999, crystals: 2 })).why).toMatch(/^Not enough sky crystals\. .* needs 6 sky crystals\. You have 2\.$/);
  });

  it('says so when every building is at the top level, or there are none', () => {
    const start = newIsland();
    expect(upgradeChoice(island({ spots: start.spots.map((s) => (s.kind === 'empty' ? s : { ...s, level: 3 })) })).why).toMatch(/top level/);
    expect(upgradeChoice(island({ spots: start.spots.map(() => ({ kind: 'empty', level: 0 }) as Island['spots'][number]) })).why).toMatch(/^Build a building first/);
  });
});
