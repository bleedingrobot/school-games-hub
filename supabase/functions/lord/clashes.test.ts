import { describe, expect, it } from 'vitest';
import { CLASH_HP, clashGold, type ClashMove } from '../../../shared/lord/clash';
import { clashMemory } from '../../../shared/lord/clashMemory';
import { MAX_MISSED, ROUND_MS, handleClash, type ClashRow, type ClashServices } from '../../../shared/lord/clashServer';
import { proof } from './testKit';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

function setup() {
  let clock = Date.parse('2026-11-17T00:00:00Z');
  const mem = clashMemory(() => clock);
  mem.pupils.set(A, { name: 'Ari', classId: 'room-4', level: 3, here: true });
  mem.pupils.set(B, { name: 'Bea', classId: 'room-4', level: 6, here: true });
  mem.pupils.set(C, { name: 'Cal', classId: 'room-9', level: 3, here: true });
  const recorded: string[] = [];
  const services: ClashServices = {
    ...mem.services,
    now: () => clock,
    load: async (p) => ({ ok: true, value: { row: { hero: { level: mem.pupils.get(p)?.level ?? 1 } } as never, openFight: null, seen: false } }),
    settings: async () => ({ ok: true, value: { enabled: true, forestPerDay: 10, seasonStart: null } }),
    recordAnswers: async (_p, pack, key) => { recorded.push(`${pack}:${key}`); return { ok: true, value: 1 }; },
  };
  const ask = (who: string, action: Parameters<typeof handleClash>[2], body: Record<string, unknown> = {}) => handleClash(services, who, action, body);
  const pick = (who: string, clash: number, round: number, move: ClashMove, right = true) =>
    ask(who, 'clash-pick', { clash, round, move, proof: proof('add-sub', mem.pupils.get(who)!.level, right) });
  const tick = (ms: number) => { clock += ms; };
  return { mem, ask, pick, tick, recorded };
}

async function started() {
  const t = setup();
  const sent = await t.ask(A, 'clash-challenge', { other: B });
  const id = (sent.body.clash as ClashRow).id;
  await t.ask(B, 'clash-answer', { clash: id, accept: true });
  return { ...t, id };
}

describe('live arena clashes', () => {
  it('challenges classmates only, and the classmate says yes or no', async () => {
    const t = setup();
    expect((await t.ask(A, 'clash-challenge', { other: C })).body.code).toBe('class');
    const sent = await t.ask(A, 'clash-challenge', { other: B });
    expect(sent.status).toBe(200);
    const id = (sent.body.clash as ClashRow).id;
    expect((await t.ask(A, 'clash-answer', { clash: id, accept: true })).status).toBe(403);
    const yes = await t.ask(B, 'clash-answer', { clash: id, accept: true });
    expect((yes.body.clash as ClashRow).status).toBe('playing');
    expect((await t.ask(A, 'clash-challenge', { other: B })).body.code).toBe('busy');
  });

  it('keeps the first pick hidden, plays the round when both are in, and marks the maths on the server', async () => {
    const t = await started();
    const first = await t.pick(A, t.id, 0, 'hammer', true);
    expect(first.body.picked).toBe(true);
    expect((first.body.clash as ClashRow).rounds).toEqual([]);
    expect(JSON.stringify(first.body)).not.toContain('hammer');
    const second = await t.pick(B, t.id, 0, 'sword', false);
    const c = second.body.clash as ClashRow;
    expect(c.rounds).toEqual([[{ move: 'hammer', right: true }, { move: 'sword', right: false }]]);
    expect(t.mem.picks.size).toBe(0);
    expect(t.recorded).toHaveLength(2);
    // A pick for a round already played is turned down kindly.
    expect((await t.pick(A, t.id, 0, 'net')).body.code).toBe('round');
  });

  it('pays the winner and half that to the other side, for the first 3 clashes a day', async () => {
    const t = setup();
    for (let n = 0; n < 4; n++) {
      const id = ((await t.ask(A, 'clash-challenge', { other: B })).body.clash as ClashRow).id;
      await t.ask(B, 'clash-answer', { clash: id, accept: true });
      let c: ClashRow | undefined;
      for (let r = 0; r < 3; r++) {
        await t.pick(A, id, r, 'hammer', true);
        c = (await t.pick(B, id, r, 'sword', true)).body.clash as ClashRow;
      }
      expect(c).toMatchObject({ status: 'done', ending: 'finished', winner: 0 });
      expect(c!.gold).toEqual(n < 3 ? [clashGold(3), Math.round(clashGold(3) / 2)] : [0, 0]);
    }
    expect(t.mem.pupils.get(A)!.gold).toBe(3 * clashGold(3));
  });

  it('lets the clock take a pick (no attack), and ends a clash someone has walked away from with no gold', async () => {
    const t = await started();
    await t.pick(A, t.id, 0, 'net');
    expect((await t.ask(B, 'clash-times-up', { clash: t.id })).body.code).toBe('not-yet');
    t.tick(ROUND_MS + 2000);
    const r1 = (await t.ask(A, 'clash-times-up', { clash: t.id })).body.clash as ClashRow;
    expect(r1.rounds[0]).toEqual([{ move: 'net', right: true }, { move: null, right: false }]);
    expect(r1.missed).toEqual([0, 1]);
    for (let i = 1; i < MAX_MISSED; i++) {
      await t.pick(A, t.id, i, 'net');
      t.tick(ROUND_MS + 2000);
    }
    const end = (await t.ask(A, 'clash-times-up', { clash: t.id })).body.clash as ClashRow;
    expect(end).toMatchObject({ status: 'done', ending: 'timeouts', winner: 0, leaver: 1, gold: [0, 0] });
  });

  it('giving up hands the other side the win with no gold; switching off stops it', async () => {
    const t = await started();
    const left = (await t.ask(B, 'clash-leave', { clash: t.id })).body.clash as ClashRow;
    expect(left).toMatchObject({ status: 'done', ending: 'left', winner: 0, leaver: 1, gold: [0, 0] });
    const u = await started();
    u.mem.pupils.get(B)!.live = false;
    const off = await u.pick(A, u.id, 0, 'sword');
    expect(off.body).toMatchObject({ code: 'off', clash: { status: 'done', ending: 'switched-off' } });
    expect(CLASH_HP).toBe(50);
  });
});
