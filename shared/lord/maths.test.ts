import { describe, expect, it } from 'vitest';
import { EXTRA_PACKS, BANDED_PACKS } from '../maths/skillPacks';
import { MAX_LEVEL, baseStats, expNeeded } from './data';
import { buyGear, dragonBreather, heal, newHero, startDragonStage, startFight, stepFight } from './engine';
import {
  MOMENT_TOPICS, addMasterTrialBonus, dragonStageOptions, defaultBand, interestFor, masterTrialStrength, numberGuessPrize,
  offersSizeItUp, priceDiscount, riddleGold, sizeItUpBonus,
} from './maths';
import { markProof, questionLevel } from './proof';
import { makePack } from '../maths/skillPacks';
import type { Hero } from './types';

const hero = (patch: Partial<Hero> = {}): Hero => ({ ...newHero('knight', '2026-10-19'), ...patch });

describe('maths moments', () => {
  it('only name packs that exist', () => {
    const known = new Set([...Object.keys(BANDED_PACKS), 'times-tables', ...Object.keys(EXTRA_PACKS)]);
    for (const packs of Object.values(MOMENT_TOPICS)) for (const id of packs) expect(known.has(id), id).toBe(true);
  });
  it('rewards right answers, a little less after a hint, and nothing is taken for a wrong one', () => {
    expect(sizeItUpBonus('right')).toBe(1.5);
    expect(sizeItUpBonus('hint')).toBe(1.25);
    expect(sizeItUpBonus('wrong')).toBe(1);
    expect(priceDiscount('right')).toBe(0.1);
    expect(priceDiscount('hint')).toBe(0.05);
    expect(priceDiscount('wrong')).toBe(0);
    expect(interestFor(1000, 'wrong')).toBe(0);
    expect(interestFor(1000, 'right')).toBeGreaterThan(interestFor(1000, 'hint'));
  });
  it('offers size it up to about one fight in three, from the seed alone', () => {
    let offered = 0;
    for (let seed = 1; seed <= 3000; seed++) if (offersSizeItUp(seed)) offered += 1;
    expect(offered / 3000).toBeGreaterThan(0.28);
    expect(offered / 3000).toBeLessThan(0.38);
    expect(offersSizeItUp(12345)).toBe(offersSizeItUp(12345));
  });
  it('picks a band from the level, 1 to 4', () => {
    expect(defaultBand(1)).toBe(1);
    expect(defaultBand(6)).toBe(2);
    expect(defaultBand(12)).toBe(4);
  });
  it('gives a bigger first hit and a lower price for right answers', () => {
    const goblin = { id: 'x', name: 'x', level: 1, hp: 500, strength: 1, gold: 1, exp: 1, intro: '' };
    const dmg = (bonus: number) => 500 - stepFight({ ...startFightFor(hero()), monster: goblin, monsterHp: 500, firstHitBonus: bonus }, { type: 'attack' }).monsterHp;
    expect(dmg(sizeItUpBonus('right'))).toBeGreaterThan(dmg(sizeItUpBonus('wrong')));
    const rich = hero({ level: 2, gold: 1000, ...baseStats(2) });
    const full = buyGear(rich, 'weapon', 1);
    const cheap = buyGear(rich, 'weapon', 1, priceDiscount('right'));
    if (!full.ok || !cheap.ok) throw new Error('should buy');
    expect(cheap.paid).toBeLessThan(full.paid);
    const hurt = hero({ hp: 1, gold: 1000, level: 8 });
    expect(heal(hurt, 10, priceDiscount('right')).gold).toBeGreaterThan(heal(hurt, 10).gold);
  });
  it('adds strength for right answers in a master trial, never for wrong ones', () => {
    const all = masterTrialStrength(5, ['right', 'right', 'right']);
    const one = masterTrialStrength(5, ['right', 'wrong', 'wrong']);
    expect(all).toBe(3 * one);
    expect(masterTrialStrength(5, ['wrong', 'wrong', 'wrong'])).toBe(0);
    expect(addMasterTrialBonus(hero({ level: 4 }), ['right']).strength).toBeGreaterThan(hero({ level: 4 }).strength);
  });
  it('gives the dragon trial a small shield and a slightly bigger first hit only when it is answered right', () => {
    expect(dragonStageOptions('right').shield).toBeGreaterThan(dragonStageOptions('hint').shield!);
    expect(dragonStageOptions('wrong')).toEqual({});
  });
  it('lets a skilled player beat the dragon with no right answers, and makes right answers help a bit (a fight, not a test)', () => {
    const strong = hero({
      level: MAX_LEVEL, exp: expNeeded(MAX_LEVEL - 1), ...baseStats(MAX_LEVEL), hp: baseStats(MAX_LEVEL).maxHp,
      maxHp: baseStats(MAX_LEVEL).maxHp, weapon: 11, armour: 11,
    });
    const wins = (result: 'right' | 'wrong') => {
      let won = 0;
      const games = 200;
      for (let seed = 1; seed <= games; seed++) {
        let hp = strong.hp;
        let skillLeft = strong.skillLeft;
        let ok = true;
        for (const stage of [1, 2, 3] as const) {
          let f = startDragonStage({ ...strong, skillLeft }, stage, seed * 7919 + stage * 104729, { ...dragonStageOptions(result), heroHp: hp });
          while (!f.over) f = stepFight(f, f.skillLeft > 0 ? { type: 'skill', skill: 'power-strike' } : { type: 'attack' });
          skillLeft = f.skillLeft;
          hp = dragonBreather(strong, f.heroHp);
          if (f.outcome !== 'won') { ok = false; break; }
        }
        if (ok) won += 1;
      }
      return won / games;
    };
    const none = wins('wrong');
    const all = wins('right');
    expect(none).toBeGreaterThan(0.05); // still beatable with no right answers
    expect(all).toBeGreaterThan(none + 0.1); // right answers help
    expect(all - none).toBeLessThan(0.5); // but gear and skills decide it
    expect(all).toBeLessThan(0.9); // and it is never a certainty
  });
  it('pays a small prize for trying the number guess and a bigger one for winning', () => {
    expect(numberGuessPrize(3, true)).toBeGreaterThan(numberGuessPrize(3, false));
    expect(numberGuessPrize(3, false)).toBeGreaterThan(0);
  });
});

function startFightFor(h: Hero) {
  return startFight(h, { id: 'x', name: 'x', level: 1, hp: 500, strength: 1, gold: 1, exp: 1, intro: '' }, 3);
}

describe('a hint on a proof', () => {
  const proofFor = (hinted?: boolean, wrong = false) => {
    const pack = makePack('place-value', []);
    const q = pack.nextQuestion({ level: questionLevel('place-value', 1) })!;
    return { pack: 'place-value', key: q.factKey, kind: q.kind, params: q.params, level: questionLevel('place-value', 1), given: wrong ? q.answer + 1 : q.answer, ms: 1000, ...(hinted === undefined ? {} : { hinted }) };
  };
  it('is marked right when no hint was used, and hinted when it was', () => {
    const plain = markProof(proofFor(), 'riddle', 1, 0);
    const used = markProof(proofFor(true), 'riddle', 1, 0);
    expect(plain).toMatchObject({ ok: true, correct: true, hinted: false });
    expect(used).toMatchObject({ ok: true, correct: true, hinted: true });
  });
  it('is still wrong when the answer is wrong, hint or not', () => {
    expect(markProof(proofFor(true, true), 'riddle', 1, 0)).toMatchObject({ ok: true, correct: false });
  });
  it('only ever lowers what is earned: a hint is worth less than a right answer and more than a wrong one', () => {
    expect(riddleGold(5, 'right')).toBeGreaterThan(riddleGold(5, 'hint'));
    expect(riddleGold(5, 'hint')).toBeGreaterThan(riddleGold(5, 'wrong'));
  });
});
