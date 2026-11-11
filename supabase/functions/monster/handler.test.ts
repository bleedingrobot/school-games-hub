import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  it('saves a queue of honest saves in order, counts the answers once however often it is sent, and records each batch once', async () => {
    const { items, now } = played(3);
    const { s, db } = fakeDatabase(now);
    const { status, body } = await send(s, items);
    expect(status).toBe(200);
    expect(body.results.map((r: { status: string }) => r.status)).toEqual(['saved', 'saved', 'saved']);
    expect(db.saved?.version).toBe(3);
    expect(db.saved?.world).toEqual(items[2].world);
    const total = () => [...db.batches.values()].reduce((n, list) => n + list.length, 0);
    expect(total()).toBe(db.rows.reduce((n, r) => n + r.summary.questions, 0));
    // The same saves sent again change nothing.
    const again = await send(s, items);
    expect(again.body.results.map((r: { status: string }) => r.status)).toEqual(['duplicate', 'duplicate', 'duplicate']);
    expect(total()).toBe(db.rows.reduce((n, r) => n + r.summary.questions, 0));
    expect(db.rows).toHaveLength(3);
  });

  it('refuses: not signed in, a bad save (and all queued after it), an out-of-date copy, and junk or too many requests', async () => {
    const { items, now } = played(4);
    const { s, db } = fakeDatabase(now);
    expect((await makeHandler(s)(post({ items: [] }, null))).status).toBe(401);
    await send(s, items.slice(0, 1));
    const bad = structuredClone(items[1]);
    bad.world.team[0] = { ...bad.world.team[0], level: 30, exp: Math.round(30 ** 2.5), hp: 10 };
    const { body } = await send(s, [bad, items[2], items[3]]);
    expect(body.results).toEqual([
      { type: 'refused', problem: 'pool-mismatch' },
      { type: 'refused', problem: 'after-refusal' },
      { type: 'refused', problem: 'after-refusal' },
    ]);
    expect(db.saved?.version).toBe(1);
    // A second device that also started from nothing and saved its own game.
    const other = new Session(['leaf', 'ice'], undefined, undefined, undefined, 99);
    const stale = await send(s, [{ ...other.save(), at: items[0].at + 1000 }]);
    expect(stale.body.results[0].type).toBe('refused');
    expect(db.saved?.version).toBe(1);
    expect((await send(s, [null])).body.results[0]).toEqual({ type: 'refused', problem: 'item' });
    expect((await send(s, Array.from({ length: MAX_ITEMS + 1 }, () => items[0]))).status).toBe(400);
    const handler = makeHandler(s);
    for (let i = 0; i < MAX_REQUESTS_PER_MINUTE; i++) await handler(post({ items: [] }));
    expect((await handler(post({ items: [] }))).status).toBe(429);
    // A refused save is logged as a code only, never with who sent it.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const noTeam = structuredClone(items[0]);
    noTeam.world.team = [];
    await send(fakeDatabase(now).s, [noTeam]);
    expect(warn).toHaveBeenCalledWith('monster: refused a save (team)');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('student-1');
    warn.mockRestore();
  });
});

describe('the deployable file', () => {
  // Skipped: monster/index.ts is deliberately left as deployed, so it no longer matches the code.
  it('is up to date with the code (run `npm run build:functions` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('monster');
    expect(readFileSync(resolve('supabase/functions/monster/index.ts'), 'utf8')).toBe(built);
  });
});
