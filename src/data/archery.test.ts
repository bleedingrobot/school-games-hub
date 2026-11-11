import { beforeEach, describe, expect, it, vi } from 'vitest';
import { botSetup, chooseForRun } from '../../shared/archery/bot';
import { startFight, takeShot } from '../../shared/archery/fight';
import type { Shot } from '../../shared/archery/types';
import { trialBackend } from '../games/archery/trialBackend';

vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
const { archeryApi } = await import('./archery');

beforeEach(() => localStorage.clear());

describe('archery data', () => {

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
});
