import { describe, expect, it } from 'vitest';
import { botSetup, chooseForRun, type BotLevel } from '../../../shared/archery/bot';
import { startFight, takeShot } from '../../../shared/archery/fight';
import type { PlayerSetup, Shot, WorldId } from '../../../shared/archery/types';
import { trialServices, type TrialData } from '../../../src/games/archery/trialBackend';
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

/** Gives a pupil coins directly (as a test only can). */
function giveCoins(data: TrialData, coins: number, player = 'pupil-1') {
  data.pupils[player] ??= { coins: 0, gear: {}, shields: [], bows: [], spent: 0, best: {}, rounds: [] };
  data.pupils[player].coins += coins;
}

/** Plays a whole fight honestly: the pupil's shots by a Hard bot, the bot's by its own level. */
function playFight(seed: number, world: WorldId, pack: PlayerSetup, opponent: BotLevel): Shot[] {
  const run = startFight(seed, { world, players: [pack, botSetup(opponent)] });
  const shots: Shot[] = [];
  while (run.winner === null) {
    const shot = chooseForRun(run, run.round.turn === 0 ? 'hard' : opponent).shot;
    expect(takeShot(run, shot).problem).toBeNull();
    shots.push(shot);
  }
  return shots;
}

describe('the archery server function', () => {
  it('needs a sign-in and the teacher\'s switch, and refuses another pupil\'s round or a question not sent yet', async () => {
    const h = setup();
    expect((await h.send({ action: 'load' }, null)).status).toBe(401);
    expect((await h.send({ action: 'load' }, 'fake')).status).toBe(401);
    const off = setup({}, { enabled: false });
    const r = await off.send({ action: 'load' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('game-off');
    const seed = (await h.send({ action: 'round-start' })).body.seed;
    expect((await h.send({ action: 'round-answer', seed, slot: 1, value: 1, ms: 100 })).status).toBe(400);
    expect((await h.send({ action: 'round-answer', seed, slot: 0, value: 1, ms: 100 }, 'other-token')).status).toBe(400);
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

  it('refuses a made-up bot shot or someone else\'s fight, and gives points for a real finished fight once', async () => {
    const h = await ready();
    const start = await h.send({ action: 'fight-start', request: 'fight-00020', world: 'snow', opponent: 'hard', pack });
    const shots = playFight(start.body.seed, 'snow', pack, 'hard');
    // The bot's first shot changed to a wild miss.
    const fake = shots.map((s, i) => (i === 1 ? { ...s, power: (s.power + 30) % 101 } : s));
    expect((await h.send({ action: 'fight-finish', fight: start.body.fight, shots: fake })).status).toBe(400);
    expect((await h.send({ action: 'fight-finish', fight: start.body.fight, shots }, 'other-token')).status).toBe(400);
    const done = await h.send({ action: 'fight-finish', fight: start.body.fight, shots });
    expect(done.body.result).toBe('ok');
    expect(done.body.points).toBe(done.body.winner === 0 ? 3 : 2);
    const twice = await h.send({ action: 'fight-finish', fight: start.body.fight, shots });
    expect(twice.body.result).toBe('duplicate');
    expect(h.data.points).toHaveLength(1);
  });
});

