import { describe, expect, it } from 'vitest';
import { CLASH_HP, MAX_CLASH_ROUNDS, clashGold, clashLine, clashOf, hitFor, replayClash, type ClashMove, type ClashPick } from '../../../shared/lord/clash';
import { clashMemory } from '../../../shared/lord/clashMemory';
import { MAX_MISSED, ROUND_MS, handleClash, type ClashRow, type ClashServices } from '../../../shared/lord/clashServer';
import type { AskSet } from '../../../shared/lord/server';
import { Game, answer } from './testKit';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

function setup() {
  let clock = Date.parse('2026-11-17T00:00:00Z');
  const mem = clashMemory(() => clock);
  mem.pupils.set(A, { name: 'Ari', classId: 'room-4', level: 3, here: true });
  mem.pupils.set(B, { name: 'Bea', classId: 'room-4', level: 6, here: true });
  mem.pupils.set(C, { name: 'Cal', classId: 'room-9', level: 3, here: true });
  // Each pupil's last arena question, as the game's own `ask` and `ask-check` would have left it.
  const asked = new Map<string, AskSet>();
  const services: ClashServices = {
    ...mem.services,
    now: () => clock,
    load: async (p) => ({ ok: true, value: { row: { hero: { level: mem.pupils.get(p)?.level ?? 1 }, extra: { ask: asked.get(p) ?? null } } as never, openFight: null, seen: false } }),
    settings: async () => ({ ok: true, value: { enabled: true, forestPerDay: 10, seasonStart: null } }),
  };
  const ask = (who: string, action: Parameters<typeof handleClash>[2], body: Record<string, unknown> = {}) => handleClash(services, who, action, body);
  const pick = (who: string, clash: number, round: number, move: ClashMove, right = true, at = clock) => {
    const no = (asked.get(who)?.no ?? 0) + 1;
    asked.set(who, { moment: 'arena', no, at, questions: [], marks: [{ correct: right, given: 1 }] });
    return ask(who, 'clash-pick', { clash, round, move, proof: { no, slot: 0 } });
  };
  const tick = (ms: number) => { clock += ms; };
  return { mem, ask, pick, tick };
}

async function started() {
  const t = setup();
  const sent = await t.ask(A, 'clash-challenge', { other: B });
  const id = (sent.body.clash as ClashRow).id;
  await t.ask(B, 'clash-answer', { clash: id, accept: true });
  return { ...t, id };
}

describe('live arena clashes', () => {
  it('rules, challenges, hidden picks, the clock, giving up, switching off and gold, all on the server', async () => {
    // The rules (shared/lord/clash.ts): Hammer smashes Sword, Sword cuts Net, Net tangles Hammer; winner x2, loser half.
    expect([clashOf('hammer', 'sword'), clashOf('sword', 'net'), clashOf('net', 'hammer'), clashOf('net', 'net'), clashOf(null, 'net')]).toEqual([0, 0, 0, 'tie', 1]);
    expect(clashLine('hammer', 'net')).toBe('Net tangles Hammer!');
    expect([hitFor({ move: 'sword', right: true }, 'win'), hitFor({ move: 'sword', right: false }, 'lose'), hitFor({ move: null, right: true }, 'tie')]).toEqual([20, 2, 0]);
    const level = replayClash([...Array(MAX_CLASH_ROUNDS)].map(() => [{ move: 'net', right: false }, { move: 'net', right: false }] as [ClashPick, ClashPick]));
    expect(level).toMatchObject({ over: true, winner: null });
    {
    const t = setup();
    expect((await t.ask(A, 'clash-challenge', { other: C })).body.code).toBe('class');
    const sent = await t.ask(A, 'clash-challenge', { other: B });
    expect(sent.status).toBe(200);
    const id = (sent.body.clash as ClashRow).id;
    expect((await t.ask(A, 'clash-answer', { clash: id, accept: true })).status).toBe(403);
    const yes = await t.ask(B, 'clash-answer', { clash: id, accept: true });
    expect((yes.body.clash as ClashRow).status).toBe('playing');
    expect((await t.ask(A, 'clash-challenge', { other: B })).body.code).toBe('busy');
    }
    {
    const t = await started();
    const first = await t.pick(A, t.id, 0, 'hammer', true);
    expect(first.body.picked).toBe(true);
    expect((first.body.clash as ClashRow).rounds).toEqual([]);
    expect(JSON.stringify(first.body)).not.toContain('hammer');
    const second = await t.pick(B, t.id, 0, 'sword', false);
    const c = second.body.clash as ClashRow;
    expect(c.rounds).toEqual([[{ move: 'hammer', right: true }, { move: 'sword', right: false }]]);
    expect(t.mem.picks.size).toBe(0);
    // A pick for a round already played is turned down kindly.
    expect((await t.pick(A, t.id, 0, 'net')).body.code).toBe('round');
    // A right answer to a question asked before this round began can't power this round's attack.
    t.tick(1000);
    await t.pick(A, t.id, 1, 'hammer', true, Date.parse(c.deadline) - 2 * ROUND_MS);
    const next = (await t.pick(B, t.id, 1, 'sword', true)).body.clash as ClashRow;
    expect(next.rounds[1]).toEqual([{ move: 'hammer', right: false }, { move: 'sword', right: true }]);
    }
    {
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
    }
    {
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
    }
    {
    const t = await started();
    const left = (await t.ask(B, 'clash-leave', { clash: t.id })).body.clash as ClashRow;
    expect(left).toMatchObject({ status: 'done', ending: 'left', winner: 0, leaver: 1, gold: [0, 0] });
    const u = await started();
    u.mem.pupils.get(B)!.live = false;
    const off = await u.pick(A, u.id, 0, 'sword');
    expect(off.body).toMatchObject({ code: 'off', clash: { status: 'done', ending: 'switched-off' } });
    expect(CLASH_HP).toBe(50);
    }
    {
      // Practice against a computer hero: the server plays each round and pays a little gold, 3 clashes a day.
      const g = new Game();
      await g.start();
      const golds: number[] = [];
      for (let n = 0; n < 4; n++) {
        let out;
        let fresh = true;
        do {
          const [ticket] = await answer(g, 'arena');
          out = await g.send({ action: 'practice', op: 'round', move: 'net', proof: ticket, fresh, foe: 'maple' });
          fresh = false;
          expect(out.body.ok).toBe(true);
          expect(out.body.result.foe).toBe('maple');
        } while (!out.body.result.over);
        golds.push(out.body.result.gold);
      }
      expect(golds.slice(0, 3).every((x) => x > 0)).toBe(true);
      expect(golds[3]).toBe(0);
      expect(g.hero().gold).toBe(50 + golds[0] + golds[1] + golds[2]);
    }
  });
});
