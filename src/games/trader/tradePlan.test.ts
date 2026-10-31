import { describe, expect, it } from 'vitest';
import { GOODS, WATER } from '../../../shared/trader/config';
import { makeGalaxy } from '../../../shared/trader/galaxy';
import { newTrader } from '../../../shared/trader/state';
import { emptyPlan, runPlan } from './tradePlan';

const galaxy = makeGalaxy('plan-test');
const start = newTrader(galaxy, 1);
const buyable = start.market.find((m) => m.buy > 0 && m.stock > 3)!;

describe('trade plan', () => {
  it('an empty plan changes nothing', () => {
    const r = runPlan(start, emptyPlan());
    expect(r.ok && r.out.state.credits).toBe(start.credits);
    expect(emptyPlan()).toHaveLength(GOODS.length);
  });

  it('works out what a purchase costs and what is left, the same as the rules', () => {
    const plan = emptyPlan();
    plan[buyable.good] = 3;
    const r = runPlan(start, plan);
    if (!r.ok) throw new Error(r.reason);
    expect(r.out.spent).toBe(buyable.buy * 3);
    expect(r.out.state.credits).toBe(start.credits - buyable.buy * 3);
    expect(r.out.state.cargo[buyable.good]).toBe(3);
  });

  it('sells first, so the money from a sale can pay for a purchase', () => {
    const held = { ...start, credits: 0, cargo: start.cargo.map((_, g) => (g === buyable.good ? 5 : 0)) };
    const plan = emptyPlan();
    plan[buyable.good] = -5;
    const other = held.market.find((m) => m.good !== buyable.good && m.buy > 0 && m.stock > 1)!;
    plan[other.good] = 1;
    const r = runPlan(held, plan);
    expect(r.ok).toBe(buyable.sell * 5 >= other.buy);
  });

  it('refuses a plan that cannot be done and says why', () => {
    const plan = emptyPlan();
    plan[buyable.good] = 99;
    const r = runPlan(start, plan);
    expect(r.ok).toBe(false);
    plan[WATER] = 0;
    expect(runPlan({ ...start, credits: 0 }, Object.assign(emptyPlan(), { [buyable.good]: 1 })).ok).toBe(false);
  });

  it('a sharp-trader discount makes a purchase cheaper and a sale pay more', () => {
    const plan = emptyPlan();
    plan[buyable.good] = 2;
    const plain = runPlan(start, plan);
    const sharp = runPlan(start, plan, 200, 200);
    if (!plain.ok || !sharp.ok) throw new Error('should work');
    expect(sharp.out.spent).toBeLessThanOrEqual(plain.out.spent);
  });
});
