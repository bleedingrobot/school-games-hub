import { describe, expect, it, vi } from 'vitest';
import type { FactAnswer } from '../../../shared/maths/leitner';
import type { Stored } from '../../../shared/monsters/save/check';
import { Session } from '../../../shared/monsters/save/testKit';
import { makeHandler, MAX_ITEMS, MAX_REQUESTS_PER_MINUTE, type SaveRow, type Services } from './handler';

/** A stand-in for the database that follows the same rules as record_monster_save (in order, once each). */
function fakeDatabase(now: () => number, over: Partial<Services> = {}) {
  const db = {
    enabled: true,
    saved: null as (Stored & { version: number }) | null,
    ids: new Set<string>(),
    rows: [] as SaveRow[],
    batches: new Map<string, FactAnswer[]>(),
    refusals: [] as { reason: string; seq: number | null }[],
  };
  const s: Services = {
    now,
    userIdFor: vi.fn(async (token: string) => (token === 'good-token' ? 'student-1' : null)),
    enabled: vi.fn(async () => ({ ok: true as const, value: db.enabled })),
    loadSave: vi.fn(async () => ({ ok: true as const, value: db.saved })),
    knownSaves: vi.fn(async (_p: string, ids: string[]) => ({ ok: true as const, value: ids.filter((i) => db.ids.has(i)) })),
    recordAnswers: vi.fn(async (_p: string, pack: string, batchId: string, answers: FactAnswer[]) => {
      if (db.batches.has(batchId)) return { ok: true as const, value: 0 };
      db.batches.set(batchId, answers.map((a) => ({ ...a, key: `${pack}/${a.key}` })));
      return { ok: true as const, value: answers.length };
    }),
    recordSave: vi.fn(async (_p: string, save: SaveRow) => {
      if (db.ids.has(save.saveId)) return { ok: true as const, value: { status: 'duplicate' as const, version: db.saved!.version, points: null } };
      if (save.seq !== (db.saved?.version ?? 0) + 1) return { ok: true as const, value: { status: 'stale' as const, version: db.saved?.version ?? 0, points: null } };
      db.ids.add(save.saveId);
      db.rows.push(save);
      db.saved = { world: save.world, at: save.at, version: save.seq };
      return { ok: true as const, value: { status: 'saved' as const, version: save.seq, points: save.summary.wildWins } };
    }),
    recordRefusal: vi.fn(async (_p: string, reason: string, seq: number | null) => {
      db.refusals.push({ reason, seq });
      return { ok: true as const, value: null };
    }),
    ...over,
  };
  return { s, db };
}

function post(body: unknown, token: string | null = 'good-token') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'https://bleedingrobot.github.io' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('http://x/monster', { method: 'POST', headers, body: JSON.stringify(body) });
}

async function send(s: Services, items: unknown[]) {
  const response = await makeHandler(s)(post({ items }));
  return { status: response.status, body: await response.json() };
}

/** A session that has played some battles and made `saves` save items. */
function played(saves = 3) {
  const session = new Session(['water', 'fire']);
  const items = [session.save()];
  session.goto('kauri-bush', 'entrance');
  for (let i = 1; i < saves; i++) {
    for (let b = 0; b < 4; b++) session.wild();
    items.push(session.save());
  }
  return { session, items, now: () => session.clock.now() + 1000 };
}

describe('the monster server function', () => {
  it('refuses no sign-in, things that are not saves, too many saves, and too many requests', async () => {
    const { items, now } = played(1);
    const { s } = fakeDatabase(now);
    expect((await makeHandler(s)(post({ items: [] }, null))).status).toBe(401);
    expect((await send(s, [null])).body.results[0]).toEqual({ type: 'refused', problem: 'item' });
    expect((await send(s, Array.from({ length: MAX_ITEMS + 1 }, () => items[0]))).status).toBe(400);
    const handler = makeHandler(s);
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await handler(post({ items: [] }));
    expect((await handler(post({ items: [] }))).status).toBe(429);
  });

  it('counts a save (and its answers) once however often it is sent, and refuses a cheated save and all after it', async () => {
    const { items, now } = played(4);
    const { s, db } = fakeDatabase(now);
    await send(s, items.slice(0, 2));
    const total = [...db.batches.values()].reduce((n, list) => n + list.length, 0);
    expect(total).toBe(db.rows.reduce((n, r) => n + r.summary.questions, 0));
    const again = await send(s, items.slice(0, 2));
    expect(again.body.results.map((r: { status: string }) => r.status)).toEqual(['duplicate', 'duplicate']);
    expect([...db.batches.values()].reduce((n, list) => n + list.length, 0)).toBe(total);
    expect(db.rows).toHaveLength(2);

    const bad = structuredClone(items[2]);
    bad.world.team[0] = { ...bad.world.team[0], level: 30, exp: Math.round(30 ** 2.5), hp: 10 };
    const { body } = await send(s, [bad, items[3]]);
    expect(body.results).toEqual([
      { type: 'refused', problem: 'pool-mismatch' },
      { type: 'refused', problem: 'after-refusal' },
    ]);
    expect(db.saved?.version).toBe(2);
    expect(db.refusals).toEqual([{ reason: 'pool-mismatch', seq: 3 }]);
  });
});
