import { describe, expect, it } from 'vitest';
import { LADDER } from '../maths/ladder';
import { seededRandom } from '../maths/serverQuestions';
import { ARROWS } from './arrows';
import {
  CARRY_MOST, EMPTY_ARMORY, LEVEL_SPEND, applyBuy, applySell, armoryLevel, buyProblem, nextGoal, parseArmory, readPack, sellPrice, shopItem, shopItems,
  toNextLevel, unused, type Armory,
} from './shop';
import {
  CHEST_LOSS_COINS, CHEST_WIN_COINS, COINS_PER_RIGHT, DAILY_COINS, FIRST_SECONDS, LAST_SECONDS, NETWORK_MS, ROUND_QUESTIONS, SHORT_QUESTIONS, STREAK_BONUS, TAP_MS,
  baseCoins, inTime, limitMs, makeRoundQuestions, markQuestion, recordedMs, setSize, streakBefore, streakBonus,
} from './speed';

describe('the Armory shop', () => {
  it('sells every arrow but the free Plain Arrow, the helpers, shields and bows (not the Starter Bow)', () => {
    const ids = shopItems().map((i) => `${i.kind}:${i.id}`);
    for (const a of ARROWS) expect(ids.includes(`gear:${a.id}`)).toBe(!a.unlimited);
    expect(ids).toEqual(expect.arrayContaining(['gear:apple', 'gear:umbrella', 'shield:wood', 'shield:charm', 'shield:bubble', 'bow:long', 'bow:golden']));
    expect(ids).not.toContain('bow:starter');
    expect(shopItem('gear', 'glass')).toMatchObject({ price: 250, level: 5 });
    expect(shopItem('gear', 'plain')).toBeNull();
    expect(shopItem('hat', 'steel')).toBeNull();
  });

  it('goes up a level as you spend', () => {
    expect(LEVEL_SPEND.map(armoryLevel)).toEqual([1, 2, 3, 4, 5]);
    expect(LEVEL_SPEND).toEqual([0, 100, 300, 600, 1000]);
    expect(armoryLevel(99)).toBe(1);
    expect(armoryLevel(99999)).toBe(5);
    expect(toNextLevel(50)).toBe(50);
    expect(toNextLevel(5000)).toBeNull();
  });

  it('checks coins, level, carrying and owning, and selling gives half back', () => {
    const steel = shopItem('gear', 'steel')!;
    const giant = shopItem('gear', 'giant')!;
    const wood = shopItem('shield', 'wood')!;
    let a: Armory = { ...EMPTY_ARMORY, coins: 20 };
    expect(buyProblem(a, steel)).toBe('coins');
    a = { ...a, coins: 1000 };
    expect(buyProblem(a, giant)).toBe('level');
    a = applyBuy(a, steel);
    expect(a).toMatchObject({ coins: 975, spent: 25, gear: { steel: 2 } });
    a = applyBuy(applyBuy(a, steel), wood);
    expect(buyProblem(a, steel)).toBe('full');
    expect(buyProblem(a, wood)).toBe('owned');
    expect(sellPrice(steel)).toBe(6);
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

  it('picks something to save up for: the cheapest bow, then the cheapest shield, then nothing', () => {
    expect(nextGoal(EMPTY_ARMORY)).toMatchObject({ item: { kind: 'bow', id: 'hunter', price: 125 }, need: 125 });
    expect(nextGoal({ ...EMPTY_ARMORY, coins: 100 })).toMatchObject({ need: 25 });
    expect(nextGoal({ ...EMPTY_ARMORY, coins: 500 })).toMatchObject({ need: 0 });
    const bows: Armory = { ...EMPTY_ARMORY, bows: ['hunter', 'long', 'recurve', 'golden'], coins: 10 };
    expect(nextGoal(bows)).toMatchObject({ item: { kind: 'shield', id: 'wood', price: 50 }, need: 40 });
    expect(nextGoal({ ...bows, shields: ['wood', 'charm', 'bubble'] })).toBeNull();
  });

  it('reads an Armory from the database, leaving out anything odd', () => {
    expect(parseArmory({ coins: 5, gear: { steel: 2, plain: 3, nope: 1, mole: -1 }, shields: ['wood', 'hat'], bows: ['golden', 7], spent: 10 }))
      .toEqual({ coins: 5, gear: { steel: 2 }, shields: ['wood'], bows: ['golden'], spent: 10 });
    expect(parseArmory(null)).toEqual(EMPTY_ARMORY);
    expect(CARRY_MOST).toBe(5);
  });
});

describe('the speed round', () => {
  it('gives 10 s, then 9 s … down to 5 s, and no less', () => {
    expect(Array.from({ length: ROUND_QUESTIONS }, (_, i) => limitMs(i) / 1000)).toEqual([10, 9, 8, 7, 6, 5, 5, 5, 5, 5]);
    expect(limitMs(50)).toBe(LAST_SECONDS * 1000);
    expect(FIRST_SECONDS).toBe(10);
  });

  it('gives a loot chest or a restock 3 questions of 10 s each, and a speed round 10', () => {
    for (const kind of ['chest', 'restock'] as const) {
      expect(setSize(kind)).toBe(SHORT_QUESTIONS);
      expect([0, 1, 2].map((slot) => limitMs(slot, kind))).toEqual([10_000, 10_000, 10_000]);
    }
    expect(setSize('speed')).toBe(10);
    expect(limitMs(3, 'speed')).toBe(7000);
  });

  it('pays 10 a right, 20 (won) or 10 (lost) in a chest, and a 5 bonus from the 3rd right in a row', () => {
    expect(baseCoins('speed', false)).toBe(COINS_PER_RIGHT);
    expect(baseCoins('restock', false)).toBe(10);
    expect(baseCoins('chest', true)).toBe(CHEST_WIN_COINS);
    expect(baseCoins('chest', false)).toBe(CHEST_LOSS_COINS);
    expect([CHEST_WIN_COINS, CHEST_LOSS_COINS, STREAK_BONUS, DAILY_COINS]).toEqual([20, 10, 5, 600]);
    expect([0, 1, 2, 3, 9].map(streakBonus)).toEqual([0, 0, 5, 5, 5]);
  });

  it('counts the answers in a row just before a slot that earned coins', () => {
    expect(streakBefore([], 0)).toBe(0);
    expect(streakBefore([10, 10, 15], 3)).toBe(3);
    expect(streakBefore([10, 10, 15], 2)).toBe(2);
    expect(streakBefore([10, 0, 10], 3)).toBe(1);
    expect(streakBefore([0, 10, 10], 3)).toBe(2);
    expect(streakBefore([10, 10, undefined], 3)).toBe(0);
    // A perfect chest after a win: 20, 20, then 25.
    const earned: number[] = [];
    for (let slot = 0; slot < 3; slot++) earned.push(baseCoins('chest', true) + streakBonus(streakBefore(earned, slot)));
    expect(earned).toEqual([20, 20, 25]);
  });

  it('is in time only if both clocks agree (with a moment for the tap and for slow wi-fi)', () => {
    expect(inTime(9000, 9000 + TAP_MS, 9000 + NETWORK_MS)).toBe(true);
    expect(inTime(9000, 9000 + TAP_MS + 1, 1000)).toBe(false);
    expect(inTime(9000, 500, 9000 + NETWORK_MS + 1)).toBe(false);
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
