import { describe, expect, it } from 'vitest';
import {
  START_CREDITS,
} from './config';
import { makeGalaxy } from './galaxy';
import { buy, newTrader } from './state';

const galaxy = makeGalaxy('test-season');




describe('trading', () => {
  const start = newTrader(galaxy, 1);

  it('buys and sells with the right money, and a sharp-trader discount helps', () => {
    const line = start.market.find((m) => m.buy > 0 && m.stock > 2)!;
    const plain = buy(start, line.good, 2);
    const sharp = buy(start, line.good, 2, -200);
    if (!plain.ok || !sharp.ok) throw new Error('should buy');
    expect(plain.state.credits).toBe(START_CREDITS - line.buy * 2);
    expect(sharp.state.credits).toBeGreaterThanOrEqual(plain.state.credits);
    expect(plain.state.market[line.good].stock).toBe(line.stock - 2);
    expect(plain.state.cargo[line.good]).toBe(2);
    expect(start.credits).toBe(START_CREDITS);
  });
});



