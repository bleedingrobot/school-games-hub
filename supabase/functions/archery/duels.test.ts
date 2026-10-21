import { describe, expect, it } from 'vitest';
import { chooseForRun } from '../../../shared/archery/bot';
import { CHALLENGE_MS, DUEL_GRACE_MS, DUEL_IDLE_MS, DUEL_MAX_TIMEOUTS, DUEL_TURN_MS, HERE_FOR_MS, PACK_MS } from '../../../shared/archery/config';
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
  const heard: DuelRow[] = [];
  const hub = trialHub({
    now: () => clock.now, random: () => ((r = (r * 9301 + 49297) % 233280) / 233280), pupils: PUPILS,
    enabled: (p) => !off.has(PUPILS[p]?.classId ?? ''), onDuel: (d) => heard.push(d),
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
  return { hub, data, clock, off, heard, send, req, started, nextShot, row };
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
  });

  it('shows up for the classmate, who can say no; it runs out after a minute', async () => {
    const h = setup();
    const c = await h.send(ANA, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'city' });
    const id = c.body.duel.id;
    expect(h.hub.here(BEN).asks).toEqual([{ duel: id, from: 'Speedy Otter 1', world: 'city', deadline: expect.any(String) }]);
    expect(h.hub.here(ANA).duel?.id).toBe(id);
    expect((await h.send(ANA, { action: 'duel-answer', duel: id, accept: true })).status).toBe(403);
    const no = await h.send(BEN, { action: 'duel-answer', duel: id, accept: false });
    expect(no.body.duel.status).toBe('declined');
    const again = await h.send(ANA, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'city' });
    h.clock.now += CHALLENGE_MS + 1;
    const late = await h.send(BEN, { action: 'duel-answer', duel: again.body.duel.id, accept: true });
    expect(late.body.code).toBe('late');
    h.hub.here(ANA);
    expect(h.row(again.body.duel.id).status).toBe('expired');
  });

  it('counts a challenge sent twice once, and a new one replaces the old', async () => {
    const h = setup();
    const body = { action: 'duel-challenge', request: 'same-request-1', other: BEN, world: 'forest' };
    const a = await h.send(ANA, body);
    const b = await h.send(ANA, body);
    expect(b.body.duel.id).toBe(a.body.duel.id);
    expect(Object.keys(h.data.duels!)).toHaveLength(1);
    await h.send(ANA, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'desert' });
    expect(h.row(a.body.duel.id).status).toBe('cancelled');
    expect(h.hub.here(BEN).asks).toHaveLength(1);
  });

  it('lets a pupil be in only one fight at a time', async () => {
    const h = setup();
    await h.started();
    h.hub.here(BEN);
    const busy = await h.send(CAT, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'forest' });
    expect(busy.body.code).toBe('class'); // Cat's another class anyway
    PUPILS[CAT].classId = 'room-1';
    try {
      expect((await h.send(CAT, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'forest' })).body.code).toBe('busy');
      expect(h.hub.here(CAT).online.find((o) => o.id === BEN)?.busy).toBe(true);
    } finally {
      PUPILS[CAT].classId = 'room-2';
    }
  });

  it("is refused when the game is off for the classmate's class", async () => {
    const h = setup();
    h.off.add('room-1');
    expect((await h.send(ANA, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'forest' })).status).toBe(403);
    expect(h.hub.here(ANA).off).toBe(true);
  });
});

describe('packing', () => {
  it('takes each pack out of the bag (once, if sent twice) and starts the fight when both have packed', async () => {
    const h = setup();
    const c = await h.send(ANA, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'forest' });
    const id = c.body.duel.id;
    expect((await h.send(ANA, { action: 'duel-pack', duel: id, pack: ANA_PACK })).body.code).toBe('late');
    await h.send(BEN, { action: 'duel-answer', duel: id, accept: true });
    const first = await h.send(ANA, { action: 'duel-pack', duel: id, pack: ANA_PACK });
    expect(first.body.state.gear).toEqual({ steel: 1, apple: 1, giant: 1 });
    expect(first.body.duel.status).toBe('packing');
    const twice = await h.send(ANA, { action: 'duel-pack', duel: id, pack: ANA_PACK });
    expect(twice.status).toBe(200);
    expect(h.data.pupils[ANA].gear).toEqual({ steel: 1, apple: 1, giant: 1 });
    expect((await h.send(BEN, { action: 'duel-pack', duel: id, pack: { quiver: { steel: 9 }, shield: null } })).body.code).toBe('gear');
    expect((await h.send(BEN, { action: 'duel-pack', duel: id, pack: { quiver: {}, shield: 'bubble' } })).body.code).toBe('gear');
    const go = await h.send(BEN, { action: 'duel-pack', duel: id, pack: BEN_PACK });
    expect(go.body.duel).toMatchObject({ status: 'playing', packs: [ANA_PACK, BEN_PACK] });
    expect(Date.parse(go.body.duel.deadline)).toBe(NOW + DUEL_TURN_MS);
    expect(h.data.pupils[BEN].gear).toEqual({ steel: 3, apple: 2 });
  });

  it('gives up an open bot fight first (its gear comes back)', async () => {
    const h = setup();
    const bot = await h.send(ANA, { action: 'fight-start', request: h.req(), world: 'forest', opponent: 'easy', pack: { quiver: { steel: 3 }, shield: null } });
    expect(bot.status).toBe(200);
    expect(h.data.pupils[ANA].gear.steel).toBeUndefined();
    await h.started();
    expect(h.data.fights[bot.body.fight].status).toBe('abandoned');
    expect(h.data.pupils[ANA].gear).toEqual({ steel: 1, apple: 1, giant: 1 });
  });

  it('gives the packed gear back if the other never packs, or someone leaves', async () => {
    const h = setup();
    const c = await h.send(ANA, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'forest' });
    const id = c.body.duel.id;
    await h.send(BEN, { action: 'duel-answer', duel: id, accept: true });
    await h.send(ANA, { action: 'duel-pack', duel: id, pack: ANA_PACK });
    h.clock.now += PACK_MS + 1;
    h.hub.here(BEN);
    expect(h.row(id).status).toBe('cancelled');
    expect(h.data.pupils[ANA].gear).toEqual({ steel: 3, apple: 2, giant: 1 });

    const c2 = await h.send(ANA, { action: 'duel-challenge', request: h.req(), other: BEN, world: 'forest' });
    await h.send(BEN, { action: 'duel-answer', duel: c2.body.duel.id, accept: true });
    await h.send(BEN, { action: 'duel-pack', duel: c2.body.duel.id, pack: BEN_PACK });
    const left = await h.send(ANA, { action: 'leave', duel: c2.body.duel.id });
    expect(left.body.duel.status).toBe('cancelled');
    expect(h.data.pupils[BEN].gear).toEqual({ steel: 3, apple: 2, giant: 1 });
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
  });

  it('refuses a shot out of turn, one that breaks the rules, and one from someone else', async () => {
    const h = setup();
    const id = await h.started();
    const d = h.row(id);
    const plain = { angle: 45, power: 60, arrow: 'plain' };
    expect((await h.send(BEN, { action: 'shot', duel: id, version: d.version, shot: plain })).body.code).toBe('not-your-turn');
    expect((await h.send(ANA, { action: 'shot', duel: id, version: d.version, shot: { ...plain, arrow: 'giant' } })).body.code).toBe('illegal');
    expect((await h.send(ANA, { action: 'shot', duel: id, version: d.version, shot: { ...plain, power: 101 } })).body.code).toBe('illegal');
    expect((await h.send(ANA, { action: 'shot', duel: id, version: d.version, shot: { ...plain, pass: true } })).status).toBe(400);
    expect((await h.send(CAT, { action: 'shot', duel: id, version: d.version, shot: plain })).status).toBe(403);
    expect((await h.send(ANA, { action: 'shot', duel: id, version: d.version - 1, shot: plain })).body.code).toBe('changed');
    expect(h.row(id).turns).toHaveLength(0);
  });

  it('plays a shot sent twice (the first reply was lost) only once', async () => {
    const h = setup();
    const id = await h.started();
    const v = h.row(id).version;
    const body = { action: 'shot', duel: id, version: v, shot: { angle: 50, power: 62, arrow: 'steel' } };
    const a = await h.send(ANA, body);
    const b = await h.send(ANA, body);
    expect(b.status).toBe(200);
    expect(b.body.duel.version).toBe(a.body.duel.version);
    expect(h.row(id).turns).toHaveLength(1);
    expect(h.row(id).used[0]).toEqual({ steel: 1 });
  });

  it("uses up a turn when its 45 seconds run out (checked by the server's clock)", async () => {
    const h = setup();
    const id = await h.started();
    const early = await h.send(BEN, { action: 'times-up', duel: id });
    expect(early.body.code).toBe('not-yet');
    expect(early.body.secondsLeft).toBe(Math.ceil((DUEL_TURN_MS + DUEL_GRACE_MS) / 1000));
    h.clock.now += DUEL_TURN_MS + DUEL_GRACE_MS;
    const up = await h.send(BEN, { action: 'times-up', duel: id });
    expect(up.status).toBe(200);
    expect(up.body.duel.turns).toEqual([{ angle: 0, power: 0, arrow: 'plain', pass: true }]);
    expect(up.body.duel.timeouts).toEqual([1, 0]);
    expect(Date.parse(up.body.duel.deadline)).toBe(h.clock.now + DUEL_TURN_MS);
    // Now it's Ben's turn.
    const r = await h.send(BEN, { action: 'shot', duel: id, version: up.body.duel.version, shot: { angle: 130, power: 60, arrow: 'plain' } });
    expect(r.status).toBe(200);
  });

  it(`ends after ${DUEL_MAX_TIMEOUTS} used-up turns in a row by the same player: gear back to both, nobody gets points`, async () => {
    const h = setup();
    const id = await h.started();
    for (let i = 0; i < DUEL_MAX_TIMEOUTS * 2; i++) {
      const d = h.row(id);
      if (d.status !== 'playing') break;
      if (d.turns.length % 2 === 1) {
        // Ben shoots each time; Ana never does.
        await h.send(BEN, { action: 'shot', duel: id, version: d.version, shot: { angle: 90, power: 5, arrow: 'plain' } });
        continue;
      }
      h.clock.now = Date.parse(d.deadline) + DUEL_GRACE_MS;
      await h.send(BEN, { action: 'times-up', duel: id });
    }
    const d = h.row(id);
    expect(d).toMatchObject({ status: 'done', ending: 'timeouts', winner: null, leaver: 0 });
    expect(d.timeouts[0]).toBe(DUEL_MAX_TIMEOUTS);
    expect(h.data.points).toEqual([]);
    expect(h.data.pupils[ANA].gear).toEqual({ steel: 3, apple: 2, giant: 1 });
    expect(h.data.pupils[BEN].gear).toEqual({ steel: 3, apple: 2, giant: 1 });
  });

  it('leaving part-way: the other player wins, nobody gets points, unused gear back to both', async () => {
    const h = setup();
    const id = await h.started();
    await h.send(ANA, { action: 'shot', duel: id, version: h.row(id).version, shot: { angle: 50, power: 62, arrow: 'steel' } });
    const r = await h.send(ANA, { action: 'leave', duel: id });
    expect(r.body.duel).toMatchObject({ status: 'done', ending: 'left', winner: 1, leaver: 0 });
    expect(h.data.points).toEqual([]);
    expect(h.data.pupils[ANA].gear).toEqual({ steel: 2, apple: 2, giant: 1 });
    expect(h.data.pupils[BEN].gear).toEqual({ steel: 3, apple: 2, giant: 1 });
    expect((await h.send(BEN, { action: 'leave', duel: id })).status).toBe(200);
  });

  it('stops fairly if a teacher switches the game off for either class', async () => {
    const h = setup();
    const id = await h.started();
    h.off.add('room-1');
    const r = await h.send(ANA, { action: 'shot', duel: id, version: h.row(id).version, shot: { angle: 50, power: 62, arrow: 'steel' } });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('game-off');
    expect(r.body.error).toMatch(/switched Archery Challenge off/);
    expect(h.row(id)).toMatchObject({ status: 'done', ending: 'switched-off', winner: null });
    expect(h.row(id).turns).toEqual([]);
    expect(h.data.points).toEqual([]);
    expect(h.data.pupils[ANA].gear).toEqual({ steel: 3, apple: 2, giant: 1 });
  });

  it('is ended by the tidy-up when nobody has shot for a while (gear back, no points)', async () => {
    const h = setup();
    const id = await h.started();
    await h.send(ANA, { action: 'shot', duel: id, version: h.row(id).version, shot: { angle: 50, power: 62, arrow: 'steel' } });
    h.clock.now += DUEL_IDLE_MS + 1;
    h.hub.tidy(DUEL_IDLE_MS);
    expect(h.row(id)).toMatchObject({ status: 'done', ending: 'idle' });
    expect(h.data.pupils[ANA].gear).toEqual({ steel: 2, apple: 2, giant: 1 });
    expect(h.data.points).toEqual([]);
  });

  it("can't be read by anyone else", async () => {
    const h = setup();
    const id = await h.started();
    expect(h.hub.readDuel(ANA, id)?.id).toBe(id);
    expect(h.hub.readDuel(CAT, id)).toBeNull();
    expect(h.hub.here(CAT).online.map((o) => o.id)).toEqual([]);
    expect(Object.keys(h.hub.here(BEN).online[0])).toEqual(['id', 'name', 'avatar', 'busy']);
  });
});
