import { describe, expect, it } from 'vitest';
import { newBattle, play } from './engine';
import { damageFor, makeMonster } from './rules';

describe('damage', () => {
  const a = makeMonster('plusplash-1', 10); // water
  const normalFoe = makeMonster('digibud-1', 10); // leaf: water has no edge either way
  it('right is normal, quick-right ×1.5, wrong a quarter; one power up boosts a whole battle', () => {
    const right = damageFor(a, 60, normalFoe, 'right', 0).damage;
    expect(damageFor(a, 60, normalFoe, 'quick-right', 0).damage).toBeCloseTo(right * 1.5, -1);
    expect(damageFor(a, 60, normalFoe, 'wrong', 0).damage).toBeCloseTo(right / 4, -1);
    expect(damageFor(a, 60, normalFoe, 'wrong', 0).damage).toBeGreaterThanOrEqual(1);

    // A trainer battle asks one power up, then attacks need no answer and a right answer boosts them (James, 27 Nov 2026).
    const start = newBattle({ kind: 'trainer', area: 1, team: [makeMonster('plusplash-1', 10)], foes: [makeMonster('digibud-1', 30), makeMonster('digibud-1', 30)] }).state;
    expect(() => play(start, { kind: 'fight', attack: 0 }, () => 0.5)).toThrow();
    const powered = play(start, { kind: 'power-up', answer: 'right' }, () => 0.5).state;
    expect(() => play(powered, { kind: 'power-up', answer: 'right' }, () => 0.5)).toThrow();
    const plain = play(play(start, { kind: 'power-up', answer: 'wrong' }, () => 0.5).state, { kind: 'fight', attack: 0 }, () => 0.5).state;
    const boosted = play(powered, { kind: 'fight', attack: 0 }, () => 0.5).state;
    expect(boosted.foes[0].hp).toBeLessThan(plain.foes[0].hp);
    expect(boosted.questions).toBe(1);
  });

  it('knocked-out fighters still share the exp (James, 28 Nov 2026); old battles without the flag do not', () => {
    const expOf = (faintedShare: boolean) => {
      const setup = { kind: 'wild' as const, area: 1, team: [makeMonster('plusplash-1', 5), makeMonster('digibud-1', 5)], foes: [makeMonster('digibud-1', 5)], ...(faintedShare ? { faintedShare: true as const } : {}) };
      const s = play(newBattle(setup).state, { kind: 'power-up', answer: 'right' }, () => 0.5).state;
      // The first monster fought and fainted, the second came out and finishes the foe.
      s.team[0].hp = 0;
      s.active = 1;
      s.fought = [0, 1];
      s.foes[0].hp = 1;
      const out = play(s, { kind: 'fight', attack: 0 }, () => 0.5);
      expect(out.state.phase).toBe('won');
      return out.events.filter((e) => e.kind === 'exp').map((e) => e.kind === 'exp' && e.monster);
    };
    expect(expOf(true)).toEqual(['plusplash-1', 'digibud-1']);
    expect(expOf(false)).toEqual(['digibud-1']);
  });
});
