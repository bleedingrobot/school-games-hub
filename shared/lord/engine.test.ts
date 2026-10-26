import { describe, expect, it } from 'vitest';
import { MONSTERS, baseStats, expNeeded } from './data';
import { applyForestResult, applyMasterResult, canChallengeMaster, newHero, replayFight, startFight, startMasterFight, stepFight } from './engine';
import type { FightAction, Hero } from './types';

const TODAY = '2026-10-19';
const hero = (patch: Partial<Hero> = {}, heroClass: Hero['heroClass'] = 'knight'): Hero => ({ ...newHero(heroClass, TODAY), ...patch });

describe('fights', () => {
  it('replay the same way from the same seed, pay a win, and lose softly', () => {
    const goblin = MONSTERS[0][0];
    const actions: FightAction[] = [];
    let f = startFight(hero({ hp: 20 }), goblin, 99);
    while (!f.over) {
      actions.push({ type: 'attack' });
      f = stepFight(f, { type: 'attack' });
    }
    expect(replayFight(startFight(hero({ hp: 20 }), goblin, 99), actions)).toEqual(f);
    expect(() => replayFight(startFight(hero({ hp: 20 }), goblin, 99), [...actions, { type: 'attack' }])).toThrow();

    const strong = hero({ strength: 500 });
    const won = stepFight(startFight(strong, goblin, 3), { type: 'attack' });
    expect(won).toMatchObject({ over: true, outcome: 'won', monsterHp: 0 });
    expect(applyForestResult(strong, won)).toMatchObject({ gold: strong.gold + goblin.gold, exp: goblin.exp });

    const weak = hero({ hp: 1, gold: 100, bank: 50 });
    let lost = { ...startFight(weak, MONSTERS[11][4], 2), heroDefence: 0 };
    while (!lost.over) lost = stepFight(lost, { type: 'attack' });
    expect(lost.outcome).toBe('lost');
    expect(applyForestResult(weak, lost)).toMatchObject({ gold: 0, bank: 50 });
  });
});

describe('masters and levelling', () => {
  it('need enough exp and one try a day, and raise your level when you win', () => {
    expect(canChallengeMaster(hero()).ok).toBe(false);
    expect(canChallengeMaster(hero({ exp: expNeeded(1) })).ok).toBe(true);
    expect(canChallengeMaster(hero({ exp: expNeeded(1), masterTried: true })).ok).toBe(false);
    const h = hero({ exp: expNeeded(1), hp: 3 });
    const after = applyMasterResult(h, { ...startMasterFight(h, 1), over: true, outcome: 'won' as const });
    expect(after).toMatchObject({ level: 2, maxHp: baseStats(2).maxHp, hp: baseStats(2).maxHp, exp: h.exp, masterTried: true });
  });
});
