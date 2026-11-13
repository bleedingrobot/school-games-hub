import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { botSetup, chooseForRun, type BotLevel } from '../../../shared/archery/bot';
import { startFight, takeShot } from '../../../shared/archery/fight';
import { COINS_PER_RIGHT, markQuestion } from '../../../shared/archery/speed';
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

});

describe('speed rounds', () => {

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







});

describe('the Armory', () => {
  it('buys with the shop\'s own prices, never more than you have, and a purchase sent twice counts once (arrows half price on Discount day)', async () => {
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
    expect((await h.send({ action: 'load' })).body.discount).toBe(false);

    // The teacher's Discount day: every arrow half price (rounded down), selling gives back half of that, helpers unchanged.
    const d = setup({ settings: async () => ({ on: true, duels: true, discount: true }) });
    expect((await d.send({ action: 'load' })).body.discount).toBe(true);
    const steel = await d.send({ action: 'buy', request: 'req-000010', kind: 'gear', item: 'steel' });
    expect(steel.body.state).toMatchObject({ coins: 88, gear: { steel: 2 }, spent: 12 });
    const apple = await d.send({ action: 'buy', request: 'req-000011', kind: 'gear', item: 'apple' });
    expect(apple.body.state).toMatchObject({ coins: 63, spent: 37 });
    const sold = await d.send({ action: 'sell', request: 'req-000012', kind: 'gear', item: 'steel' });
    expect(sold.body.state.coins).toBe(66);
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





});

describe('index.ts', () => {
  it('is up to date (run npm run build:functions -- archery)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('archery');
    expect(readFileSync(resolve('supabase/functions/archery/index.ts'), 'utf8')).toBe(built);
  });
});
