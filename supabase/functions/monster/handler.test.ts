import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { FactAnswer } from '../../../shared/maths/leitner';
import type { Stored } from '../../../shared/monsters/save/check';
import { Session } from '../../../shared/monsters/save/testKit';
import { batchIdFor, makeHandler, MAX_ITEMS, MAX_REQUESTS_PER_MINUTE, type SaveRow, type Services } from './handler';

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
  it('needs a signed-in student', async () => {
    const { now } = played(1);
    const { s } = fakeDatabase(now);
    expect((await makeHandler(s)(post({ items: [] }, null))).status).toBe(401);
  });

  it('saves a whole queue of honest saves in order, and a new game from nothing', async () => {
    const { items, now } = played(3);
    const { s, db } = fakeDatabase(now);
    const { status, body } = await send(s, items);
    expect(status).toBe(200);
    expect(body.handled).toBe(3);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(['saved', 'saved', 'saved']);
    expect(db.saved?.version).toBe(3);
    expect(db.saved?.world).toEqual(items[2].world);
    expect(db.rows[1].battles).toHaveLength(4);
    expect(db.rows[1].summary.questions).toBeGreaterThan(8);
  });

  it('puts the answers in the maths records, one batch per topic, once only, however often it is sent', async () => {
    const { items, now } = played(2);
    const { s, db } = fakeDatabase(now);
    await send(s, items);
    const ids = [...db.batches.keys()];
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length);
    const total = [...db.batches.values()].reduce((n, list) => n + list.length, 0);
    expect(total).toBe(db.rows.reduce((n, r) => n + r.summary.questions, 0));
    // The same save sent again changes nothing.
    const again = await send(s, items);
    expect(again.body.results.map((r: { status: string }) => r.status)).toEqual(['duplicate', 'duplicate']);
    expect([...db.batches.values()].reduce((n, list) => n + list.length, 0)).toBe(total);
    expect(db.rows).toHaveLength(2);
    // Topic batch ids are the same each time for the same save.
    expect(await batchIdFor(items[1].saveId, 'add-sub')).toBe(await batchIdFor(items[1].saveId, 'add-sub'));
    expect(await batchIdFor(items[1].saveId, 'add-sub')).not.toBe(await batchIdFor(items[1].saveId, 'fractions'));
    expect(await batchIdFor(items[1].saveId, 'add-sub')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('is fine when the reply was lost: some saves are in, the rest are new', async () => {
    const { items, now } = played(4);
    const { s, db } = fakeDatabase(now);
    await send(s, items.slice(0, 2));
    const { body } = await send(s, items);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(['duplicate', 'duplicate', 'saved', 'saved']);
    expect(db.saved?.version).toBe(4);
  });

  it('refuses a bad save, keeps the last good one, and refuses everything queued after it', async () => {
    const { items, now } = played(4);
    const { s, db } = fakeDatabase(now);
    await send(s, items.slice(0, 1));
    const bad = structuredClone(items[1]);
    bad.world.team[0] = { ...bad.world.team[0], level: 30, exp: Math.round(30 ** 2.5), hp: 10 };
    const { status, body } = await send(s, [bad, items[2], items[3]]);
    expect(status).toBe(200);
    expect(body.handled).toBe(3);
    expect(body.results).toEqual([
      { type: 'refused', problem: 'pool-mismatch' },
      { type: 'refused', problem: 'after-refusal' },
      { type: 'refused', problem: 'after-refusal' },
    ]);
    expect(db.saved?.version).toBe(1);
    expect(db.saved?.world).toEqual(items[0].world);
    // Told to the teacher page as a code, once.
    expect(db.refusals).toEqual([{ reason: 'pool-mismatch', seq: 2 }]);
    // No answers from the refused saves were counted.
    expect(db.batches.size).toBe(0);
  });

  it('refuses a save made from an out-of-date copy (another Chromebook got there first)', async () => {
    const a = played(2);
    const { s, db } = fakeDatabase(a.now);
    await send(s, a.items);
    // A second device that also started from nothing and saved its own game.
    const other = new Session(['leaf', 'ice'], undefined, undefined, undefined, 99);
    const mine = other.save();
    const { body } = await send(s, [{ ...mine, at: a.items[1].at + 1000 }]);
    expect(body.results[0].type).toBe('refused');
    expect(db.saved?.version).toBe(2);
  });

  it('keeps the queue (and says so) when the database cannot be reached', async () => {
    const { items, now } = played(2);
    const { s } = fakeDatabase(now, { recordSave: vi.fn(async () => ({ ok: false as const, why: 'busy' as const })) });
    expect((await send(s, items)).status).toBe(503);
    const half = fakeDatabase(now);
    let calls = 0;
    half.s.recordSave = vi.fn(async (p: string, row: SaveRow) => (++calls === 2 ? { ok: false as const, why: 'busy' as const } : (fakeDatabase(now).s.recordSave(p, row) as never)));
    // (the first save "worked" in a throwaway database, so the second is the one that stops)
    const { body } = await send(half.s, items);
    expect(body.handled).toBe(1);
  });

  it('stops at the daily limit and keeps the rest of the queue', async () => {
    const { items, now } = played(3);
    const { s } = fakeDatabase(now);
    const real = s.recordSave;
    s.recordSave = vi.fn(async (p: string, row: SaveRow) => (row.seq === 2 ? { ok: false as const, why: 'too-many' as const } : real(p, row)));
    const { body } = await send(s, items);
    expect(body.handled).toBe(1);
  });

  it('keeps everything and says so while the game is switched off', async () => {
    const { items, now } = played(1);
    const { s, db } = fakeDatabase(now);
    db.enabled = false;
    const { status } = await send(s, items);
    expect(status).toBe(503);
    expect(db.saved).toBeNull();
    expect(s.recordSave).not.toHaveBeenCalled();
  });

  it('drops a save the database refuses, and the ones after it', async () => {
    const { items, now } = played(2);
    const { s, db } = fakeDatabase(now, { recordSave: vi.fn(async () => ({ ok: false as const, why: 'refused' as const })) });
    const { body } = await send(s, items);
    expect(body.results.map((r: { type: string }) => r.type)).toEqual(['refused', 'refused']);
    expect(db.refusals[0].reason).toBe('database');
  });

  it('refuses things that are not saves, too many saves, or too many requests', async () => {
    const { items, now } = played(1);
    const { s } = fakeDatabase(now);
    expect((await send(s, [null])).body.results[0]).toEqual({ type: 'refused', problem: 'item' });
    expect((await send(s, Array.from({ length: MAX_ITEMS + 1 }, () => items[0]))).status).toBe(400);
    const handler = makeHandler(s);
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await handler(post({ items: [] }));
    expect((await handler(post({ items: [] }))).status).toBe(429);
  });

  it('never puts who sent a refused save in its log', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { items, now } = played(1);
    const { s } = fakeDatabase(now);
    const bad = structuredClone(items[0]);
    bad.world.team = [];
    await send(s, [bad]);
    expect(warn).toHaveBeenCalledWith('monster: refused a save (team)');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('student-1');
    warn.mockRestore();
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('monster');
    expect(readFileSync(resolve('supabase/functions/monster/index.ts'), 'utf8')).toBe(built);
  });
});
