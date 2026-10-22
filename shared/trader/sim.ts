/** Plays many bot games and sums them up. Used by scripts/trader-sim.mjs (`npm run trader:sim`). */
import { MOON_PRICE } from './config';
import { playGame, type BotOptions, type BotStats, type SimResult } from './bot';
import { makeGalaxy } from './galaxy';
import { newTrader } from './state';

export interface SimSummary {
  games: number;
  /** Share (0 to 1) that bought the moon within the days played. */
  moonShare: number;
  /** Moon day at the 10th, 50th and 90th percentile of those that got there. */
  moonDays: [number, number, number];
  /** Average credits at the end of days 1, 2, 3, 5 and 8 (the moon's price once it is bought). */
  creditsAt: number[];
  stats: BotStats;
  /** Average ship number reached by day 10. */
  shipAt10: number;
}

export function simulate(options: BotOptions & { games: number; days: number; offset?: number }): SimSummary {
  const results: SimResult[] = [];
  for (let g = 0; g < options.games; g++) {
    const seed = `sim-${(options.offset ?? 0) + g}`;
    const galaxy = makeGalaxy(seed);
    results.push(playGame(galaxy, newTrader(galaxy, 1), seed, options.days, options));
  }
  const got = results.filter((r) => r.moonDay > 0).map((r) => r.moonDay).sort((a, b) => a - b);
  const pct = (p: number): number => (got.length ? got[Math.min(got.length - 1, Math.floor(p * got.length))] : 0);
  const total: BotStats = { jumps: 0, profitableJumps: 0, fights: 0, piratesBeaten: 0, wrecks: 0, robbed: 0, customsFines: 0 };
  for (const r of results) for (const k of Object.keys(total) as (keyof BotStats)[]) total[k] += r.stats[k];
  // Once a game has bought the moon it counts as the moon's price from then on.
  const at = (day: number): number => Math.round(results.reduce((sum, r) => sum + (day > r.credits.length ? MOON_PRICE : r.credits[day - 1]), 0) / results.length);
  return {
    games: results.length,
    moonShare: got.length / results.length,
    moonDays: [pct(0.1), pct(0.5), pct(0.9)],
    creditsAt: [at(1), at(2), at(3), at(5), at(8)],
    stats: total,
    shipAt10: results.reduce((sum, r) => sum + (r.ships[Math.min(10, r.ships.length) - 1] ?? 0), 0) / results.length,
  };
}
