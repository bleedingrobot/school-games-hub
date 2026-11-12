import { describe, expect, it } from 'vitest';
import { MONSTERS } from './data';
import { applyForestResult, newHero, startFight, stepFight } from './engine';
import type { Hero } from './types';

const hero = (patch: Partial<Hero> = {}): Hero => ({ ...newHero('knight', '2026-10-19'), ...patch });

describe('fights', () => {
  it('lose softly: carried gold is gone, banked gold and exp stay, you wake up with some HP', () => {
    const h = hero({ hp: 1, gold: 100, bank: 50 });
    const f = startFight(h, MONSTERS[11][4], 2);
    f.heroDefence = 0;
    let g = f;
    while (!g.over) g = stepFight(g, { type: 'attack' });
    expect(g.outcome).toBe('lost');
    const after = applyForestResult(h, g);
    expect(after).toMatchObject({ gold: 0, bank: 50 });
    expect(after.hp).toBe(Math.ceil(h.maxHp * 0.3));
  });
});
