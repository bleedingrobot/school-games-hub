import { beforeEach, describe, expect, it, vi } from 'vitest';
import { botSetup, chooseForRun } from '../../shared/archery/bot';
import { startFight, takeShot } from '../../shared/archery/fight';
import { markQuestion } from '../../shared/archery/speed';
import type { Shot } from '../../shared/archery/types';
import { trialBackend } from '../games/archery/trialBackend';

vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
const { archeryApi, serverTransport } = await import('./archery');

beforeEach(() => localStorage.clear());

describe('archery data', () => {
  it('earns coins in a speed round, buys, fights and finishes through the same requests as the server', async () => {
    const trial = trialBackend();
    const api = archeryApi((b) => trial.send(b));
    const load = await api.load();
    expect(load.ok && load.value.roundsLeft).toBe(8);
    const start = await api.roundStart();
    if (!start.ok) throw new Error(start.message);
    let q: { slot: number } | null = start.value.question;
    while (q) {
      const right = markQuestion(trial.data.rounds[start.value.seed].questions[q.slot])!.answer;
      const r = await api.roundAnswer(start.value.seed, q.slot, right, 300);
      if (!r.ok) throw new Error(r.message);
      q = r.value.next ? r.value.next.question : null;
    }
    expect(trial.data.pupils['preview-pupil'].coins).toBe(100);
    const bought = await api.shop('buy', 'gear', 'steel');
    expect(bought.ok && bought.value.state).toMatchObject({ coins: 50, gear: { steel: 2 } });
    const pack = { quiver: { steel: 2 }, shield: null, bow: 'starter' as const };
    const fight = await api.fightStart('forest', 'easy', pack);
    if (!fight.ok) throw new Error(fight.message);
    const run = startFight(fight.value.seed, { world: 'forest', players: [pack, botSetup('easy')] });
    const shots: Shot[] = [];
    while (run.winner === null) {
      const s = chooseForRun(run, run.round.turn === 0 ? 'hard' : 'easy').shot;
      takeShot(run, s);
      shots.push(s);
    }
    const end = await api.fightFinish(fight.value.fight, shots);
    expect(end.ok).toBe(true);
    if (end.ok) expect(end.value.points).toBeGreaterThanOrEqual(2);
  });

  it('keeps a finish on this device while the server can\'t be reached, and sends it later', async () => {
    const trial = trialBackend();
    let online = true;
    const api = archeryApi((b) => (online ? trial.send(b) : Promise.resolve(null)), 'pupil-x');
    trial.data.pupils['preview-pupil'] = { coins: 0, gear: {}, shields: [], bows: [], spent: 0, best: {}, rounds: [] };
    const pack = { quiver: {}, shield: null, bow: 'starter' as const };
    const fight = await api.fightStart('city', 'easy', pack);
    if (!fight.ok) throw new Error(fight.message);
    const run = startFight(fight.value.seed, { world: 'city', players: [pack, botSetup('easy')] });
    const shots: Shot[] = [];
    for (let i = 0; i < 4; i++) {
      const s = chooseForRun(run, run.round.turn === 0 ? 'hard' : 'easy').shot;
      takeShot(run, s);
      shots.push(s);
    }
    online = false;
    const r = await api.fightFinish(fight.value.fight, shots, true);
    expect(r).toMatchObject({ ok: false, why: 'queued' });
    expect(api.queued()).toBe(1);
    expect(await api.flush()).toBe('later');
    online = true;
    expect(await api.flush()).toBe('done');
    expect(api.queued()).toBe(0);
    expect(Object.values(trial.data.fights)[0].status).toBe('left');
  });

  it('says plainly when the game is switched off, or nobody is signed in', async () => {
    const trial = trialBackend({ enabled: () => false });
    const r = await archeryApi((b) => trial.send(b)).load();
    expect(r).toMatchObject({ ok: false, why: 'game-off' });
    expect(await serverTransport({ action: 'load' })).toBeNull();
  });
});
