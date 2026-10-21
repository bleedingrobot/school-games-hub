import { describe, expect, it } from 'vitest';
import { LADDER } from '../maths/ladder';
import { seededRandom } from '../maths/serverQuestions';
import { ARROWS } from './arrows';
import {
  CARRY_MOST, EMPTY_ARMORY, LEVEL_SPEND, applyBuy, applySell, armoryLevel, buyProblem, parseArmory, readPack, sellPrice, shopItem, shopItems,
  toNextLevel, unused, type Armory,
} from './shop';
import { FIRST_SECONDS, NETWORK_MS, ROUND_QUESTIONS, TAP_MS, inTime, limitMs, makeRoundQuestions, markQuestion, recordedMs } from './speed';

describe('the Armory shop', () => {
  it('sells every arrow but the free Plain Arrow, the helpers, shields and bows (not the Starter Bow)', () => {
    const ids = shopItems().map((i) => `${i.kind}:${i.id}`);
    for (const a of ARROWS) expect(ids.includes(`gear:${a.id}`)).toBe(!a.unlimited);
    expect(ids).toEqual(expect.arrayContaining(['gear:apple', 'gear:umbrella', 'shield:wood', 'shield:charm', 'shield:bubble', 'bow:long', 'bow:golden']));
    expect(ids).not.toContain('bow:starter');
    expect(shopItem('gear', 'glass')).toMatchObject({ price: 500, level: 5 });
    expect(shopItem('gear', 'plain')).toBeNull();
    expect(shopItem('hat', 'steel')).toBeNull();
  });

  it('goes up a level as you spend', () => {
    expect(LEVEL_SPEND.map(armoryLevel)).toEqual([1, 2, 3, 4, 5]);
    expect(armoryLevel(199)).toBe(1);
    expect(armoryLevel(99999)).toBe(5);
    expect(toNextLevel(150)).toBe(50);
    expect(toNextLevel(5000)).toBeNull();
  });

  it('checks coins, level, carrying and owning, and selling gives half back', () => {
    const steel = shopItem('gear', 'steel')!;
    const giant = shopItem('gear', 'giant')!;
    const wood = shopItem('shield', 'wood')!;
    let a: Armory = { ...EMPTY_ARMORY, coins: 40 };
    expect(buyProblem(a, steel)).toBe('coins');
    a = { ...a, coins: 1000 };
    expect(buyProblem(a, giant)).toBe('level');
    a = applyBuy(a, steel);
    expect(a).toMatchObject({ coins: 950, spent: 50, gear: { steel: 2 } });
    a = applyBuy(applyBuy(a, steel), wood);
    expect(buyProblem(a, steel)).toBe('full');
    expect(buyProblem(a, wood)).toBe('owned');
    expect(sellPrice(steel)).toBe(12);
    expect(applySell(a, steel).gear.steel).toBe(3);
    expect(applySell(a, wood).shields).toEqual([]);
  });

  it('packs only what you own, and gives back what a fight didn\'t use', () => {
    const a: Armory = { coins: 0, gear: { steel: 3, apple: 1 }, shields: ['wood'], bows: ['long'], spent: 0 };
    expect(readPack({ quiver: { steel: 2 }, shield: 'wood', bow: 'long' }, a)).toEqual({ pack: { quiver: { steel: 2 }, shield: 'wood', bow: 'long' } });
    expect(readPack({ quiver: { steel: 4 } }, a)).toHaveProperty('problem');
    expect(readPack({ quiver: { plain: 1 } }, a)).toHaveProperty('problem');
    expect(readPack({ quiver: { steel: 1.5 } }, a)).toHaveProperty('problem');
    expect(readPack({ shield: 'bubble' }, a)).toHaveProperty('problem');
    expect(readPack({ bow: 'golden' }, a)).toHaveProperty('problem');
    expect(readPack({}, a)).toEqual({ pack: { quiver: {}, shield: null, bow: 'starter' } });
    expect(unused({ quiver: { steel: 2, apple: 1 }, shield: null }, { steel: 1, apple: 1 })).toEqual({ steel: 1 });
  });

  it('reads an Armory from the database, leaving out anything odd', () => {
    expect(parseArmory({ coins: 5, gear: { steel: 2, plain: 3, nope: 1, mole: -1 }, shields: ['wood', 'hat'], bows: ['golden', 7], spent: 10 }))
      .toEqual({ coins: 5, gear: { steel: 2 }, shields: ['wood'], bows: ['golden'], spent: 10 });
    expect(parseArmory(null)).toEqual(EMPTY_ARMORY);
    expect(CARRY_MOST).toBe(5);
  });
});

describe('the speed round', () => {
  it('gives 10 s, then 9 s … down to 1 s', () => {
    expect(Array.from({ length: ROUND_QUESTIONS }, (_, i) => limitMs(i) / 1000)).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(FIRST_SECONDS).toBe(10);
  });

  it('is in time only if both clocks agree (with a moment for the tap and for slow wi-fi)', () => {
    expect(inTime(9, 1000 + TAP_MS, 1000 + NETWORK_MS)).toBe(true);
    expect(inTime(9, 1000 + TAP_MS + 1, 1000)).toBe(false);
    expect(inTime(9, 500, 1000 + NETWORK_MS + 1)).toBe(false);
    expect(recordedMs(4000, 3000)).toBe(3000);
  });

  it('makes 10 different questions the server can mark, for every skill on the maths ladder', () => {
    for (const skill of LADDER) {
      const focus = { source: 'teacher-class' as const, skills: [skill.id], onlyThese: true, endsAt: null, canChoose: false, own: null };
      const qs = makeRoundQuestions({ facts: [], settings: {}, focus }, seededRandom(`seed-${skill.id}`));
      expect(qs.length, skill.id).toBe(ROUND_QUESTIONS);
      for (const q of qs) expect(markQuestion(q), skill.id).not.toBeNull();
    }
    // With no focus: the times-table step.
    const plain = makeRoundQuestions({ facts: [], settings: {} }, seededRandom('x'));
    expect(plain).toHaveLength(ROUND_QUESTIONS);
    // The same seed makes the same round.
    expect(makeRoundQuestions({ facts: [], settings: {} }, seededRandom('x'))).toEqual(plain);
  });
});
