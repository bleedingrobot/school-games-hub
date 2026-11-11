import { describe, expect, it } from 'vitest';
import { startFight } from './fight';
import { makeGalaxy } from './galaxy';
import { DEFAULT_SETTINGS, applyFight, newGame, type Game, type Mark, type Reply } from './server';

const galaxy = makeGalaxy('server-test');
const noMark: Mark = () => null;
/** Marks every answer right (or wrong) and says which slots were used. */
const marker = (right: boolean, used: number[] = []): Mark => (slot) => {
  if (used.includes(slot)) return null;
  used.push(slot);
  return { right, answer: 42 };
};
const ok = (r: Reply) => {
  if (!r.ok) throw new Error(r.reason);
  return r;
};


describe('the server applying moves', () => {

  it('plays a fight round by round on the server, marks the laser question, and settles the fight', () => {
    const g0 = newGame(galaxy, 1, DEFAULT_SETTINGS);
    const t = { ...g0.t, ship: 3, hull: 100, weapons: [2, 2], shields: [1] };
    let g: Game = { ...g0, t, pending: { kind: 'fight', tier: 0, fight: startFight(t, 0, 'f') } };
    const used: number[] = [];
    let last: Reply | null = null;
    for (let i = 0; i < 8 && g.pending; i++) {
      last = applyFight(g, 'charge', { slot: g.asked, value: 42, ms: 2000 }, DEFAULT_SETTINGS, marker(true, used));
      g = ok(last).game;
    }
    expect(g.pending).toBeNull();
    expect(last && last.ok && last.fight?.over).toBe(true);
    expect(g.stats.piratesBeaten).toBe(1);
    expect(g.t.credits).toBeGreaterThan(100);
    // A ship with no lasers cannot charge them.
    const bare: Game = { ...g0, pending: { kind: 'fight', tier: 0, fight: startFight(g0.t, 0, 'f') } };
    expect(applyFight(bare, 'charge', undefined, DEFAULT_SETTINGS, noMark).ok).toBe(false);
    expect(applyFight(g0, 'flee', undefined, DEFAULT_SETTINGS, noMark).ok).toBe(false);
  });
});


