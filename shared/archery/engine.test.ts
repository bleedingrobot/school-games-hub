import { describe, expect, it } from 'vitest';
import { MAX_ROUNDS } from './config';
import { playFight, shotProblem } from './fight';
import type { FightSetup, Shot } from './types';

const plainOnly: FightSetup = { world: 'forest', players: [{ quiver: {}, shield: null }, { quiver: {}, shield: null }] };

describe('fights', () => {
  it('refuses shots that break the rules', () => {
    const setup: FightSetup = { world: 'forest', players: [{ quiver: { steel: 1 }, shield: null }, { quiver: {}, shield: null }] };
    expect(shotProblem({ angle: 45.5, power: 50, arrow: 'plain' }, setup, 0, {})).toMatch(/angle/);
    expect(shotProblem({ angle: 45, power: 101, arrow: 'plain' }, setup, 0, {})).toMatch(/power/);
    expect(shotProblem({ angle: 45, power: 50, arrow: 'nope' as never }, setup, 0, {})).toMatch(/no such/);
    expect(shotProblem({ angle: 45, power: 50, arrow: 'steel' }, setup, 0, {})).toBeNull();
    expect(shotProblem({ angle: 45, power: 50, arrow: 'steel' }, setup, 0, { steel: 1 })).toMatch(/left/);
    expect(shotProblem({ angle: 45, power: 50, arrow: 'steel' }, setup, 1, {})).toMatch(/left/);
  });

  it('plays a whole best-of-3 fight to the end, the same way every time', () => {
    // Lobs back and forth, far more shots than a fight needs.
    const shots: Shot[] = [];
    for (let i = 0; i < 400; i++) shots.push({ angle: i % 2 === 0 ? 55 : 125, power: 55 + ((i * 7) % 40), arrow: 'plain' });
    const first = playFight(11, plainOnly, shots);
    expect(first.status).toBe('invalid'); // the shots outlast the fight
    expect(first.invalid).toMatch(/after the fight/);
    const n = first.shots.length;
    const r = playFight(11, plainOnly, shots.slice(0, n));
    expect(r.status).toBe('done');
    // Misses all round long end level, so draws can stretch the fight, up to MAX_ROUNDS.
    expect(r.winner).not.toBeNull();
    if (r.winner !== 'draw') expect(r.roundWins[r.winner!]).toBeGreaterThan(r.roundWins[1 - r.winner!]);
    expect(r.rounds.length).toBeGreaterThanOrEqual(2);
    expect(r.rounds.length).toBeLessThanOrEqual(MAX_ROUNDS);
    expect(r.nextPlayer).toBeNull();
    expect(playFight(11, plainOnly, shots.slice(0, n))).toEqual(r);
    // Health starts full each round, and the first turn swaps.
    const secondRound = r.shots.find((s) => s.round === 1)!;
    expect(secondRound.player).toBe(1);
  });
});
