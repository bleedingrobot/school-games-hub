import { describe, expect, it } from 'vitest';
import type { PlayerSetup } from '../../../shared/archery/types';
import { trialHub, type TrialPupil } from '../../../src/games/archery/trialBackend';

const NOW = 1_792_000_000_000;
const ANA = 'aaaaaaaa-0000-4000-8000-000000000001';
const BEN = 'bbbbbbbb-0000-4000-8000-000000000002';
const CAT = 'cccccccc-0000-4000-8000-000000000003'; // another class
const DAN = 'dddddddd-0000-4000-8000-000000000004'; // another school
const EVA = 'eeeeeeee-0000-4000-8000-000000000005'; // Ana's class, never opens the game
const PUPILS: Record<string, TrialPupil> = {
  [ANA]: { name: 'Speedy Otter 1', classId: 'room-1', school: 1 },
  [BEN]: { name: 'Brave Kiwi 2', classId: 'room-1', school: 1 },
  [CAT]: { name: 'Calm Tui 3', classId: 'room-2', school: 1 },
  [DAN]: { name: 'Daring Weka 4', classId: 'room-1', school: 2 },
  [EVA]: { name: 'Eager Kea 5', classId: 'room-1', school: 1 },
};

const ANA_PACK: PlayerSetup = { quiver: { steel: 2, apple: 1 }, shield: 'wood', bow: 'starter' };
const BEN_PACK: PlayerSetup = { quiver: { giant: 1 }, shield: null, bow: 'starter' };

function setup() {
  const clock = { now: NOW };
  let r = 0;
  const hub = trialHub({
    now: () => clock.now, random: () => ((r = (r * 9301 + 49297) % 233280) / 233280), pupils: PUPILS,
  });
  const data = hub.data;
  for (const id of [ANA, BEN, CAT, DAN]) {
    data.pupils[id] = { coins: 0, gear: { steel: 3, apple: 2, giant: 1 }, shields: ['wood'], bows: [], spent: 0, best: {}, rounds: [] };
    hub.here(id);
  }
  const send = (who: string, body: Record<string, unknown>) => hub.sendAs<Record<string, any>>(who, body);
  let n = 0;
  const req = () => `request-${String(++n).padStart(4, '0')}`;
  /** Ana challenges Ben, Ben says yes, both pack: the fight starts. */
  async function started(world = 'forest') {
    const c = await send(ANA, { action: 'duel-challenge', request: req(), other: BEN, world });
    expect(c.status).toBe(200);
    const id = c.body.duel.id as number;
    expect((await send(BEN, { action: 'duel-answer', duel: id, accept: true })).status).toBe(200);
    expect((await send(ANA, { action: 'duel-pack', duel: id, pack: ANA_PACK })).status).toBe(200);
    const b = await send(BEN, { action: 'duel-pack', duel: id, pack: BEN_PACK });
    expect(b.status).toBe(200);
    expect(b.body.duel.status).toBe('playing');
    return id;
  }
  const row = (id: number) => data.duels![id];
  return { data, send, req, started, row };
}

describe('a classmate fight', () => {
  it('is only for classmates, and refuses a shot out of turn, one that breaks the rules, or from someone else; a shot sent twice plays once', async () => {
    const h = setup();
    const to = (other: string) => h.send(ANA, { action: 'duel-challenge', request: h.req(), other, world: 'snow' });
    expect((await to(CAT)).body.code).toBe('class');
    expect((await to(DAN)).body.code).toBe('class');
    const id = await h.started();
    const d = h.row(id);
    const plain = { angle: 45, power: 60, arrow: 'plain' };
    expect((await h.send(BEN, { action: 'shot', duel: id, version: d.version, shot: plain })).body.code).toBe('not-your-turn');
    expect((await h.send(ANA, { action: 'shot', duel: id, version: d.version, shot: { ...plain, arrow: 'giant' } })).body.code).toBe('illegal');
    expect((await h.send(ANA, { action: 'shot', duel: id, version: d.version, shot: { ...plain, pass: true } })).status).toBe(400);
    expect((await h.send(CAT, { action: 'shot', duel: id, version: d.version, shot: plain })).status).toBe(403);
    expect(h.row(id).turns).toHaveLength(0);
    const body = { action: 'shot', duel: id, version: d.version, shot: { angle: 50, power: 62, arrow: 'steel' } };
    const first = await h.send(ANA, body);
    const again = await h.send(ANA, body);
    expect(again.status).toBe(200);
    expect(again.body.duel.version).toBe(first.body.duel.version);
    expect(h.row(id).turns).toHaveLength(1);
    expect(h.row(id).used[0]).toEqual({ steel: 1 });
  });
});

