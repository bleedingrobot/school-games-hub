import { describe, expect, it } from 'vitest';
import {
  START_CREDITS,
} from './config';
import { makeGalaxy } from './galaxy';
import { acceptDeal, settleCustoms } from './encounter';
import { settleFight } from './fight';
import { buy, newTrader, paidEach, sell, type Trader } from './state';

const galaxy = makeGalaxy('test-season');




describe('trading', () => {
  const start = newTrader(galaxy, 1);

  it('buys and sells with the right money, a sharp-trader discount helps, and what you paid keeps in step with the hold', () => {
    const line = start.market.find((m) => m.buy > 0 && m.stock > 2)!;
    const plain = buy(start, line.good, 2);
    const sharp = buy(start, line.good, 2, -200);
    if (!plain.ok || !sharp.ok) throw new Error('should buy');
    expect(plain.state.credits).toBe(START_CREDITS - line.buy * 2);
    expect(sharp.state.credits).toBeGreaterThanOrEqual(plain.state.credits);
    expect(plain.state.market[line.good].stock).toBe(line.stock - 2);
    expect(plain.state.cargo[line.good]).toBe(2);
    expect(start.credits).toBe(START_CREDITS);

    // What you paid (H.3): a buy adds its cost, a part sale takes off its average share, and every other way cargo
    // goes (customs, pirates, the escape pod, a friendly trader) keeps it in step. Old saves don't know.
    const g = line.good;
    const t: Trader = { ...start, credits: 100_000, market: start.market.map((m) => (m.good === g ? { ...m, buy: 10, sell: 30, stock: 50 } : m)) };
    const ok = (r: ReturnType<typeof buy>): Trader => (r.ok ? r.state : (() => { throw new Error(r.reason); })());
    let s = ok(buy(ok(buy(t, g, 3)), g, 1));
    expect([s.cargo[g], s.paid?.[g], paidEach(s, g)]).toEqual([4, 40, 10]);
    s = ok(sell(s, g, 1));
    expect([s.cargo[g], s.paid?.[g]]).toEqual([3, 30]);
    const deal = acceptDeal(s, { kind: 'trader', good: g, qty: 2, sells: true, price: 25, fair: 30 })!;
    expect([deal.cargo[g], deal.paid?.[g], paidEach(deal, g)]).toEqual([5, 80, 16]);
    expect(acceptDeal(deal, { kind: 'trader', good: g, qty: 5, sells: false, price: 30, fair: 30 })!.paid?.[g]).toBe(0);
    expect(settleCustoms(deal, [g]).state.paid?.[g]).toBe(0);
    const fight = { outcome: 'robbed', hull: 5, tier: 0 } as unknown as Parameters<typeof settleFight>[1];
    const robbed = settleFight(deal, fight);
    expect(robbed.paid?.[g]).toBe(Math.round((80 * robbed.cargo[g]) / 5));
    expect(settleFight(deal, { ...fight, outcome: 'destroyed' }).paid?.every((p) => p === 0)).toBe(true);
    const old = { ...s, paid: undefined };
    expect(paidEach(old, g)).toBeNull();
    const after = ok(sell(ok(buy(old, g, 1)), g, 4));
    expect([paidEach(after, g), after.paid?.[g]]).toEqual([null, 0]);
    expect(paidEach(ok(buy(after, g, 2)), g)).toBe(10);
  });
});



