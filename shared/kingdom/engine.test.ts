import { expect, it } from 'vitest';
import { seededRandom } from '../maths/serverQuestions';
import { YEARS } from './config';
import { pointsFor, problemWith, ratingOf, startCity, turnYear, type City, type Decisions } from './engine';

// Kingdom Keeper has three rule tests (docs/TESTING.md: a new game gets at most 8 in all).

/** Random numbers that come out in this order (then 0 for ever). */
const seq = (...values: number[]) => () => values.shift() ?? 0;
/** A roll of n (1 to 5) for the harvest, rats and newcomers rolls. */
const roll = (n: number) => (n - 1) / 5 + 0.01;
const city = (over: Partial<City> = {}): City => ({ ...startCity(seq(0)), ...over });

it("turns a year by Hamurabi's rules, with the boons only the council won", () => {
  // harvest 4, rats get in (roll 2: half the store), newcomers roll 3, no sickness, then next year's price
  const next = turnYear(city({ price: 20 }), { buy: 0, sell: 0, feed: 1600, plant: 600 }, [], seq(roll(4), roll(2), roll(3), 0.9, 0.5));
  // 2800 - 1600 food - 300 seed = 900; rats eat 450; harvest 2400; newcomers int(3 × (20 × 1000 + 2850) / 100 / 100 + 1) = 7
  expect(next).toMatchObject({ year: 2, grain: 2850, people: 100 - 20 + 7, price: 22, hungryPct: [20], status: 'playing' });
  expect(next.report).toMatchObject({ harvestPerAcre: 4, harvested: 2400, ratsAte: 450, hungry: 20, newcomers: 7, sickness: false });

  const d = { buy: 0, sell: 0, feed: 2000, plant: 700 };
  const bad = [roll(2), roll(2), roll(2), 0.01];
  const plain = turnYear(city(), d, [], seq(...bad));
  const helped = turnYear(city(), d, ['reeve', 'ratcatcher', 'healer', 'builder'], seq(...bad));
  expect(plain.report).toMatchObject({ harvestPerAcre: 2, sickness: true });
  expect(plain.report.ratsAte).toBeGreaterThan(0);
  expect(helped.report).toMatchObject({ harvestPerAcre: 3, ratsAte: 0, sickness: false, boons: ['reeve', 'ratcatcher', 'healer', 'builder'] });
  expect(helped.report.newcomers).toBe(Math.floor(turnYear(city(), d, [], seq(roll(2), roll(1), roll(2), 0.9)).report.newcomers * 1.5));
  // The same random numbers always give the same year (the server turns years again to check them).
  expect(turnYear(city(), d, ['reeve'], seededRandom('a'))).toEqual(turnYear(city(), d, ['reeve'], seededRandom('a')));

  // More than 45% hungry brings a warning the first time and ends the reign the second; 45% doesn't.
  const starve = { buy: 0, sell: 0, feed: 20 * 54, plant: 0 };
  const warned = turnYear(city(), starve, [], seq(roll(1), roll(1), roll(1), 0.9));
  expect(warned).toMatchObject({ status: 'playing', warned: true, report: { warning: true } });
  expect(turnYear({ ...warned, people: 100, grain: 2800 }, starve, [], seq(roll(1), roll(1), roll(1), 0.9)).status).toBe('ended');
  expect(turnYear(city({ warned: true }), { ...starve, feed: 20 * 55 }, [], seq(roll(1), roll(1), roll(1), 0.9)).status).toBe('playing');
});

it('refuses decisions the city cannot carry out', () => {
  const c = city({ price: 20 });
  const d = (over: Partial<Decisions>): Decisions => ({ buy: 0, sell: 0, feed: 0, plant: 0, ...over });
  expect(problemWith(c, d({ buy: 10, feed: 2000, plant: 500 }), [])).toBeNull();
  expect(problemWith(c, d({ buy: 140 }), [])).toBeNull();
  expect(problemWith(c, d({ buy: 141 }), [])).toBe('grain-for-land');
  expect(problemWith(c, d({ buy: 154 }), ['trader'])).toBeNull(); // 18 an acre with the trader
  expect(problemWith(c, d({ buy: 1, sell: 1 }), [])).toBe('buy-and-sell');
  expect(problemWith(c, d({ sell: 1001 }), [])).toBe('not-enough-land');
  expect(problemWith(c, d({ feed: 2801 }), [])).toBe('grain-for-food');
  expect(problemWith(c, d({ plant: 1001 }), [])).toBe('land-to-plant');
  expect(problemWith(c, d({ feed: 2799, plant: 3 }), [])).toBe('grain-for-seed'); // a part bushel of seed is a whole one
  expect(problemWith(c, d({ buy: 100, plant: 1001 }), [])).toBe('people-to-plant');
  expect(problemWith(city({ grain: 0, price: 20 }), d({ sell: 100, feed: 2000 }), [])).toBeNull(); // land sold pays for food
  expect(problemWith(c, d({ feed: 1.5 }), [])).toBe('not-numbers');
  expect(problemWith(city({ status: 'done' }), d({}), [])).toBe('over');
});

it('lasts ten years, then rates the reign and gives points', () => {
  let c = city();
  const r = seededRandom('ten');
  for (let y = 1; y <= YEARS; y++) {
    expect([c.status, c.year]).toEqual(['playing', y]);
    c = turnYear(c, { buy: 0, sell: 0, feed: c.people * 20, plant: Math.min(c.land, c.people * 10, (c.grain - c.people * 20) * 2) }, ['healer'], r);
  }
  expect(c).toMatchObject({ status: 'done', year: YEARS, report: { year: YEARS + 1 } });

  // Rated by the people fed and the city's size (not Hamurabi's acres a person: see RATINGS in config.ts).
  const done = (hungryPct: number[], people: number): City => city({ status: 'done', hungryPct, people });
  expect([done([0, 3], 150), done([0, 3], 149), done([11], 150), done([33], 60), done([34], 200), done([0], 59)].map(ratingOf))
    .toEqual(['legendary', 'good', 'fair', 'fair', 'hard', 'hard']);
  expect(ratingOf(city({ status: 'ended' }))).toBe('hard');
  expect([city(), city({ status: 'ended' }), done([20], 80), done([5], 100), done([0], 150)].map(pointsFor)).toEqual([0, 1, 3, 4, 5]);
});
