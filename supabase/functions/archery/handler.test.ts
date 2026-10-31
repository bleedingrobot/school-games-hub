import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { botSetup, chooseForRun, type BotLevel } from '../../../shared/archery/bot';
import { startFight, takeShot } from '../../../shared/archery/fight';
import { CHEST_LOSS_COINS, CHEST_WIN_COINS, COINS_PER_RIGHT, DAILY_COINS, NETWORK_MS, TAP_MS, limitMs, markQuestion } from '../../../shared/archery/speed';
import type { PlayerSetup, Shot, WorldId } from '../../../shared/archery/types';
import { trialServices, type TrialData } from '../../../src/games/archery/trialBackend';
import { START_COINS } from '../../../shared/archery/shop';
import { makeHandler, type Services } from './handler';

const NOW = 1_792_000_000_000;

function setup(over: Partial<Services> = {}, opts: { enabled?: boolean } = {}) {
  const clock = { now: NOW };
  let r = 0;
  const { services, data } = trialServices({ now: () => clock.now, random: () => ((r = (r * 9301 + 49297) % 233280) / 233280), enabled: () => opts.enabled ?? true });
  const s: Services = { ...services, userIdFor: async (t) => (t === 'good-token' ? 'pupil-1' : t === 'other-token' ? 'pupil-2' : null), ...over };
  const handle = makeHandler(s);
  const send = async (body: unknown, token: string | null = 'good-token') => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await handle(new Request('http://x/archery', { method: 'POST', headers, body: JSON.stringify(body) }));
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  return { s, data, clock, send };
}

/** The right answer to a round's question (read from the pretend database, as only the server can). */
const answerOf = (data: TrialData, seed: string, slot: number) => markQuestion(data.rounds[seed].questions[slot])!.answer;

/** Gives a pupil coins directly (as a test only can). */
function giveCoins(data: TrialData, coins: number, player = 'pupil-1') {
  data.pupils[player] ??= { coins: 0, gear: {}, shields: [], bows: [], spent: 0, best: {}, rounds: [] };
  data.pupils[player].coins += coins;
}

/** Plays a whole fight honestly: the pupil's shots by a Hard bot, the bot's by its own level. Stops after `stopAfter` shots if given. */
function playFight(seed: number, world: WorldId, pack: PlayerSetup, opponent: BotLevel, stopAfter?: number): Shot[] {
  const run = startFight(seed, { world, players: [pack, botSetup(opponent)] });
  const shots: Shot[] = [];
  while (run.winner === null && (stopAfter === undefined || shots.length < stopAfter)) {
    const shot = chooseForRun(run, run.round.turn === 0 ? 'hard' : opponent).shot;
    expect(takeShot(run, shot).problem).toBeNull();
    shots.push(shot);
  }
  return shots;
}

describe('the archery server function', () => {
  it('needs a sign-in and the teacher\'s switch', async () => {
    const h = setup();
    expect((await h.send({ action: 'load' }, null)).status).toBe(401);
    expect((await h.send({ action: 'load' }, 'fake')).status).toBe(401);
    const off = setup({}, { enabled: false });
    const r = await off.send({ action: 'load' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('game-off');
    const unknown = setup({ settings: async () => null });
    expect((await unknown.send({ action: 'load' })).status).toBe(503);
    expect((await h.send({ action: 'nonsense' })).status).toBe(400);
  });

  it('loads a new pupil with 100 coins and nothing else, and the whole day\'s 600 coins still to earn', async () => {
    const h = setup();
    const r = await h.send({ action: 'load' });
    expect(r.status).toBe(200);
    expect(r.body.state).toEqual({ coins: START_COINS, gear: {}, shields: [], bows: [], spent: 0, best: {} });
    expect(START_COINS).toBe(100);
    expect(r.body.coinsLeft).toBe(600);
    expect(r.body).not.toHaveProperty('roundsLeft');
  });
});

describe('speed rounds', () => {
  it('sends one question at a time, 10 s then 9 s …, and pays 10 coins for each right answer in time', async () => {
    const h = setup();
    const start = await h.send({ action: 'round-start' });
    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ kind: 'speed', limitMs: 10_000, perRight: 10, questions: 10, earns: true, coinsLeft: 600 });
    expect(start.body.question.slot).toBe(0);
    expect(start.body.question).not.toHaveProperty('answer');
    const seed = start.body.seed as string;
    h.clock.now += 3000;
    const a = await h.send({ action: 'round-answer', seed, slot: 0, value: answerOf(h.data, seed, 0), ms: 2900 });
    expect(a.body).toMatchObject({ correct: true, coins: COINS_PER_RIGHT, total: START_COINS + COINS_PER_RIGHT, right: 1 });
    expect(a.body.next.limitMs).toBe(9_000);
    expect(a.body.next.question.slot).toBe(1);
    // A wrong answer moves on and earns nothing.
    h.clock.now += 1000;
    const b = await h.send({ action: 'round-answer', seed, slot: 1, value: answerOf(h.data, seed, 1) + 1, ms: 900 });
    expect(b.body).toMatchObject({ correct: false, coins: 0, right: 1 });
    expect(b.body.answer).toBe(answerOf(h.data, seed, 1));
    expect(h.data.answers.map((x) => x.correct)).toEqual([true, false]);
  });

  it('counts an answer sent twice once, and refuses a different second answer', async () => {
    const h = setup();
    const seed = (await h.send({ action: 'round-start' })).body.seed;
    const value = answerOf(h.data, seed, 0);
    const first = await h.send({ action: 'round-answer', seed, slot: 0, value, ms: 1000 });
    const again = await h.send({ action: 'round-answer', seed, slot: 0, value, ms: 1000 });
    expect(again.status).toBe(200);
    expect(again.body.correct).toBe(true);
    expect(again.body.next).toEqual(first.body.next);
    expect(h.data.pupils['pupil-1'].coins).toBe(START_COINS + COINS_PER_RIGHT);
    expect(h.data.answers).toHaveLength(1);
    expect((await h.send({ action: 'round-answer', seed, slot: 0, value: value + 3, ms: 1000 })).status).toBe(400);
  });

  it('refuses a question that has not been sent yet, and another pupil\'s round', async () => {
    const h = setup();
    const seed = (await h.send({ action: 'round-start' })).body.seed;
    expect((await h.send({ action: 'round-answer', seed, slot: 1, value: 1, ms: 100 })).status).toBe(400);
    expect((await h.send({ action: 'round-answer', seed, slot: 0, value: 1, ms: 100 }, 'other-token')).status).toBe(400);
    expect((await h.send({ action: 'round-answer', seed: 'nope', slot: 0, value: 1, ms: 100 })).status).toBe(400);
  });

  it('checks the timer twice: the screen\'s measure, and the server\'s own clock (with room for slow wi-fi)', async () => {
    const h = setup();
    const seed = (await h.send({ action: 'round-start' })).body.seed;
    // Late on the pupil's own screen: right, recorded, but no coins.
    h.clock.now += 10_500;
    const late = await h.send({ action: 'round-answer', seed, slot: 0, value: answerOf(h.data, seed, 0), ms: 10_000 + TAP_MS + 1 });
    expect(late.body).toMatchObject({ correct: true, coins: 0 });
    expect(h.data.answers[0].correct).toBe(true);
    // Quick on the screen, but the server sent it long ago (someone sat on it): no coins.
    h.clock.now += limitMs(1) + NETWORK_MS + 1;
    const sat = await h.send({ action: 'round-answer', seed, slot: 1, value: answerOf(h.data, seed, 1), ms: 500 });
    expect(sat.body).toMatchObject({ correct: true, coins: 0 });
    // Slow wi-fi: the server's clock says a little over the limit, but within the allowance: coins.
    h.clock.now += limitMs(2) + NETWORK_MS - 100;
    const slow = await h.send({ action: 'round-answer', seed, slot: 2, value: answerOf(h.data, seed, 2), ms: limitMs(2) - 100 });
    expect(slow.body).toMatchObject({ correct: true, coins: COINS_PER_RIGHT });
  });

  it('a timed-out question earns nothing and is not recorded', async () => {
    const h = setup();
    const seed = (await h.send({ action: 'round-start' })).body.seed;
    h.clock.now += 10_000;
    const r = await h.send({ action: 'round-answer', seed, slot: 0, timedOut: true });
    expect(r.body).toMatchObject({ correct: false, coins: 0 });
    expect(r.body.next.question.slot).toBe(1);
    expect(h.data.answers).toHaveLength(0);
  });

  it('a perfect round earns 140 coins (100 and a 5 bonus from the 3rd right in a row) and a point; once 600 coins are earned in a day, rounds are practice', async () => {
    const h = setup();
    const rounds = 6;
    for (let round = 0; round < rounds; round++) {
      const start = await h.send({ action: 'round-start' });
      // Rounds 1-5 start under 600 coins (0, 140, 280, 420, 560); the 6th starts at 700.
      expect(start.body.earns).toBe(round < 5);
      expect(start.body.coinsLeft).toBe(Math.max(0, DAILY_COINS - round * 140));
      const seed = start.body.seed;
      let last: Record<string, any> = {};
      // Spread out, so the requests stay under the per-minute limit.
      h.clock.now += 6000;
      for (let slot = 0; slot < start.body.questions; slot++) {
        h.clock.now += 700;
        last = (await h.send({ action: 'round-answer', seed, slot, value: answerOf(h.data, seed, slot), ms: 400 })).body;
      }
      expect(last.next).toBeNull();
      expect(last.right).toBe(10);
      expect(last.point).toBe(true);
    }
    expect(h.data.pupils['pupil-1'].coins).toBe(START_COINS + 5 * 140);
    expect(h.data.points).toHaveLength(rounds);
    expect(h.data.answers).toHaveLength(rounds * 10);
    expect((await h.send({ action: 'load' })).body.coinsLeft).toBe(0);
    // A day later, coins again.
    h.clock.now += 24 * 3600 * 1000 + 1;
    const next = await h.send({ action: 'round-start' });
    expect(next.body.earns).toBe(true);
    expect(next.body.coinsLeft).toBe(DAILY_COINS);
  });

  it('gives 10 s, then 9 s … down to 5 s, and stays at 5 s; the streak bonus starts on the 3rd right in a row', async () => {
    const h = setup();
    const start = await h.send({ action: 'round-start' });
    const seed = start.body.seed;
    const limits = [start.body.limitMs];
    const coins: number[] = [];
    for (let slot = 0; slot < 10; slot++) {
      h.clock.now += 700;
      const r = await h.send({ action: 'round-answer', seed, slot, value: answerOf(h.data, seed, slot), ms: 400 });
      coins.push(r.body.coins);
      if (r.body.next) limits.push(r.body.next.limitMs);
    }
    expect(limits).toEqual([10, 9, 8, 7, 6, 5, 5, 5, 5, 5].map((n) => n * 1000));
    expect(coins).toEqual([10, 10, 15, 15, 15, 15, 15, 15, 15, 15]);
  });

  it('a wrong answer breaks the streak, and the next right ones start it again', async () => {
    const h = setup();
    const start = await h.send({ action: 'round-start' });
    const seed = start.body.seed;
    const coins: number[] = [];
    for (let slot = 0; slot < 6; slot++) {
      h.clock.now += 700;
      const value = answerOf(h.data, seed, slot) + (slot === 3 ? 1 : 0);
      coins.push((await h.send({ action: 'round-answer', seed, slot, value, ms: 400 })).body.coins);
    }
    expect(coins).toEqual([10, 10, 15, 0, 10, 10]);
  });

  it('with the day\'s 600 coins already earned, the next set is practice: right answers earn nothing', async () => {
    const h = setup();
    await h.send({ action: 'load' });
    h.data.pupils['pupil-1'].rounds.push({ at: NOW - 1000, earns: true, coins: DAILY_COINS });
    const start = await h.send({ action: 'round-start' });
    expect(start.body).toMatchObject({ earns: false, coinsLeft: 0 });
    h.clock.now += 700;
    const r = await h.send({ action: 'round-answer', seed: start.body.seed, slot: 0, value: answerOf(h.data, start.body.seed, 0), ms: 400 });
    expect(r.body).toMatchObject({ correct: true, coins: 0 });
    expect(h.data.pupils['pupil-1'].coins).toBe(START_COINS);
    expect(h.data.answers).toHaveLength(1);
  });
});

describe('the Armory', () => {
  it('buys with the shop\'s own prices, never more than you have, and a purchase sent twice counts once', async () => {
    const h = setup();
    // A new pupil has 100 coins: not enough for the 150-coin Longbow.
    expect((await h.send({ action: 'buy', request: 'req-000001', kind: 'bow', item: 'long' })).body.result).toBe('coins');
    giveCoins(h.data, 120);
    const r = await h.send({ action: 'buy', request: 'req-000002', kind: 'gear', item: 'steel', price: 0 });
    expect(r.body.result).toBe('ok');
    expect(r.body.state).toMatchObject({ coins: 195, gear: { steel: 2 }, spent: 25 });
    const again = await h.send({ action: 'buy', request: 'req-000002', kind: 'gear', item: 'steel' });
    expect(again.body).toEqual(r.body);
    expect(h.data.pupils['pupil-1'].coins).toBe(195);
    expect((await h.send({ action: 'buy', request: 'req-000003', kind: 'gear', item: 'plain' })).status).toBe(400);
    expect((await h.send({ action: 'buy', request: 'req-000004', kind: 'gear', item: 'nonsense' })).status).toBe(400);
    expect((await h.send({ action: 'buy', request: 'x', kind: 'gear', item: 'steel' })).status).toBe(400);
  });

  it('opens the higher levels as you spend, and sells back for half', async () => {
    const h = setup();
    giveCoins(h.data, 5000);
    expect((await h.send({ action: 'buy', request: 'req-000010', kind: 'gear', item: 'glass' })).body.result).toBe('level');
    expect((await h.send({ action: 'buy', request: 'req-000012', kind: 'shield', item: 'bubble' })).body.result).toBe('level');
    expect((await h.send({ action: 'buy', request: 'req-000011', kind: 'bow', item: 'golden' })).body.result).toBe('ok');
    expect((await h.send({ action: 'buy', request: 'req-000013', kind: 'bow', item: 'recurve' })).body.result).toBe('ok');
    expect((await h.send({ action: 'buy', request: 'req-000014', kind: 'bow', item: 'long' })).body.result).toBe('ok');
    expect((await h.send({ action: 'buy', request: 'req-000015', kind: 'bow', item: 'hunter' })).body.result).toBe('ok');
    // 300 + 200 + 150 + 125 = 775 spent, then the Bubble Shield (level 3, 125): 900, level 4.
    expect((await h.send({ action: 'buy', request: 'req-000016', kind: 'shield', item: 'bubble' })).body.result).toBe('ok');
    // 900 spent: still level 4, so no Glass Arrow yet (level 5 at 1,000).
    expect((await h.send({ action: 'buy', request: 'req-000020', kind: 'gear', item: 'glass' })).body.result).toBe('level');
    expect((await h.send({ action: 'buy', request: 'req-000021', kind: 'shield', item: 'charm' })).body.result).toBe('ok');
    // 975: one purchase of two Steel Arrows (25) makes 1,000, level 5.
    expect((await h.send({ action: 'buy', request: 'req-000022', kind: 'gear', item: 'steel' })).body.result).toBe('ok');
    expect((await h.send({ action: 'buy', request: 'req-000017', kind: 'gear', item: 'glass' })).body.result).toBe('ok');
    const sold = await h.send({ action: 'sell', request: 'req-000018', kind: 'gear', item: 'glass' });
    expect(sold.body.result).toBe('ok');
    expect(sold.body.state.coins).toBe(5000 - 300 - 200 - 150 - 125 - 125 - 75 - 25 - 250 + 125);
    expect((await h.send({ action: 'sell', request: 'req-000019', kind: 'gear', item: 'glass' })).body.result).toBe('none');
  });
});

describe('fights against bots', () => {
  const pack: PlayerSetup = { quiver: { steel: 2, apple: 1 }, shield: null, bow: 'starter' };

  async function ready() {
    const h = setup();
    giveCoins(h.data, 1000);
    await h.send({ action: 'buy', request: 'req-000100', kind: 'gear', item: 'steel' });
    await h.send({ action: 'buy', request: 'req-000101', kind: 'gear', item: 'apple' });
    return h;
  }

  it('takes the packed quiver out of the bag, and refuses gear you don\'t have', async () => {
    const h = await ready();
    const no = await h.send({ action: 'fight-start', request: 'fight-00001', world: 'forest', opponent: 'easy', pack: { quiver: { giant: 1 } } });
    expect(no.status).toBe(400);
    expect(no.body.code).toBe('gear');
    const r = await h.send({ action: 'fight-start', request: 'fight-00002', world: 'forest', opponent: 'easy', pack });
    expect(r.status).toBe(200);
    expect(r.body.state.gear).toEqual({});
    expect(Number.isInteger(r.body.seed)).toBe(true);
    // Sent twice: the same fight, nothing taken twice.
    const again = await h.send({ action: 'fight-start', request: 'fight-00002', world: 'forest', opponent: 'easy', pack });
    expect(again.body.fight).toBe(r.body.fight);
    expect(again.body.seed).toBe(r.body.seed);
  });

  it('replays a finished fight, gives back what wasn\'t used, keeps a best score, and gives points once', async () => {
    const h = await ready();
    const start = await h.send({ action: 'fight-start', request: 'fight-00010', world: 'desert', opponent: 'easy', pack });
    const shots = playFight(start.body.seed, 'desert', pack, 'easy');
    const done = await h.send({ action: 'fight-finish', fight: start.body.fight, shots });
    expect(done.status).toBe(200);
    expect(done.body.result).toBe('ok');
    expect(done.body.points).toBe(done.body.winner === 0 ? 3 : 2);
    expect(done.body.best).toBe(true);
    expect(done.body.state.best.desert).toBe(done.body.score);
    const steelShot = shots.filter((s, i) => s.arrow === 'steel' && i % 2 === 0).length;
    expect(done.body.state.gear.steel ?? 0).toBe(2 - steelShot);
    expect(h.data.points).toEqual([{ player: 'pupil-1', points: done.body.points, once: `archery-fight:${start.body.fight}` }]);
    const twice = await h.send({ action: 'fight-finish', fight: start.body.fight, shots });
    expect(twice.body.result).toBe('duplicate');
    expect(twice.body.points).toBe(0);
    expect(h.data.points).toHaveLength(1);
  });

  it('refuses a fight with a made-up bot shot, one that hasn\'t ended, and someone else\'s fight', async () => {
    const h = await ready();
    const start = await h.send({ action: 'fight-start', request: 'fight-00020', world: 'snow', opponent: 'hard', pack });
    const shots = playFight(start.body.seed, 'snow', pack, 'hard');
    // The bot's first shot changed to a wild miss.
    const fake = shots.map((s, i) => (i === 1 ? { ...s, power: (s.power + 30) % 101 } : s));
    expect((await h.send({ action: 'fight-finish', fight: start.body.fight, shots: fake })).status).toBe(400);
    expect((await h.send({ action: 'fight-finish', fight: start.body.fight, shots: shots.slice(0, 4) })).status).toBe(400);
    expect((await h.send({ action: 'fight-finish', fight: start.body.fight, shots }, 'other-token')).status).toBe(400);
    expect((await h.send({ action: 'fight-finish', fight: start.body.fight, shots: 'nope' })).status).toBe(400);
  });

  it('a fight given up part-way gives back the unused gear and no points', async () => {
    const h = await ready();
    const start = await h.send({ action: 'fight-start', request: 'fight-00030', world: 'city', opponent: 'medium', pack });
    const shots = playFight(start.body.seed, 'city', pack, 'medium', 6);
    const r = await h.send({ action: 'fight-finish', fight: start.body.fight, shots, left: true });
    expect(r.status).toBe(200);
    expect(r.body.points).toBe(0);
    const usedSteel = shots.filter((s, i) => s.arrow === 'steel' && i % 2 === 0).length;
    expect(r.body.state.gear.steel ?? 0).toBe(2 - usedSteel);
    expect(h.data.points).toHaveLength(0);
  });

  it('starting a new fight gives up an open one, and its gear comes back first', async () => {
    const h = await ready();
    await h.send({ action: 'fight-start', request: 'fight-00040', world: 'city', opponent: 'medium', pack });
    const second = await h.send({ action: 'fight-start', request: 'fight-00041', world: 'forest', opponent: 'easy', pack });
    expect(second.status).toBe(200);
    expect(Object.values(h.data.fights).map((f) => f.status)).toEqual(['abandoned', 'playing']);
  });
});

describe('loot chests and restocks', () => {
  const plainOnly: PlayerSetup = { quiver: {}, shield: null, bow: 'starter' };
  type H = ReturnType<typeof setup>;
  let n = 0;

  /** Plays a whole fight until it ends the way we want (won or lost), or gives up part-way when `left`. */
  async function fightEnded(h: H, want: 'won' | 'lost' | 'left') {
    for (let tries = 0; tries < 20; tries++) {
      h.clock.now += 60_000;
      const start = await h.send({ action: 'fight-start', request: `chest-${String(++n).padStart(5, '0')}`, world: 'forest', opponent: 'hard', pack: plainOnly });
      const fight = start.body.fight as number;
      if (want === 'left') {
        await h.send({ action: 'fight-finish', fight, shots: playFight(start.body.seed, 'forest', plainOnly, 'hard', 4), left: true });
        return fight;
      }
      const done = await h.send({ action: 'fight-finish', fight, shots: playFight(start.body.seed, 'forest', plainOnly, 'hard') });
      if ((done.body.winner === 0) === (want === 'won')) return fight;
    }
    throw new Error(`no ${want} fight in 20 tries`);
  }

  /** Answers a set's questions all right and quickly; the coins each earned. */
  async function answerAll(h: H, start: Record<string, any>, wrongAt: number | null = null) {
    const coins: number[] = [];
    for (let slot = 0; slot < start.questions; slot++) {
      h.clock.now += 700;
      const value = answerOf(h.data, start.seed, slot) + (slot === wrongAt ? 1 : 0);
      coins.push((await h.send({ action: 'round-answer', seed: start.seed, slot, value, ms: 400 })).body.coins);
    }
    return coins;
  }

  it('a chest after a won fight pays 20 a right and a 5 bonus on the 3rd: a perfect chest is 65', async () => {
    const h = setup();
    const fight = await fightEnded(h, 'won');
    const before = h.data.pupils['pupil-1'].coins;
    const start = await h.send({ action: 'round-start', kind: 'chest', fight });
    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ kind: 'chest', perRight: CHEST_WIN_COINS, questions: 3, limitMs: 10_000, earns: true });
    expect(await answerAll(h, start.body)).toEqual([20, 20, 25]);
    expect(h.data.pupils['pupil-1'].coins).toBe(before + 65);
    // A chest isn't a speed round: no round point.
    expect(h.data.points.filter((p) => p.once.startsWith('archery-round'))).toEqual([]);
  });

  it('a chest after a lost fight pays 10 a right', async () => {
    const h = setup();
    const fight = await fightEnded(h, 'lost');
    const start = await h.send({ action: 'round-start', kind: 'chest', fight });
    expect(start.body.perRight).toBe(CHEST_LOSS_COINS);
    // The 2nd is wrong: 10, 0, then only one in a row, so no bonus.
    expect(await answerAll(h, start.body, 1)).toEqual([10, 0, 10]);
    const second = await h.send({ action: 'round-start', kind: 'chest', fight: await fightEnded(h, 'lost') });
    expect(await answerAll(h, second.body)).toEqual([10, 10, 15]);
  });

  it('a chest opens once only', async () => {
    const h = setup();
    const fight = await fightEnded(h, 'won');
    expect((await h.send({ action: 'round-start', kind: 'chest', fight })).status).toBe(200);
    const again = await h.send({ action: 'round-start', kind: 'chest', fight });
    expect(again.status).toBe(400);
    expect(again.body.code).toBe('closed');
  });

  it('a chest is refused for a fight still playing, one given up, someone else\'s, or one that doesn\'t exist', async () => {
    const h = setup();
    const start = await h.send({ action: 'fight-start', request: 'chest-playing', world: 'city', opponent: 'easy', pack: plainOnly });
    const playing = await h.send({ action: 'round-start', kind: 'chest', fight: start.body.fight });
    expect(playing.status).toBe(400);
    expect(playing.body.code).toBe('closed');
    const left = await fightEnded(h, 'left');
    expect((await h.send({ action: 'round-start', kind: 'chest', fight: left })).body.code).toBe('closed');
    const won = await fightEnded(h, 'won');
    expect((await h.send({ action: 'round-start', kind: 'chest', fight: won }, 'other-token')).body.code).toBe('closed');
    expect((await h.send({ action: 'round-start', kind: 'chest', fight: 999 })).body.code).toBe('closed');
    // No fight or duel named at all: not read.
    const none = await h.send({ action: 'round-start', kind: 'chest' });
    expect(none.status).toBe(400);
    expect(none.body.code).toBeUndefined();
  });

  it('a chest is only open for an hour after the fight', async () => {
    const h = setup();
    const fight = await fightEnded(h, 'won');
    h.clock.now += 3600_000 + 1;
    expect((await h.send({ action: 'round-start', kind: 'chest', fight })).body.code).toBe('closed');
  });

  it('a restock during a fight works for steps 1 to 4, once each, and pays 10 a right with the streak bonus', async () => {
    const h = setup();
    const start = await h.send({ action: 'fight-start', request: 'restock-01', world: 'city', opponent: 'easy', pack: plainOnly });
    const fight = start.body.fight as number;
    const r = await h.send({ action: 'round-start', kind: 'restock', fight, step: 1 });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ kind: 'restock', perRight: COINS_PER_RIGHT, questions: 3, limitMs: 10_000 });
    expect(await answerAll(h, r.body)).toEqual([10, 10, 15]);
    const twice = await h.send({ action: 'round-start', kind: 'restock', fight, step: 1 });
    expect(twice.status).toBe(400);
    expect(twice.body.code).toBe('closed');
    expect((await h.send({ action: 'round-start', kind: 'restock', fight, step: 2 })).status).toBe(200);
    expect((await h.send({ action: 'round-start', kind: 'restock', fight, step: 4 })).status).toBe(200);
    for (const step of [0, 5, 1.5, 'x']) expect((await h.send({ action: 'round-start', kind: 'restock', fight, step })).status, String(step)).toBe(400);
    expect((await h.send({ action: 'round-start', kind: 'restock', fight })).status).toBe(400);
  });

  it('a restock is refused once the fight is over', async () => {
    const h = setup();
    const fight = await fightEnded(h, 'won');
    const r = await h.send({ action: 'round-start', kind: 'restock', fight, step: 1 });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('closed');
  });

  it('when the day\'s 600 coins are earned, a chest is practice: no coins', async () => {
    const h = setup();
    const fight = await fightEnded(h, 'won');
    h.data.pupils['pupil-1'].rounds.push({ at: h.clock.now, earns: true, coins: DAILY_COINS });
    const before = h.data.pupils['pupil-1'].coins;
    const start = await h.send({ action: 'round-start', kind: 'chest', fight });
    expect(start.body.earns).toBe(false);
    expect(await answerAll(h, start.body)).toEqual([0, 0, 0]);
    expect(h.data.pupils['pupil-1'].coins).toBe(before);
  });

  it('refuses an unknown kind', async () => {
    const h = setup();
    expect((await h.send({ action: 'round-start', kind: 'bonus' })).status).toBe(400);
  });
});

describe('achievement counts (Stage 7)', () => {
  const plainOnly: PlayerSetup = { quiver: {}, shield: null, bow: 'starter' };

  it('a won bot fight counts a win in its world, a Plain-only win and a win against Hawk, once; a lost one counts nothing', async () => {
    const h = setup();
    const seen = { won: false, lost: false };
    for (let n = 0; n < 12 && !(seen.won && seen.lost); n++) {
      h.clock.now += 60_000;
      const start = await h.send({ action: 'fight-start', request: `fight-1${String(n).padStart(4, '0')}`, world: 'snow', opponent: 'hard', pack: plainOnly });
      const shots = playFight(start.body.seed, 'snow', plainOnly, 'hard');
      const before = JSON.stringify(h.data.stats ?? {});
      const done = await h.send({ action: 'fight-finish', fight: start.body.fight, shots });
      if (done.body.winner === 0) {
        if (seen.won) continue;
        seen.won = true;
        expect(h.data.stats?.['pupil-1']).toEqual({ win_snow: 1, plain_wins: 1, hawk_wins: 1 });
        await h.send({ action: 'fight-finish', fight: start.body.fight, shots });
        expect(h.data.stats?.['pupil-1']).toEqual({ win_snow: 1, plain_wins: 1, hawk_wins: 1 });
      } else {
        seen.lost = true;
        expect(JSON.stringify(h.data.stats ?? {})).toBe(before);
      }
    }
    expect(seen).toEqual({ won: true, lost: true });
  });

  it('a win with a special arrow isn\'t a Plain-only win, and Pip isn\'t Hawk', async () => {
    const h = setup();
    giveCoins(h.data, 1000);
    h.data.pupils['pupil-1'].spent = 1000;
    expect((await h.send({ action: 'buy', request: 'req-000200', kind: 'gear', item: 'giant' })).body.result).toBe('ok');
    const pack: PlayerSetup = { quiver: { giant: 1 }, shield: null, bow: 'starter' };
    for (let n = 0; n < 8 && !h.data.stats?.['pupil-1']; n++) {
      h.clock.now += 60_000;
      const start = await h.send({ action: 'fight-start', request: `fight-2${String(n).padStart(4, '0')}`, world: 'city', opponent: 'easy', pack });
      // The Giant Arrow first, then Plain Arrows chosen by a Hard bot.
      const run = startFight(start.body.seed, { world: 'city', players: [pack, botSetup('easy')] });
      const shots: Shot[] = [];
      while (run.winner === null) {
        const mine = run.round.turn === 0;
        const shot = mine && !shots.length ? { ...chooseForRun(run, 'hard').shot, arrow: 'giant' as const } : chooseForRun(run, mine ? 'hard' : 'easy').shot;
        takeShot(run, shot);
        shots.push(shot);
      }
      await h.send({ action: 'fight-finish', fight: start.body.fight, shots });
    }
    expect(h.data.stats?.['pupil-1']).toEqual({ win_city: 1 });
  });

  it('a perfect speed round counts once; a round with one answer too slow for coins doesn\'t', async () => {
    const h = setup();
    async function round(slowAt: number | null) {
      const start = await h.send({ action: 'round-start' });
      const seed = start.body.seed;
      h.clock.now += 6000;
      for (let slot = 0; slot < start.body.questions; slot++) {
        const late = slot === slowAt;
        h.clock.now += late ? limitMs(slot) + NETWORK_MS + 500 : 700;
        await h.send({ action: 'round-answer', seed, slot, value: answerOf(h.data, seed, slot), ms: late ? limitMs(slot) + TAP_MS + 100 : 400 });
      }
      return seed;
    }
    await round(4);
    expect(h.data.stats ?? {}).toEqual({});
    const seed = await round(null);
    expect(h.data.stats?.['pupil-1']).toEqual({ perfect_rounds: 1 });
    expect(h.data.noted).toEqual([`pupil-1:stats:round:${seed}`]);
  });

  it('buying a bow checks the achievements (Every bow is counted from the bows you own)', async () => {
    const h = setup();
    giveCoins(h.data, 1000);
    h.data.pupils['pupil-1'].spent = 1000;
    await h.send({ action: 'buy', request: 'req-000300', kind: 'gear', item: 'steel' });
    expect(h.data.noted ?? []).toEqual([]);
    expect((await h.send({ action: 'buy', request: 'req-000301', kind: 'bow', item: 'long' })).body.result).toBe('ok');
    expect(h.data.noted).toEqual(['pupil-1:stats:buy:req-000301']);
  });
});

describe('index.ts', () => {
  it('is up to date (run npm run build:functions -- archery)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('archery');
    expect(readFileSync(resolve('supabase/functions/archery/index.ts'), 'utf8')).toBe(built);
  });
});
