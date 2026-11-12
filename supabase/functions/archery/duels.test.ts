import { describe, expect, it } from 'vitest';
import { chooseForRun } from '../../../shared/archery/bot';
import { HERE_FOR_MS } from '../../../shared/archery/config';
import { duelSetup, replayDuel, type DuelRow } from '../../../shared/archery/duel';
import { DUEL_POINTS, DUEL_WIN_POINTS } from '../../../shared/archery/points';
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
  const off = new Set<string>();
  // Classes with classmate fights switched off (the game still on).
  const duelsOff = new Set<string>();
  const heard: DuelRow[] = [];
  const hub = trialHub({
    now: () => clock.now, random: () => ((r = (r * 9301 + 49297) % 233280) / 233280), pupils: PUPILS,
    enabled: (p) => !off.has(PUPILS[p]?.classId ?? ''), duels: (p) => !duelsOff.has(PUPILS[p]?.classId ?? ''), onDuel: (d) => heard.push(d),
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
  /** The next shot, chosen by a Hard bot for whoever's turn it is (an honest pupil). */
  const nextShot = (d: DuelRow) => {
    const { run } = replayDuel(d.seed, duelSetup(d.world, [d.packs[0]!, d.packs[1]!]), d.turns);
    return { seat: run.round.turn, shot: chooseForRun(run, 'hard').shot };
  };
  const row = (id: number) => data.duels![id];
  return { hub, data, clock, off, duelsOff, heard, send, req, started, nextShot, row };
}

describe('challenging a classmate', () => {
  it('only works with someone in your own class and school who has the game open', async () => {
    const h = setup();
    const to = (other: string) => h.send(ANA, { action: 'duel-challenge', request: h.req(), other, world: 'snow' });
    expect((await to(CAT)).body.code).toBe('class');
    expect((await to(DAN)).body.code).toBe('class');
    expect((await to(EVA)).body.code).toBe('away');
    expect((await to(ANA)).body.code).toBe('away');
    h.clock.now += HERE_FOR_MS + 1;
    expect((await to(BEN)).body.code).toBe('away');
    h.hub.here(BEN);
    const ok = await to(BEN);
    expect(ok.status).toBe(200);
    expect(ok.body.duel).toMatchObject({ status: 'asked', seat_a: ANA, seat_b: BEN, name_a: 'Speedy Otter 1', name_b: 'Brave Kiwi 2', world: 'snow' });
    expect((await h.send(ANA, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'mars' })).status).toBe(400);
    // Nobody else can read the duel or see who is around.
    const id = ok.body.duel.id as number;
    expect(h.hub.readDuel(ANA, id)?.id).toBe(id);
    expect(h.hub.readDuel(CAT, id)).toBeNull();
    expect(h.hub.here(CAT).online.map((o) => o.id)).toEqual([]);
    h.hub.here(ANA);
    expect(Object.keys(h.hub.here(BEN).online[0])).toEqual(['id', 'name', 'avatar', 'busy', 'snoozed']);
  });





});


describe('a classmate fight', () => {
  it('plays every shot on the server, turn by turn, to the end: 4 points to the winner, 3 to the other, once each', async () => {
    const h = setup();
    const id = await h.started();
    let d = h.row(id);
    let shots = 0;
    while (d.status === 'playing') {
      const { seat, shot } = h.nextShot(d);
      const who = seat === 0 ? ANA : BEN;
      const r = await h.send(who, { action: 'shot', duel: id, version: d.version, shot });
      expect(r.status).toBe(200);
      d = r.body.duel;
      shots++;
    }
    expect(d).toMatchObject({ status: 'done', ending: 'finished' });
    expect(d.turns).toHaveLength(shots);
    const { run } = replayDuel(d.seed, duelSetup(d.world, [ANA_PACK, BEN_PACK]), d.turns);
    expect(run.rounds).toHaveLength(1);
    expect(d.winner).toBe(run.winner === 'draw' ? null : run.winner);
    const pts = (p: string) => h.data.points.filter((x) => x.player === p).map((x) => x.points);
    expect(pts(ANA)).toEqual([d.winner === 0 ? DUEL_WIN_POINTS : DUEL_POINTS]);
    expect(pts(BEN)).toEqual([d.winner === 1 ? DUEL_WIN_POINTS : DUEL_POINTS]);
    // Unused gear back: what they packed less what they used.
    expect(h.data.pupils[ANA].gear.steel).toBe(1 + 2 - (run.used[0].steel ?? 0));
    expect(h.data.pupils[BEN].gear.giant ?? 0).toBe(1 - (run.used[1].giant ?? 0));
    // Both screens heard every change.
    expect(h.heard.filter((x) => x.id === id).at(-1)).toEqual(d);
    // A shot after the end changes nothing.
    expect((await h.send(ANA, { action: 'shot', duel: id, version: d.version, shot: { angle: 45, power: 50, arrow: 'plain' } })).body.code).toBe('over');
    expect(h.data.points).toHaveLength(2);
    // Achievement counts, once each: a classmate fight for both, a win (and a win in the Forest) for the winner.
    const stats = (seat: 0 | 1) => h.data.stats?.[seat === 0 ? ANA : BEN] ?? {};
    for (const seat of [0, 1] as const) {
      expect(stats(seat).duels).toBe(1);
      expect(stats(seat).duel_wins ?? 0).toBe(d.winner === seat ? 1 : 0);
      expect(stats(seat).win_forest ?? 0).toBe(d.winner === seat ? 1 : 0);
    }
    expect(h.data.noted).toEqual([`${ANA}:stats:duel:${id}:0`, `${BEN}:stats:duel:${id}:1`]);
  });









});

