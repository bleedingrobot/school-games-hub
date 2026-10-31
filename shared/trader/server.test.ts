import { describe, expect, it } from 'vitest';
import { GOODS, JUMPS_PER_DAY, WATER } from './config';
import { fightRound, startFight } from './fight';
import { makeGalaxy } from './galaxy';
import { emptyPlan } from './plan';
import { DEFAULT_SETTINGS, applyBatch, applyDeal, applyFight, applyJunk, newGame, rollDay, type Action, type Game, type Mark, type Reply, type Settings } from './server';
import { reachable } from './state';

const galaxy = makeGalaxy('server-test');
const SEED = 'server-test';
const noMark: Mark = () => null;
/** Marks every answer right (or wrong) and says which slots were used. */
const marker = (right: boolean, used: number[] = []): Mark => (slot) => {
  if (used.includes(slot)) return null;
  used.push(slot);
  return { right, answer: 42 };
};
const ok = (r: Reply) => {
  if (!r.ok) throw new Error(r.reason);
  return r;
};

const buyOne = (g: Game): Action => {
  const line = g.t.market.find((m) => m.buy > 0 && m.stock > 5)!;
  const plan = emptyPlan();
  plan[line.good] = 2;
  return { type: 'trade', plan };
};

describe('the server applying moves', () => {
  it('starts a game with 100 credits and the teacher\'s jumps for the day', () => {
    const g = newGame(galaxy, 10, { ...DEFAULT_SETTINGS, jumpsPerDay: 4 });
    expect(g.t.credits).toBe(100);
    expect(g.t.jumpsLeft).toBe(4);
    expect(g.asked).toBe(0);
  });

  it('applies a trade with the shared rules and never changes the game it was given', () => {
    const g = newGame(galaxy, 1, DEFAULT_SETTINGS);
    const before = JSON.stringify(g);
    const r = ok(applyBatch(galaxy, SEED, g, [buyOne(g)], DEFAULT_SETTINGS, noMark));
    expect(r.game.t.credits).toBeLessThan(100);
    expect(JSON.stringify(g)).toBe(before);
  });

  it('refuses a move it cannot do, with a reason, and keeps nothing from the batch', () => {
    const g = newGame(galaxy, 1, DEFAULT_SETTINGS);
    const greedy = emptyPlan();
    greedy[WATER] = 400;
    const r = applyBatch(galaxy, SEED, g, [buyOne(g), { type: 'trade', plan: greedy }], DEFAULT_SETTINGS, noMark);
    expect(r.ok).toBe(false);
    expect(applyBatch(galaxy, SEED, g, [{ type: 'borrow', amount: 9999 }], DEFAULT_SETTINGS, noMark).ok).toBe(false);
    expect(applyBatch(galaxy, SEED, g, [{ type: 'trade', plan: [1, 2] }], DEFAULT_SETTINGS, noMark).ok).toBe(false);
    expect(applyBatch(galaxy, SEED, g, [{ type: 'jump', dest: 999 }], DEFAULT_SETTINGS, noMark).ok).toBe(false);
  });

  it('a right answer to the next question gives a discount, a wrong one does not, and a question is used once, in order', () => {
    const g = newGame(galaxy, 1, DEFAULT_SETTINGS);
    const trade = buyOne(g) as Extract<Action, { type: 'trade' }>;
    const plain = ok(applyBatch(galaxy, SEED, g, [trade], DEFAULT_SETTINGS, noMark));
    const sharp = ok(applyBatch(galaxy, SEED, g, [{ ...trade, ask: { slot: 0, value: 42, ms: 3000 } }], DEFAULT_SETTINGS, marker(true)));
    const wrong = ok(applyBatch(galaxy, SEED, g, [{ ...trade, ask: { slot: 0, value: 1, ms: 3000 } }], DEFAULT_SETTINGS, marker(false)));
    expect(sharp.game.t.credits).toBeGreaterThanOrEqual(plain.game.t.credits);
    expect(sharp.trade?.sharp).toBe(true);
    expect(wrong.game.t.credits).toBe(plain.game.t.credits);
    expect(wrong.answers).toEqual([{ slot: 0, right: false, answer: 42, ms: 3000 }]);
    expect(sharp.game.asked).toBe(1);
    // Skipping ahead, or reusing a question, is refused.
    expect(applyBatch(galaxy, SEED, g, [{ ...trade, ask: { slot: 5, value: 42, ms: 1 } }], DEFAULT_SETTINGS, marker(true)).ok).toBe(false);
    expect(applyBatch(galaxy, SEED, sharp.game, [{ ...trade, ask: { slot: 0, value: 42, ms: 1 } }], DEFAULT_SETTINGS, marker(true)).ok).toBe(false);
  });

  it('with maths switched off, no discount can be earned and no question is used', () => {
    const settings: Settings = { ...DEFAULT_SETTINGS, maths: false };
    const g = newGame(galaxy, 1, settings);
    const trade = { ...(buyOne(g) as Extract<Action, { type: 'trade' }>), ask: { slot: 0, value: 42, ms: 1 } };
    const r = ok(applyBatch(galaxy, SEED, g, [trade], settings, marker(true)));
    expect(r.trade?.sharp).toBe(false);
    expect(r.game.asked).toBe(0);
  });

  it('a jump uses a jump and fuel, and while something is happening nothing else can be done', () => {
    let g = newGame(galaxy, 1, DEFAULT_SETTINGS);
    let met = false;
    for (let n = 0; n < 60 && !met; n++) {
      const dests = reachable(galaxy, g.t);
      if (!dests.length || g.t.jumpsLeft < 1) g = rollDay(galaxy, { ...g, t: { ...g.t, fuel: 20 } }, g.t.day + 1, DEFAULT_SETTINGS);
      const r = ok(applyBatch(galaxy, SEED, g, [{ type: 'jump', dest: reachable(galaxy, g.t)[0] ?? 0 }], DEFAULT_SETTINGS, noMark));
      g = r.game;
      if (g.pending) {
        met = true;
        expect(applyBatch(galaxy, SEED, g, [buyOne(g)], DEFAULT_SETTINGS, noMark)).toMatchObject({ ok: false });
      }
      g = { ...g, t: { ...g.t, fuel: 20 } };
    }
    expect(met).toBe(true);
  });

  it('a new day brings the jumps back, drops a half-finished event and resets the question count', () => {
    const g = newGame(galaxy, 1, DEFAULT_SETTINGS);
    const busy: Game = { ...g, pending: { kind: 'junk' }, asked: 7, t: { ...g.t, jumpsLeft: 0 } };
    const next = rollDay(galaxy, busy, 2, DEFAULT_SETTINGS);
    expect(next.t.jumpsLeft).toBe(JUMPS_PER_DAY);
    expect(next.pending).toBeNull();
    expect(next.asked).toBe(0);
    expect(rollDay(galaxy, busy, 1, DEFAULT_SETTINGS)).toBe(busy);
  });

  it('plays a fight round by round on the server, marks the laser question, and settles the fight', () => {
    const g0 = newGame(galaxy, 1, DEFAULT_SETTINGS);
    const t = { ...g0.t, ship: 3, hull: 100, weapons: [2, 2], shields: [1] };
    let g: Game = { ...g0, t, pending: { kind: 'fight', tier: 0, fight: startFight(t, 0, 'f') } };
    const used: number[] = [];
    let last: Reply | null = null;
    for (let i = 0; i < 8 && g.pending; i++) {
      last = applyFight(g, 'charge', { slot: g.asked, value: 42, ms: 2000 }, DEFAULT_SETTINGS, marker(true, used));
      g = ok(last).game;
    }
    expect(g.pending).toBeNull();
    expect(last && last.ok && last.fight?.over).toBe(true);
    expect(g.stats.piratesBeaten).toBe(1);
    expect(g.t.credits).toBeGreaterThan(100);
    // A ship with no lasers cannot charge them.
    const bare: Game = { ...g0, pending: { kind: 'fight', tier: 0, fight: startFight(g0.t, 0, 'f') } };
    expect(applyFight(bare, 'charge', undefined, DEFAULT_SETTINGS, noMark).ok).toBe(false);
    expect(applyFight(g0, 'flee', undefined, DEFAULT_SETTINGS, noMark).ok).toBe(false);
  });

  it('the server\'s fight is the same as the shared fight rules', () => {
    const g0 = newGame(galaxy, 1, DEFAULT_SETTINGS);
    const t = { ...g0.t, ship: 3, hull: 100, weapons: [1], shields: [] };
    const start = startFight(t, 1, 'same');
    const mine = fightRound(t, start, 'charge', true);
    const g: Game = { ...g0, t, pending: { kind: 'fight', tier: 1, fight: start } };
    const r = ok(applyFight(g, 'charge', { slot: 0, value: 42, ms: 1 }, DEFAULT_SETTINGS, marker(true)));
    expect(r.fight?.fight).toEqual(mine);
  });

  it('space junk and friendly traders are settled once', () => {
    const g0 = newGame(galaxy, 1, DEFAULT_SETTINGS);
    const junk: Game = { ...g0, pending: { kind: 'junk' }, t: { ...g0.t, hull: 20 } };
    const bump = ok(applyJunk(junk, undefined, DEFAULT_SETTINGS, noMark));
    expect(bump.junk?.steeredWell).toBe(false);
    expect(bump.game.t.hull).toBe(15);
    expect(bump.game.pending).toBeNull();
    expect(applyJunk(bump.game, undefined, DEFAULT_SETTINGS, noMark).ok).toBe(false);
    const clean = ok(applyJunk(junk, { slot: 0, value: 42, ms: 1 }, DEFAULT_SETTINGS, marker(true)));
    expect(clean.game.t.hull).toBe(20);

    const offer = { kind: 'trader', good: WATER, qty: 4, sells: true, price: 3, fair: 5 } as const;
    const deal: Game = { ...g0, pending: { kind: 'deal', offer } };
    const took = ok(applyDeal(deal, true));
    expect(took.game.t.cargo[WATER]).toBe(4);
    expect(took.game.pending).toBeNull();
    expect(applyDeal(took.game, true).ok).toBe(false);
    expect(ok(applyDeal(deal, false)).game.t.cargo[WATER]).toBe(0);
    expect(GOODS[WATER]).toBe('Water');
  });
});
