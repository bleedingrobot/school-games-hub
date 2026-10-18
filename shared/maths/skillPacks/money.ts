/**
 * Gold and shopping (Dragon Maths: the shop, the healer, the inn and forest treasure).
 *
 * Band 1: change from a purchase, and the cost of 2 or 3 of something.
 * Band 2: the total of two things, and gold left after buying two things.
 * Band 3: swap rates (gems for potions), and "do I have enough?" as how many more gold I need.
 * Band 4: which is better value (pick one), and bigger change.
 *
 * Gold is a whole number, so no decimals. Every question is made from its numbers, so the server can make it again.
 */
import { BandedPack, int, isInt, pickOne, show, speak, type Family, type PackDefinition } from '../banded';
import type { FactStats } from '../leitner';

const TODO = (what: string) => [`TODO-${what}`];

const ITEMS = ['pie', 'potion', 'torch', 'map', 'apple pie', 'rope', 'shield polish', 'lantern', 'bandage', 'sweet roll'];
const ITEMS_PLURAL = ['pies', 'potions', 'torches', 'maps', 'apple pies', 'ropes', 'tins of polish', 'lanterns', 'bandages', 'sweet rolls'];
const item = (i: number) => ITEMS[i % ITEMS.length];
const plural = (i: number) => ITEMS_PLURAL[i % ITEMS.length];
const gold = (n: number) => `${show(n)} gold`;

const itemIndex = (r: () => number) => int(r, 0, ITEMS.length - 1);

const families: Record<string, Family> = {
  'money:change': {
    label: 'Change from a purchase (40 gold, costs 25)',
    curriculumTags: TODO('money-change'),
    keys: ['money:change'],
    roll: (_k, r) => {
      const pay = pickOne(r, [50, 100]);
      const cost = int(r, 3, pay / 5 - 1) * 5;
      return [itemIndex(r), cost, pay];
    },
    make: (_k, [i, cost, pay]) => {
      if (!isInt(i, 0, ITEMS.length - 1) || !isInt(cost, 15, 95) || cost % 5 !== 0 || (pay !== 50 && pay !== 100) || cost >= pay) return null;
      const parts = ['A', item(i), 'costs', gold(cost) + '.', `You pay ${gold(pay)}. Change:`, '?'];
      return {
        parts, spoken: speak(parts), answer: pay - cost,
        wrong: [pay - cost + 5, pay - cost - 5, pay + cost, pay - cost + 10, pay - cost - 10],
        fact: `${show(pay)} − ${show(cost)} = ${show(pay - cost)} gold change`,
      };
    },
  },
  'money:several': {
    label: 'The cost of 2 or 3 of something (3 pies at 12 gold)',
    curriculumTags: TODO('money-several'),
    keys: ['money:several'],
    roll: (_k, r) => [itemIndex(r), int(r, 2, 5), int(r, 2, 12)],
    make: (_k, [i, n, price]) => {
      if (!isInt(i, 0, ITEMS.length - 1) || !isInt(n, 2, 5) || !isInt(price, 2, 12)) return null;
      const parts = [`${n} ${plural(i)} at`, gold(price) + ' each cost', '?'];
      return {
        parts, spoken: speak(parts), answer: n * price,
        wrong: [n + price, n * price + price, n * price - price, (n + 1) * price + 1],
        fact: `${n} × ${price} = ${show(n * price)} gold`,
      };
    },
  },
  'money:total': {
    label: 'The total of two things (a sword 85 gold and a shield 60 gold)',
    curriculumTags: TODO('money-total'),
    keys: ['money:total'],
    roll: (_k, r) => [itemIndex(r), int(r, 12, 90), int(r, 12, 90)],
    make: (_k, [i, a, b]) => {
      if (!isInt(i, 0, ITEMS.length - 1) || !isInt(a, 12, 90) || !isInt(b, 12, 90)) return null;
      const j = i + 1;
      const parts = [`A ${item(i)} costs`, gold(a) + '. ', `A ${item(j)} costs`, gold(b) + '.', 'Both cost', '?'];
      return {
        parts, spoken: speak(parts), answer: a + b,
        wrong: [a + b + 10, a + b - 10, Math.abs(a - b), a + b + 1, a + b - 1],
        fact: `${show(a)} + ${show(b)} = ${show(a + b)} gold`,
      };
    },
  },
  'money:left': {
    label: 'Gold left after buying two things',
    curriculumTags: TODO('money-left'),
    keys: ['money:left'],
    roll: (_k, r) => {
      const a = int(r, 10, 60);
      const b = int(r, 10, 60);
      return [itemIndex(r), a, b, a + b + int(r, 5, 50)];
    },
    make: (_k, [i, a, b, have]) => {
      if (!isInt(i, 0, ITEMS.length - 1) || !isInt(a, 10, 60) || !isInt(b, 10, 60) || !isInt(have, a + b + 5, a + b + 50)) return null;
      const parts = [`You have ${gold(have)}. You buy a ${item(i)} for`, gold(a), `and a ${item(i + 1)} for`, gold(b) + '. Gold left:', '?'];
      return {
        parts, spoken: speak(parts), answer: have - a - b,
        wrong: [have - a, have - b, have - a - b + 10, have - a - b - 10, have + a + b],
        fact: `${show(a)} + ${show(b)} = ${show(a + b)}, and ${show(have)} − ${show(a + b)} = ${show(have - a - b)} gold left`,
      };
    },
  },
  'money:swap': {
    label: 'Swap rates (2 gems buy 3 potions: how many potions for 8 gems?)',
    curriculumTags: TODO('money-swap'),
    keys: ['money:swap'],
    roll: (_k, r) => {
      const gems = int(r, 2, 4);
      return [itemIndex(r), gems, int(r, 2, 6), int(r, 2, 5)];
    },
    make: (_k, [i, gems, per, times]) => {
      if (!isInt(i, 0, ITEMS.length - 1) || !isInt(gems, 2, 4) || !isInt(per, 2, 6) || !isInt(times, 2, 5)) return null;
      const parts = [`${gems} gems buy ${per} ${plural(i)}.`, `How many ${plural(i)} for ${gems * times} gems?`, '?'];
      return {
        parts, spoken: speak(parts), answer: per * times,
        wrong: [per + times, per * times + per, per * (times - 1), per * (times + 1), gems * times],
        fact: `${gems * times} gems is ${times} lots of ${gems}, so ${times} × ${per} = ${per * times} ${plural(i)}`,
      };
    },
  },
  'money:short': {
    label: 'How much more gold do you need?',
    curriculumTags: TODO('money-short'),
    keys: ['money:short'],
    roll: (_k, r) => {
      const have = int(r, 20, 150);
      return [itemIndex(r), have, have + int(r, 8, 90)];
    },
    make: (_k, [i, have, cost]) => {
      if (!isInt(i, 0, ITEMS.length - 1) || !isInt(have, 20, 150) || !isInt(cost, have + 8, have + 90)) return null;
      const parts = [`You have ${gold(have)}. A ${item(i)} costs`, gold(cost) + '. You need', '?', 'more gold.'];
      return {
        parts, spoken: speak(parts), answer: cost - have,
        wrong: [cost + have, cost - have + 10, cost - have - 10, cost - have + 1, cost - have - 1],
        fact: `${show(cost)} − ${show(have)} = ${show(cost - have)} gold`,
      };
    },
  },
  'money:value': {
    label: 'Which is better value? (3 for 12 gold or 5 for 15 gold)',
    curriculumTags: TODO('money-value'),
    keys: ['money:value'],
    roll: (_k, r) => {
      // Each deal is "n for price" where price is a whole number of gold per item, and the two deals differ.
      for (;;) {
        const unitA = int(r, 2, 9);
        const unitB = int(r, 2, 9);
        if (unitA === unitB) continue;
        const nA = int(r, 2, 6);
        const nB = int(r, 2, 6);
        return [itemIndex(r), nA, unitA * nA, nB, unitB * nB];
      }
    },
    make: (_k, [i, nA, priceA, nB, priceB]) => {
      if (!isInt(i, 0, ITEMS.length - 1) || !isInt(nA, 2, 6) || !isInt(nB, 2, 6) || !isInt(priceA, 4, 54) || !isInt(priceB, 4, 54)) return null;
      if (priceA % nA !== 0 || priceB % nB !== 0 || priceA / nA === priceB / nB) return null;
      const unitA = priceA / nA;
      const unitB = priceB / nB;
      const parts = [`Deal A: ${nA} ${plural(i)} for ${gold(priceA)}. Deal B: ${nB} ${plural(i)} for ${gold(priceB)}. Which is cheaper for each one?`, '?'];
      return {
        parts, spoken: speak(parts), answer: unitA < unitB ? 0 : 1,
        pick: [`Deal A (${nA} for ${priceA})`, `Deal B (${nB} for ${priceB})`],
        fact: `A costs ${show(priceA)} ÷ ${nA} = ${unitA} each. B costs ${show(priceB)} ÷ ${nB} = ${unitB} each. ${unitA < unitB ? 'A' : 'B'} is cheaper.`,
      };
    },
  },
  'money:change-big': {
    label: 'Bigger change (250 gold, costs 187)',
    curriculumTags: TODO('money-change-big'),
    keys: ['money:change-big'],
    roll: (_k, r) => {
      const pay = pickOne(r, [200, 250, 300, 500]);
      return [itemIndex(r), int(r, 101, pay - 6), pay];
    },
    make: (_k, [i, cost, pay]) => {
      if (!isInt(i, 0, ITEMS.length - 1) || ![200, 250, 300, 500].includes(pay) || !isInt(cost, 101, pay - 6)) return null;
      const parts = ['A', item(i), 'costs', gold(cost) + '.', `You pay ${gold(pay)}. Change:`, '?'];
      return {
        parts, spoken: speak(parts), answer: pay - cost,
        wrong: [pay - cost + 10, pay - cost - 10, pay - cost + 100, pay - cost - 100, pay - cost + 1],
        fact: `${show(pay)} − ${show(cost)} = ${show(pay - cost)} gold change`,
      };
    },
  },
};

export const MONEY: PackDefinition = {
  id: 'money',
  label: 'Gold and shopping',
  families,
  bands: [['money:change', 'money:several'], ['money:total', 'money:left'], ['money:swap', 'money:short'], ['money:value', 'money:change-big']],
};

export const moneyPack = (saved?: FactStats[], random?: () => number, now?: () => number) => new BandedPack(MONEY, saved, random, now);
