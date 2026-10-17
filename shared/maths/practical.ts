/**
 * "Practical" maths: the question kinds Clan Quest needs (percent of an amount, price with tax,
 * change, area, remainders, rounding up, ratios, budgets, negative numbers, better buys). Every
 * question is made and marked by code, never by an AI, and is rebuilt from its kind and its
 * numbers alone: `buildQuestion(kind, nums)` always gives the same text and the same answer, so
 * the server can check an answer without trusting the browser.
 *
 * `generateSpec` picks the numbers for a year band from a random function (the games pass in
 * their own seeded one). Easy bands use round numbers (10%, 25%, 50%, multiples of 10); harder
 * ones use 15%, 35%, 12.5% and awkward amounts. Real numbers from a game (an actual price and
 * tax) go straight into `buildQuestion` instead.
 */

export type YearBand = 4 | 5 | 6;
export const YEAR_BANDS: readonly YearBand[] = [4, 5, 6];

export const KINDS = [
  'percent-of',
  'price-with-tax',
  'change',
  'area',
  'perimeter',
  'share-whole',
  'share-left',
  'round-up',
  'troop-cost',
  'budget-left',
  'ratio',
  'negative',
  'better-buy',
  'church-bill',
  'times',
] as const;
export type PracticalKind = (typeof KINDS)[number];

/** What a teacher switches on and off. */
export const TOPICS = ['times', 'percentages', 'money', 'area', 'division', 'ratios', 'rates', 'integers'] as const;
export type PracticalTopic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<PracticalTopic, string> = {
  times: 'Times tables',
  percentages: 'Percentages',
  money: 'Money and budgets',
  area: 'Area and perimeter',
  division: 'Division and remainders',
  ratios: 'Ratios',
  rates: 'Better buys (rates)',
  integers: 'Negative numbers',
};

/** A question's numbers: all a game or server needs to keep to rebuild it. */
export interface PracticalSpec {
  kind: PracticalKind;
  nums: number[];
}

export interface PracticalQuestion extends PracticalSpec {
  topic: PracticalTopic;
  /** The whole question, in plain words. */
  text: string;
  /** The one right answer (a whole number; for a "which is better" question, 1 or 2). */
  answer: number;
  /** A word to show after the answer box: "gold", "squares". */
  unit?: string;
  /** Tap-to-answer choices, for "which is better" questions. */
  choices?: { value: number; label: string }[];
  /** The worked answer, one step per line. The first line is the hint. */
  working: string[];
}

export interface BuildOptions {
  /** Names for the two offers of a better-buy question ("Axe", "Sword"). Wording only; never marked. */
  labels?: [string, string];
  /** The real thing being bought, for the shop's price and change questions ("Dagger"). Wording only; never marked. */
  item?: string;
  /** Wording for a "percent of" question: followers joining the draft, or loot from a treasury. Never marked. */
  about?: 'followers' | 'loot';
}

const MINUS = '−';

/** A number for people: thousands commas, a proper minus sign, no trailing zeros. */
export function fmt(n: number): string {
  const rounded = Math.round(Math.abs(n) * 100) / 100;
  const [whole, decimals] = String(rounded).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 && rounded !== 0 ? MINUS : '') + grouped + (decimals ? `.${decimals}` : '');
}

/** Round up, ignoring the tiny errors decimals can leave behind. */
const ceil = (x: number) => Math.ceil(Math.round(x * 1e6) / 1e6);
const isWhole = (x: number) => Math.round(x * 1e6) / 1e6 === Math.round(x);

/** A steady pick from a list that depends only on the numbers, so rebuilding gives the same wording. */
const variant = (nums: number[], count: number) => Math.abs(Math.round(nums.reduce((t, x, i) => t + x * (i + 3), 0))) % count;

// ---------------------------------------------------------------------------
// Each kind: its topic, a check that the numbers make sense, how to build it, how to pick numbers.
// ---------------------------------------------------------------------------

type Random = () => number;
type Built = Omit<PracticalQuestion, 'kind' | 'nums' | 'topic'>;

interface KindDef {
  topic: PracticalTopic;
  /** The year bands it can be asked at. */
  bands: readonly YearBand[];
  valid(nums: number[]): boolean;
  build(nums: number[], options: BuildOptions): Built;
  generate(band: YearBand, random: Random, tables: readonly number[]): number[];
}

const int = (random: Random, lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
const choose = <T>(random: Random, list: readonly T[]): T => list[Math.floor(random() * list.length)];
const stepped = (random: Random, lo: number, hi: number, step: number) => lo + step * Math.floor(random() * ((hi - lo) / step + 1));
const whole = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;
const allWhole = (nums: number[], lo: number, hi: number) => nums.every((n) => whole(n, lo, hi));

/** A total that is not an exact multiple of `per`, between lo and hi. */
function withRemainder(random: Random, per: number, lo: number, hi: number): number {
  for (let tries = 0; tries < 200; tries++) {
    const total = int(random, lo, hi);
    if (total % per !== 0) return total;
  }
  return lo - (lo % per) + 1;
}

const PERCENT_WORDS: Record<number, string> = {
  50: 'half',
  25: 'a quarter',
  10: 'a tenth',
  20: 'a fifth',
  75: 'three quarters',
  12.5: 'an eighth',
};

const GOODS = ['shield', 'helmet', 'belt', 'cloak', 'lantern', 'rope'];
const SUPPLIES = ['arrows', 'potions', 'scrolls', 'torches'];

const KIND_DEFS: Record<PracticalKind, KindDef> = {
  'percent-of': {
    topic: 'percentages',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 2 && n[0] > 0 && n[0] <= 100 && Math.round(n[0] * 10) === n[0] * 10 && whole(n[1], 1, 5000),
    build([pct, amount], options) {
      const exact = amount * pct / 100;
      const answer = ceil(exact);
      const rounding = isWhole(exact) ? '' : ' Round up to a whole number.';
      const text = [
        `What is ${fmt(pct)}% of ${fmt(amount)}?`,
        `${fmt(amount)} followers watch you win. ${fmt(pct)}% of them join your clan. How many join?`,
        `A chest holds ${fmt(amount)} gold. You may take ${fmt(pct)}% of it. How much is that?`,
      ][options.about === 'followers' ? 1 : options.about === 'loot' ? 2 : variant([pct, amount], 3)] + rounding;
      const working: string[] = [];
      if (PERCENT_WORDS[pct]) {
        const parts = pct === 75 ? 4 : Math.round(100 / pct);
        working.push(`${fmt(pct)}% is ${PERCENT_WORDS[pct]}, so divide by ${parts}${pct === 75 ? ' and times by 3' : ''}.`);
        working.push(pct === 75 ? `${fmt(amount)} ÷ 4 = ${fmt(amount / 4)}, then × 3 = ${fmt(amount * 3 / 4)}.` : `${fmt(amount)} ÷ ${parts} = ${fmt(exact)}.`);
      } else {
        working.push(`1% of ${fmt(amount)} is ${fmt(amount / 100)}, so ${fmt(pct)}% is ${fmt(pct)} × ${fmt(amount / 100)}.`);
        working.push(`${fmt(pct)} × ${fmt(amount / 100)} = ${fmt(exact)}.`);
      }
      if (!isWhole(exact)) working.push(`That is ${fmt(exact)}, rounded up to ${fmt(answer)}.`);
      return { text, answer, working };
    },
    generate(band, random) {
      if (band === 4) return [choose(random, [10, 25, 50]), choose(random, [20, 40, 60, 80, 100, 120, 160, 200])];
      if (band === 5) return [choose(random, [10, 20, 25, 50, 75]), stepped(random, 40, 400, 20)];
      return [choose(random, [5, 15, 30, 35, 40, 45, 60, 12.5]), stepped(random, 80, 800, 40)];
    },
  },

  'price-with-tax': {
    topic: 'percentages',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 2 && whole(n[0], 1, 5000) && n[1] >= 0 && n[1] <= 100 && Math.round(n[1] * 10) === n[1] * 10,
    build([price, tax], options) {
      const taxAmount = price * tax / 100;
      const exact = price + taxAmount;
      const answer = ceil(exact);
      const item = options.item ? `The ${options.item}` : `A ${GOODS[variant([price, tax], GOODS.length)]}`;
      const text = `${item} costs ${fmt(price)} gold. The village adds ${fmt(tax)}% tax. What do you pay?` + (isWhole(exact) ? '' : ' Round up to a whole gold piece.');
      const working = [
        `Work out the tax first: ${fmt(tax)}% of ${fmt(price)} = ${fmt(taxAmount)}.`,
        `Then add it on: ${fmt(price)} + ${fmt(taxAmount)} = ${fmt(exact)}.`,
      ];
      if (!isWhole(exact)) working.push(`Round up to ${fmt(answer)} gold.`);
      return { text, answer, unit: 'gold', working };
    },
    generate(band, random) {
      if (band === 4) return [stepped(random, 20, 200, 10), 10];
      if (band === 5) return [stepped(random, 40, 400, 20), choose(random, [10, 20, 25])];
      return [stepped(random, 80, 720, 40), choose(random, [5, 12.5, 15, 30])];
    },
  },

  change: {
    topic: 'money',
    bands: YEAR_BANDS,
    valid: (n) => n.length >= 2 && n.length <= 4 && allWhole(n, 1, 100000) && n.slice(1).reduce((t, c) => t + c, 0) <= n[0],
    build([paid, ...costs], options) {
      const total = costs.reduce((t, c) => t + c, 0);
      const answer = paid - total;
      const goods = costs.map((_, i) => GOODS[(variant([paid, ...costs], GOODS.length) + i) % GOODS.length]);
      const things = costs.length === 1
        ? `${options.item ? `the ${options.item}` : `a ${goods[0]}`} that costs ${fmt(costs[0])} gold`
        : `${costs.map((c, i) => `a ${goods[i]} (${fmt(c)} gold)`).join(' and ')}`;
      const text = `You pay ${fmt(paid)} gold for ${things}. How much change do you get?`;
      const working =
        costs.length === 1
          ? [`Change = what you paid − the cost.`, `${fmt(paid)} − ${fmt(costs[0])} = ${fmt(answer)}.`]
          : [`First add up the cost: ${costs.map(fmt).join(' + ')} = ${fmt(total)}.`, `Then take it from what you paid: ${fmt(paid)} − ${fmt(total)} = ${fmt(answer)}.`];
      return { text, answer, unit: 'gold', working };
    },
    generate(band, random) {
      if (band === 4) return [1000, stepped(random, 50, 950, 50)];
      if (band === 5) return [1000, stepped(random, 10, 990, 10)];
      if (random() < 0.5) return [1000, int(random, 101, 999)];
      const first = int(random, 100, 499);
      return [1000, first, int(random, 100, 999 - first)];
    },
  },

  area: {
    topic: 'area',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 2 && allWhole(n, 1, 200),
    build([w, h]) {
      const answer = w * h;
      return {
        text: `A plot of land is ${fmt(w)} squares wide and ${fmt(h)} squares long. What is its area?`,
        answer,
        unit: 'squares',
        working: [`Area = width × length.`, `${fmt(w)} × ${fmt(h)} = ${fmt(answer)} squares.`],
      };
    },
    generate(band, random) {
      if (band === 4) return [int(random, 2, 6), int(random, 2, 6)];
      if (band === 5) return [int(random, 3, 12), int(random, 3, 12)];
      return [int(random, 6, 20), int(random, 5, 15)];
    },
  },

  perimeter: {
    topic: 'area',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 2 && allWhole(n, 1, 200),
    build([w, h]) {
      const answer = 2 * (w + h);
      return {
        text: `You want a fence all the way round a plot ${fmt(w)} squares wide and ${fmt(h)} squares long. How many squares long is the fence?`,
        answer,
        unit: 'squares',
        working: [`Go all the way round: two widths and two lengths.`, `${fmt(w)} + ${fmt(h)} + ${fmt(w)} + ${fmt(h)} = ${fmt(answer)} squares.`],
      };
    },
    generate(band, random) {
      if (band === 4) return [int(random, 2, 8), int(random, 2, 8)];
      if (band === 5) return [int(random, 3, 15), int(random, 3, 15)];
      return [int(random, 5, 25), int(random, 5, 25)];
    },
  },

  'share-whole': {
    topic: 'division',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 2 && whole(n[0], 0, 5000) && whole(n[1], 1, 500),
    build([total, per]) {
      const answer = Math.floor(total / per);
      const left = total - answer * per;
      return {
        text: `You have ${fmt(total)} training points. Each +1 costs ${fmt(per)} points. How many can you buy?`,
        answer,
        working: [
          `Count how many lots of ${fmt(per)} fit into ${fmt(total)}.`,
          `${fmt(answer)} × ${fmt(per)} = ${fmt(answer * per)}, and ${fmt(answer + 1)} × ${fmt(per)} = ${fmt((answer + 1) * per)} is too many.`,
          `So you can buy ${fmt(answer)}${left ? `, with ${fmt(left)} left over` : ''}.`,
        ],
      };
    },
    generate(band, random) {
      if (band === 4) {
        const per = choose(random, [2, 3, 4, 5, 10]);
        return [withRemainder(random, per, 11, 49), per];
      }
      if (band === 5) {
        const per = int(random, 3, 9);
        return [withRemainder(random, per, 30, 99), per];
      }
      const per = int(random, 6, 12);
      return [withRemainder(random, per, 60, 199), per];
    },
  },

  'share-left': {
    topic: 'division',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 2 && whole(n[0], 0, 5000) && whole(n[1], 1, 500),
    build([total, per]) {
      const bought = Math.floor(total / per);
      const answer = total - bought * per;
      return {
        text: `You have ${fmt(total)} training points. Each +1 costs ${fmt(per)} points. After buying as many as you can, how many points are left over?`,
        answer,
        working: [
          `First find how many you can buy: ${fmt(bought)} × ${fmt(per)} = ${fmt(bought * per)}.`,
          `Then what is left: ${fmt(total)} − ${fmt(bought * per)} = ${fmt(answer)}.`,
        ],
      };
    },
    generate: (band, random, tables) => KIND_DEFS['share-whole'].generate(band, random, tables),
  },

  'round-up': {
    topic: 'division',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 2 && whole(n[0], 1, 5000) && whole(n[1], 1, 500),
    build([count, cap]) {
      const answer = ceil(count / cap);
      const exact = count % cap === 0;
      return {
        text: `You have ${fmt(count)} footmen. One barracks holds ${fmt(cap)}. How many barracks do you need?`,
        answer,
        working: [
          `${fmt(count)} ÷ ${fmt(cap)} = ${fmt(Math.floor(count / cap))}${exact ? '' : ` with ${fmt(count % cap)} left over`}.`,
          exact ? `It fits exactly, so ${fmt(answer)} barracks.` : `Those ${fmt(count % cap)} left over still need a roof, so round up to ${fmt(answer)} barracks.`,
        ],
      };
    },
    generate(band, random) {
      if (band === 4) {
        const cap = choose(random, [5, 10]);
        return [withRemainder(random, cap, 6, 49), cap];
      }
      if (band === 5) {
        const cap = choose(random, [5, 10, 20]);
        return [withRemainder(random, cap, 21, 149), cap];
      }
      const cap = choose(random, [5, 10, 20]);
      return [withRemainder(random, cap, 50, 399), cap];
    },
  },

  'troop-cost': {
    topic: 'money',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 3 && allWhole(n, 0, 200) && n.some((x) => x > 0),
    build([footmen, axemen, knights]) {
      const lines = [
        ...(footmen ? [{ name: footmen === 1 ? 'footman' : 'footmen', n: footmen, cost: TROOP_COST.footman }] : []),
        ...(axemen ? [{ name: axemen === 1 ? 'axeman' : 'axemen', n: axemen, cost: TROOP_COST.axeman }] : []),
        ...(knights ? [{ name: knights === 1 ? 'knight' : 'knights', n: knights, cost: TROOP_COST.knight }] : []),
      ];
      const answer = lines.reduce((t, l) => t + l.n * l.cost, 0);
      const list = lines.map((l) => `${fmt(l.n)} ${l.name}`);
      const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0];
      const working = lines.map((l) => `${fmt(l.n)} × ${fmt(l.cost)} = ${fmt(l.n * l.cost)} gold for the ${l.name}.`);
      if (lines.length > 1) working.push(`Add them up: ${lines.map((l) => fmt(l.n * l.cost)).join(' + ')} = ${fmt(answer)}.`);
      return {
        text: `A footman costs ${TROOP_COST.footman} gold, an axeman ${TROOP_COST.axeman} and a knight ${TROOP_COST.knight}. How much do ${joined} cost?`,
        answer,
        unit: 'gold',
        working,
      };
    },
    generate(band, random) {
      if (band === 4) return [int(random, 2, 9), 0, 0];
      if (band === 5) return [int(random, 2, 12), int(random, 1, 6), 0];
      return [int(random, 4, 20), int(random, 2, 10), int(random, 1, 6)];
    },
  },

  'budget-left': {
    topic: 'money',
    bands: YEAR_BANDS,
    // [unit (0 = gold, 1 = percent of the day's worker energy), total, ...what was spent]
    valid: (n) => n.length >= 3 && n.length <= 6 && (n[0] === 0 || n[0] === 1) && allWhole(n.slice(1), 1, 100000) && n.slice(2).reduce((t, c) => t + c, 0) <= n[1],
    build([unit, total, ...spent]) {
      const sum = spent.reduce((t, c) => t + c, 0);
      const answer = total - sum;
      const money = unit === 0;
      const show = (x: number) => (money ? `${fmt(x)} gold` : `${fmt(x)}%`);
      const text = money
        ? `You have ${show(total)}. You spend ${spent.map(show).join(', then ')}. How much is left?`
        : `Your workers have ${show(total)} energy today. Your buildings use ${spent.map(show).join(', ')}. How much energy is left?`;
      return {
        text,
        answer,
        unit: money ? 'gold' : '%',
        working: [`Add up what is used: ${spent.map(fmt).join(' + ')} = ${fmt(sum)}.`, `Take it from the total: ${fmt(total)} − ${fmt(sum)} = ${fmt(answer)}.`],
      };
    },
    generate(band, random) {
      if (band === 4) return [0, choose(random, [100, 200, 500, 1000]), stepped(random, 10, 90, 10)];
      if (band === 5) {
        const total = choose(random, [200, 500, 1000]);
        return [0, total, stepped(random, 10, total * 0.4, 10), stepped(random, 10, total * 0.4, 10)];
      }
      if (random() < 0.5) return [1, 100, int(random, 5, 35), int(random, 4, 25), int(random, 3, 20)];
      return [0, 1000, int(random, 100, 300), int(random, 100, 300), int(random, 100, 300)];
    },
  },

  ratio: {
    topic: 'ratios',
    bands: YEAR_BANDS,
    // [mode (0 = scale up, 1 = share out), a, b, n]
    valid: (n) => {
      if (n.length !== 4 || !allWhole(n, 0, 5000) || n[1] < 1 || n[2] < 1 || n[3] < 1) return false;
      if (n[0] === 0) return n[3] % n[1] === 0;
      if (n[0] === 1) return n[1] !== n[2] && n[3] % (n[1] + n[2]) === 0;
      return false;
    },
    build([mode, a, b, n]) {
      if (mode === 0) {
        const lots = n / a;
        const answer = lots * b;
        return {
          text: `For every ${fmt(a)} ${a === 1 ? 'axeman' : 'axemen'} there ${b === 1 ? 'is' : 'are'} ${fmt(b)} ${b === 1 ? 'footman' : 'footmen'}. If you have ${fmt(n)} ${n === 1 ? 'axeman' : 'axemen'}, how many footmen do you have?`,
          answer,
          working: [`${fmt(n)} axemen is ${fmt(lots)} lots of ${fmt(a)}.`, `Each lot has ${fmt(b)} footmen: ${fmt(lots)} × ${fmt(b)} = ${fmt(answer)}.`],
        };
      }
      const parts = a + b;
      const one = n / parts;
      const answer = one * Math.max(a, b);
      return {
        text: `Two members share ${fmt(n)} gold in the ratio ${fmt(a)} : ${fmt(b)}. How much does the bigger share get?`,
        answer,
        unit: 'gold',
        working: [
          `${fmt(a)} + ${fmt(b)} = ${fmt(parts)} parts altogether, so one part is ${fmt(n)} ÷ ${fmt(parts)} = ${fmt(one)}.`,
          `The bigger share is ${fmt(Math.max(a, b))} parts: ${fmt(Math.max(a, b))} × ${fmt(one)} = ${fmt(answer)}.`,
        ],
      };
    },
    generate(band, random) {
      if (band === 4) {
        const a = 1;
        return [0, a, int(random, 2, 5), int(random, 2, 6)];
      }
      if (band === 5) {
        const a = int(random, 2, 5);
        let b = int(random, 1, 9);
        if (b === a) b++;
        return [0, a, b, a * int(random, 2, 8)];
      }
      if (random() < 0.5) {
        const a = int(random, 1, 6);
        let b = int(random, 1, 7);
        if (b === a) b++;
        return [1, a, b, (a + b) * int(random, 3, 12)];
      }
      const a = int(random, 3, 8);
      let b = int(random, 2, 12);
      if (b === a) b++;
      return [0, a, b, a * int(random, 3, 12)];
    },
  },

  negative: {
    topic: 'integers',
    bands: [6],
    valid: (n) => n.length === 2 && allWhole(n, -1000, 1000) && n[1] !== 0,
    build([start, change]) {
      const answer = start + change;
      const verb = change < 0 ? `loses ${fmt(-change)} points` : `wins ${fmt(change)} points`;
      const text = `The clan's score is ${fmt(start)}. In the next duel it ${verb}. What is its score now?`;
      const working =
        change < 0
          ? [`Losing points means taking away: ${fmt(start)} − ${fmt(-change)}.`, `${fmt(start)} − ${fmt(-change)} = ${fmt(answer)}.${answer < 0 ? ' Below zero, so it is a negative number.' : ''}`]
          : [`Winning points means adding: ${fmt(start)} + ${fmt(change)}.`, `${fmt(start)} + ${fmt(change)} = ${fmt(answer)}.`];
      return { text, answer, working };
    },
    generate(_band, random) {
      for (let tries = 0; tries < 200; tries++) {
        const start = int(random, -10, 10);
        const change = int(random, -15, 15);
        if (change !== 0 && Math.abs(start + change) <= 20 && (tries > 100 || start + change < 0 || start < 0)) return [start, change];
      }
      return [3, -8];
    },
  },

  'better-buy': {
    topic: 'rates',
    bands: YEAR_BANDS,
    // [price A, how many in A, price B, how many in B]
    valid: (n) => n.length === 4 && allWhole(n, 1, 5000) && n[0] * n[3] !== n[2] * n[1],
    build([priceA, countA, priceB, countB], options) {
      const [nameA, nameB] = options.labels ?? ['Offer A', 'Offer B'];
      const noun = SUPPLIES[variant([priceA, countA, priceB, countB], SUPPLIES.length)];
      // Compare by cross-multiplying, so the answer never depends on rounding.
      const answer = priceA * countB < priceB * countA ? 1 : 2;
      const rateA = priceA / countA;
      const rateB = priceB / countB;
      const each = (x: number) => (isWhole(x) ? fmt(x) : `about ${fmt(Math.round(x * 10) / 10)}`);
      return {
        text: `${nameA}: ${fmt(countA)} ${noun} for ${fmt(priceA)} gold. ${nameB}: ${fmt(countB)} ${noun} for ${fmt(priceB)} gold. Which is cheaper for each one?`,
        answer,
        choices: [
          { value: 1, label: nameA },
          { value: 2, label: nameB },
        ],
        working: [
          `Find the price of one: divide the gold by the number.`,
          `${nameA}: ${fmt(priceA)} ÷ ${fmt(countA)} = ${each(rateA)} gold each. ${nameB}: ${fmt(priceB)} ÷ ${fmt(countB)} = ${each(rateB)} gold each.`,
          `${answer === 1 ? nameA : nameB} is cheaper for each one.`,
        ],
      };
    },
    generate(band, random) {
      if (band === 4) {
        for (let tries = 0; tries < 200; tries++) {
          const rateA = int(random, 5, 30);
          const rateB = int(random, 5, 30);
          const countA = int(random, 2, 6);
          const countB = int(random, 2, 6);
          if (Math.abs(rateA - rateB) >= 2 && countA !== countB) return [rateA * countA, countA, rateB * countB, countB];
        }
        return [60, 3, 50, 5];
      }
      if (band === 5) {
        for (let tries = 0; tries < 200; tries++) {
          const rateA = int(random, 10, 60);
          const rateB = int(random, 10, 60);
          const countA = int(random, 2, 10);
          const countB = int(random, 2, 10);
          if (Math.abs(rateA - rateB) >= 3 && countA !== countB) return [rateA * countA, countA, rateB * countB, countB];
        }
        return [120, 4, 150, 6];
      }
      for (let tries = 0; tries < 500; tries++) {
        const countA = int(random, 3, 12);
        const countB = int(random, 3, 12);
        const priceA = stepped(random, 50, 800, 10);
        const priceB = stepped(random, 50, 800, 10);
        const rateA = priceA / countA;
        const rateB = priceB / countB;
        if (countA !== countB && Math.abs(rateA - rateB) / Math.min(rateA, rateB) >= 0.08 && Math.abs(rateA - rateB) / Math.min(rateA, rateB) <= 0.6) return [priceA, countA, priceB, countB];
      }
      return [500, 7, 750, 8];
    },
  },

  'church-bill': {
    topic: 'money',
    bands: YEAR_BANDS,
    // [gold per level, ...the levels of the members being woken]
    valid: (n) => n.length >= 2 && n.length <= 8 && whole(n[0], 1, 1000) && allWhole(n.slice(1), 1, 100),
    build([per, ...levels]) {
      const bills = levels.map((l) => (l + 1) * per);
      const answer = bills.reduce((t, b) => t + b, 0);
      const who =
        levels.length === 1
          ? `1 member (level ${levels[0]})`
          : new Set(levels).size === 1
            ? `${levels.length} members (all level ${levels[0]})`
            : `${levels.length} members (levels ${levels.slice(0, -1).join(', ')} and ${levels[levels.length - 1]})`;
      return {
        text: `The Church wakes a member for (level + 1) × ${fmt(per)} gold. You need to wake ${who}. What is the bill?`,
        answer,
        unit: 'gold',
        working: [
          `Each member costs (level + 1) × ${fmt(per)}: ${levels.map((l, i) => `(${l} + 1) × ${fmt(per)} = ${fmt(bills[i])}`).join('; ')}.`,
          bills.length > 1 ? `Add them up: ${bills.map(fmt).join(' + ')} = ${fmt(answer)}.` : `The bill is ${fmt(answer)}.`,
        ],
      };
    },
    generate(band, random) {
      if (band === 4) {
        const level = int(random, 1, 9);
        return [10, ...Array.from({ length: int(random, 2, 3) }, () => level)];
      }
      if (band === 5) return [10, ...Array.from({ length: int(random, 2, 3) }, () => int(random, 2, 12))];
      return [10, ...Array.from({ length: int(random, 3, 4) }, () => int(random, 3, 18))];
    },
  },

  times: {
    topic: 'times',
    bands: YEAR_BANDS,
    valid: (n) => n.length === 2 && allWhole(n, 0, 12),
    build([a, b]) {
      const answer = a * b;
      return {
        text: `${a} × ${b} = ?`,
        answer,
        working: [`${a} × ${b} = ${answer}.`],
      };
    },
    generate(band, random, tables) {
      const a = choose(random, tables.length ? tables : [2, 5, 10]);
      return [a, int(random, 2, band === 4 ? 10 : 12)];
    },
  },
};

/** Gold each kind of troop costs (the rule sheet's table; footmen 15, axemen 30, knights 60). */
export const TROOP_COST = { footman: 15, axeman: 30, knight: 60 } as const;

/** Which topic a kind belongs to. */
export const topicOf = (kind: PracticalKind): PracticalTopic => KIND_DEFS[kind].topic;

/** The kinds that can be asked at a year band, optionally only from these topics. */
export function kindsFor(band: YearBand, topics: readonly PracticalTopic[] = TOPICS): PracticalKind[] {
  return KINDS.filter((k) => KIND_DEFS[k].bands.includes(band) && topics.includes(KIND_DEFS[k].topic));
}

export const isKind = (x: unknown): x is PracticalKind => typeof x === 'string' && (KINDS as readonly string[]).includes(x);

/** True if these numbers make a sensible question of this kind. */
export function isValidSpec(spec: PracticalSpec): boolean {
  const def = isKind(spec.kind) ? KIND_DEFS[spec.kind] : undefined;
  return !!def && Array.isArray(spec.nums) && spec.nums.every((n) => typeof n === 'number' && Number.isFinite(n)) && def.valid(spec.nums);
}

/** Make the question from its kind and numbers. Throws if the numbers don't make sense. */
export function buildQuestion(kind: PracticalKind, nums: number[], options: BuildOptions = {}): PracticalQuestion {
  if (!isValidSpec({ kind, nums })) throw new Error(`Bad numbers for a "${kind}" question: ${JSON.stringify(nums)}`);
  const def = KIND_DEFS[kind];
  return { kind, nums: [...nums], topic: def.topic, ...def.build(nums, options) };
}

/** Pick the numbers for a question of one kind at a year band. */
export function generateSpec(kind: PracticalKind, band: YearBand, random: Random, tables: readonly number[] = []): PracticalSpec {
  const def = KIND_DEFS[kind];
  if (!def.bands.includes(band)) throw new Error(`"${kind}" questions are not asked at Year ${band}`);
  return { kind, nums: def.generate(band, random, tables) };
}

/** A whole question at a band: pick the numbers, then build it. */
export function generateQuestion(kind: PracticalKind, band: YearBand, random: Random, tables: readonly number[] = []): PracticalQuestion {
  const spec = generateSpec(kind, band, random, tables);
  return buildQuestion(spec.kind, spec.nums);
}

/** Check a typed or tapped answer. A missing answer ("No thanks") counts as not right. */
export function markAnswer(q: PracticalQuestion, given: number | null | undefined): boolean {
  return typeof given === 'number' && Number.isFinite(given) && given === q.answer;
}

// ---------------------------------------------------------------------------
// Teacher switches
// ---------------------------------------------------------------------------

/** What a teacher can set for Clan Quest's maths: which topics, and which year band. Same shape as the other games' settings. */
export interface PracticalSettings {
  enabledTopics: PracticalTopic[];
  yearBand: YearBand;
  /** Which times tables the "times" topic draws on (the same switch the other games have). */
  enabledTables: number[];
}

export const DEFAULT_PRACTICAL_SETTINGS: PracticalSettings = {
  enabledTopics: TOPICS.filter((t) => t !== 'integers' && t !== 'times'),
  yearBand: 5,
  enabledTables: [2, 3, 4, 5, 6, 7, 8, 9, 10],
};

/** Settings from anything saved (or nothing): unknown topics, bad bands and bad tables fall back to the defaults. */
export function readPracticalSettings(raw: unknown): PracticalSettings {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const topics = Array.isArray(obj.enabledTopics) ? TOPICS.filter((t) => (obj.enabledTopics as unknown[]).includes(t)) : DEFAULT_PRACTICAL_SETTINGS.enabledTopics;
  const band = YEAR_BANDS.find((b) => b === obj.yearBand) ?? DEFAULT_PRACTICAL_SETTINGS.yearBand;
  const tables = Array.isArray(obj.enabledTables)
    ? [...new Set((obj.enabledTables as unknown[]).filter((t): t is number => typeof t === 'number' && Number.isInteger(t) && t >= 1 && t <= 12))].sort((a, b) => a - b)
    : DEFAULT_PRACTICAL_SETTINGS.enabledTables;
  return { enabledTopics: [...topics], yearBand: band, enabledTables: tables.length ? tables : [...DEFAULT_PRACTICAL_SETTINGS.enabledTables] };
}

/** Is a topic being asked at this year band? (Switched on, and has a kind for the band.) */
export const topicAvailable = (settings: PracticalSettings, topic: PracticalTopic) =>
  settings.enabledTopics.includes(topic) && kindsFor(settings.yearBand, [topic]).length > 0;

/** Pick a kind: first a switched-on topic, then one of its kinds, so each topic is asked about equally. Null if nothing is on. */
export function pickKind(settings: PracticalSettings, random: Random): PracticalKind | null {
  const topics = TOPICS.filter((t) => topicAvailable(settings, t));
  if (topics.length === 0) return null;
  const topic = choose(random, topics);
  return choose(random, kindsFor(settings.yearBand, [topic]));
}

/** A random question of the teacher's topics and year band, or null if all topics are off. */
export function pickQuestion(settings: PracticalSettings, random: Random): PracticalQuestion | null {
  const kind = pickKind(settings, random);
  return kind ? generateQuestion(kind, settings.yearBand, random, settings.enabledTables) : null;
}
