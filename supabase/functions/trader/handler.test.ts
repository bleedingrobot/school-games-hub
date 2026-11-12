import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PICTURE_GAP_MINUTES, type StickerId } from '../../../shared/trader/gallery';
import { makeGalaxy } from '../../../shared/trader/galaxy';
import { emptyPlan } from '../../../shared/trader/plan';
import { DEFAULT_SETTINGS, newGame, type Game } from '../../../shared/trader/server';
import type { MathsContext } from '../../../shared/trader/questions';
import { SchoolMarket } from '../../../shared/trader/schoolMarket';
import { nzDay, makeHandler, type ClassSettings, type Saved, type SaveArgs, type SeasonSystem, type Services, type StoredDay } from './handler';
import { buildAll, emptyDesign, newPlanet } from '../../../shared/trader/system';
import { CARRY_MAX_CREDITS } from '../../../shared/trader/config';

const SEED = 'handler-test';
const galaxy = makeGalaxy(SEED);
const NOW = Date.UTC(2026, 9, 22, 1, 0, 0);
const TODAY = nzDay(NOW);

/** An in-memory stand-in for the database, with the same rules as the SQL (versions, claims saved with the game, repeats). */
function world(opts: { settings?: Partial<ClassSettings>; now?: () => number } = {}) {
  const state = {
    games: new Map<string, Saved>(),
    days: new Map<string, StoredDay>(),
    requests: new Map<string, unknown>(),
    records: [] as { once: string; answers: unknown }[],
    saves: 0,
    settings: { enabled: true, ...DEFAULT_SETTINGS, ...opts.settings } as ClassSettings,
    busy: false,
    market: new SchoolMarket(),
    marketReads: 0,
    waiting: new Map<string, SeasonSystem>(),
    chosen: [] as { choice: string; picture: string | null }[],
    stickers: new Map<string, StickerId>(), // `${owner}:${visitor}`
    pictures: new Map<string, Uint8Array>(),
    lastDrawn: new Map<string, number>(),
    pictureCalls: 0,
    stickerCalls: 0,
  };
  const classOf = (p: string) => (p === 'cat' ? 2 : 1);
  const names: Record<string, string> = { ana: 'Ana', ben: 'Ben', cat: 'Cat' };
  const builtSun = (p: string) => !!state.games.get(p)?.game.system?.sun?.built;
  const clock = opts.now ?? (() => NOW);
  const context: MathsContext = { facts: [], settings: {} };
  const services: Services = {
    userIdFor: async (token) => (token === 'good' ? 'ana' : token === 'good2' ? 'ben' : token === 'good3' ? 'cat' : null),
    now: clock,
    randomHex: (n) => 'ab'.repeat(n),
    random: (() => {
      let i = 0;
      return () => ((i = (i * 31 + 7) % 97) + 1) / 100;
    })(),
    settings: async () => state.settings,
    schoolSeed: async () => ({ seed: SEED, season: 1 }),
    loadGame: async (p) => (state.busy ? 'busy' : structuredClone(state.games.get(p) ?? null)),
    request: async (p, id) => state.requests.get(`${p}:${id}`) ?? null,
    loadDay: async (p, d) => structuredClone(state.days.get(`${p}:${d}`) ?? null),
    storeDay: async (p, d, questions) => {
      if (!state.days.has(`${p}:${d}`)) state.days.set(`${p}:${d}`, { questions, answered: {} });
      return true;
    },
    mathsContext: async () => context,
    seasonSystem: async (p) => structuredClone(state.waiting.get(p) ?? null),
    chooseSeason: async (p, choice, picture) => {
      state.waiting.delete(p);
      state.chosen.push({ choice, picture });
      return true;
    },
    market: async (_p, day) => {
      state.marketReads++;
      return state.market.view(day);
    },
    save: async (p, a: SaveArgs) => {
      const cur = state.games.get(p);
      if ((cur?.version ?? 0) !== a.expectedVersion) return null;
      const version = a.expectedVersion + 1;
      state.games.set(p, { game: structuredClone(a.game), version, season: a.season });
      const day = state.days.get(`${p}:${a.day}`);
      if (day) Object.assign(day.answered, a.claims);
      state.requests.set(`${p}:${a.requestId}`, a.reply);
      if (a.market.length) state.market.apply(a.day, a.market, state.games.size);
      state.saves++;
      return version;
    },
    recordAnswers: async (_p, once, answers) => {
      state.records.push({ once, answers });
    },
    gallery: async (p) => {
      if (state.busy) return 'busy';
      const ids = [...state.games.keys()].filter((id) => classOf(id) === classOf(p) && builtSun(id));
      ids.sort((a, b) => (a === p ? -1 : b === p ? 1 : a.localeCompare(b)));
      return ids.map((id) => {
        const counts: Partial<Record<StickerId, number>> = {};
        let given: StickerId | null = null;
        for (const [k, v] of state.stickers) {
          const [owner, visitor] = k.split(':');
          if (owner !== id) continue;
          counts[v] = (counts[v] ?? 0) + 1;
          if (visitor === p) given = v;
        }
        return { id, name: names[id] ?? id, design: structuredClone(state.games.get(id)!.game.system!), mine: id === p, drawn: state.pictures.has(id), stickers: id === p ? counts : given };
      });
    },
    pictureLinks: async (ids) => Object.fromEntries(ids.filter((id) => state.pictures.has(id)).map((id) => [id, `https://pics/${id}.webp`])),
    giveSticker: async (visitor, owner, sticker) => {
      state.stickerCalls++;
      if (visitor === owner) return 'own';
      if (classOf(visitor) !== classOf(owner)) return 'class';
      if (!builtSun(owner)) return 'none';
      if (sticker === null) state.stickers.delete(`${owner}:${visitor}`);
      else state.stickers.set(`${owner}:${visitor}`, sticker);
      return 'ok';
    },
    mayDraw: async (p) => {
      if (!builtSun(p)) return false;
      const last = state.lastDrawn.get(p);
      if (last !== undefined && clock() - last < PICTURE_GAP_MINUTES * 60_000) return false;
      state.lastDrawn.set(p, clock());
      return true;
    },
    storePicture: async (p, webp) => {
      state.pictureCalls++;
      state.pictures.set(p, webp);
      return true;
    },
  };
  const handler = makeHandler(services);
  const call = async (body: object, token = 'good') => {
    const r = await handler(new Request('https://x/trader', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: r.status, body: (await r.json()) as Record<string, any> };
  };
  let n = 0;
  const id = () => `req-${String(++n).padStart(6, '0')}`;
  /** Gives a pupil a saved game with a built sun (and so a place in the gallery). */
  const giveSun = (p: string, _token: string) => {
    const g = newGame(galaxy, TODAY, DEFAULT_SETTINGS);
    g.system = buildAll({ ...emptyDesign(), sun: { kind: 'yellow', name: [0, 0] }, planets: [newPlanet(1)] });
    state.games.set(p, { game: g, version: 1, season: 1 });
  };
  return { state, call, id, giveSun };
}

describe('the Star Trader server function', () => {
  it('refuses a missing or fake sign-in and anything that is not a POST', async () => {
    const { call } = world();
    expect((await call({ action: 'load' }, 'nope')).status).toBe(401);
    const handler = makeHandler(world().state as unknown as Services);
    expect((await handler(new Request('https://x/trader', { method: 'GET' }))).status).toBe(405);
  });

  it('applies a trade with the shared rules and a request sent twice counts once', async () => {
    const w = world();
    const first = await w.call({ action: 'load' });
    const g = first.body.game as Game;
    const line = g.t.market.find((m) => m.buy > 0 && m.stock > 5)!;
    const plan = emptyPlan();
    plan[line.good] = 2;
    const requestId = w.id();
    const sent = { action: 'act', requestId, version: first.body.version, actions: [{ type: 'trade', plan }] };
    const r1 = await w.call(sent);
    expect(r1.status).toBe(200);
    expect(r1.body.game.t.credits).toBe(100 - line.buy * 2);
    expect(r1.body.version).toBe(2);
    const r2 = await w.call(sent);
    expect(r2.status).toBe(200);
    expect(r2.body).toEqual(r1.body);
    expect(w.state.saves).toBe(2);
    expect(w.state.games.get('ana')!.game.t.credits).toBe(100 - line.buy * 2);
  });

  it('marks an answer on the server, uses the question once, and records it for the maths ladder', async () => {
    const w = world();
    const first = await w.call({ action: 'load' });
    const line = (first.body.game as Game).t.market.find((m) => m.buy > 0 && m.stock > 5)!;
    const plan = emptyPlan();
    plan[line.good] = 1;
    const stored = w.state.days.get(`ana:${TODAY}`)!;
    const right = stored.questions[0].answer;
    const r = await w.call({ action: 'act', requestId: w.id(), version: 1, actions: [{ type: 'trade', plan, ask: { slot: 0, value: right, ms: 2500 } }] });
    expect(r.status).toBe(200);
    expect(r.body.answers).toEqual([{ slot: 0, right: true, answer: right, ms: 2500 }]);
    expect(r.body.trade.sharp).toBe(true);
    expect(r.body.game.asked).toBe(1);
    expect(w.state.days.get(`ana:${TODAY}`)!.answered['0']).toEqual({ value: right, right: true });
    expect(w.state.records).toHaveLength(1);
    // The same slot again is refused.
    const plan2 = emptyPlan();
    plan2[line.good] = 1;
    const again = await w.call({ action: 'act', requestId: w.id(), version: 2, actions: [{ type: 'trade', plan: plan2, ask: { slot: 0, value: right, ms: 1 } }] });
    expect(again.status).toBe(400);
  });

  it('pupils cannot touch each other\'s games', async () => {
    const w = world();
    await w.call({ action: 'load' });
    await w.call({ action: 'load' }, 'good2');
    expect(w.state.games.has('ben')).toBe(true);
    expect(w.state.games.get('ben')!.game).not.toBe(w.state.games.get('ana')!.game);
  });
});

describe('the Star Forge at a New Season', () => {
  it('holds a pupil with a saved system until they choose: keep gives the system and a fresh ship, fresh gives the ship and capped credits', async () => {
    const design = buildAll({ ...emptyDesign(), sun: { kind: 'yellow', name: [0, 0] }, planets: [newPlanet(1)] });
    const carry = { ship: 2, credits: 50_000, weapons: [0], shields: [], pods: 1 };
    const fresh = async (choice: 'keep' | 'fresh', picture?: string) => {
      const w = world();
      w.state.waiting.set('ana', { design, carry });
      const first = await w.call({ action: 'load' });
      // Nothing to play until they choose: no game is made, and moves are refused.
      expect(first.body.seasonChoice).toMatchObject({ worth: expect.any(Number), carry: { ship: 2, credits: CARRY_MAX_CREDITS } });
      expect(first.body.game).toBeUndefined();
      expect(w.state.games.size).toBe(0);
      expect((await w.call({ action: 'act', requestId: w.id(), version: 1, actions: [] })).status).toBe(409);
      expect((await w.call({ action: 'load', seasonChoice: 'bogus' })).status).toBe(400);
      expect((await w.call({ action: 'load', seasonChoice: 'fresh', picture: 'ben/other.webp' })).status).toBe(400);
      const r = await w.call({ action: 'load', seasonChoice: choice, ...(picture ? { picture } : {}) });
      expect(w.state.chosen).toEqual([{ choice, picture: picture ?? null }]);
      expect((await w.call({ action: 'load' })).body.seasonChoice).toBeUndefined();
      return r.body.game as Game;
    };
    const kept = await fresh('keep');
    expect(kept.system?.sun?.built).toBe(true);
    expect(kept.t.ship).toBe(0);
    expect(kept.t.credits).toBe(100);
    const started = await fresh('fresh', 'ana/season1.webp');
    expect(started.system).toBeUndefined();
    expect(started.t.ship).toBe(2);
    expect(started.t.credits).toBe(CARRY_MAX_CREDITS);
    expect(started.t.weapons).toEqual([0]);
  });
});


describe('Sharing: gallery, stickers, pictures (S.8)', () => {
  const forgeWorld = (opts: Parameters<typeof world>[0] = {}) => {
    const w = world({ ...opts, settings: { forge: true, ...opts.settings } });
    w.giveSun('ana', 'good');
    w.giveSun('ben', 'good2');
    w.giveSun('cat', 'good3');
    return w;
  };

  it('the gallery shows classmates only, own system first, a picture link only where one was drawn, and counts without names for the owner', async () => {
    const w = forgeWorld();
    w.state.pictures.set('ben', new Uint8Array([1]));
    await w.call({ action: 'sticker', owner: 'ana', sticker: 'wow' }, 'good2');
    const r = await w.call({ action: 'gallery' }, 'good');
    expect(r.status).toBe(200);
    const systems = r.body.systems as any[];
    expect(systems.map((s) => s.id)).toEqual(['ana', 'ben']);
    expect(systems[0].mine).toBe(true);
    expect(systems[1].mine).toBe(false);
    expect(systems[0].picture).toBeNull();
    expect(systems[1].picture).toBe('https://pics/ben.webp');
    expect(systems[0].stickers).toEqual({ wow: 1 });
    expect(JSON.stringify(systems[0].stickers)).not.toMatch(/ben|Ben/);
    // The other class's pupil never appears, and sees only their own class.
    expect(JSON.stringify(r.body)).not.toContain('cat');
    expect(((await w.call({ action: 'gallery' }, 'good3')).body.systems as any[]).map((s) => s.id)).toEqual(['cat']);
  });
});

describe('the deployable file', () => {
  it('is up to date with the code (run `npm run build:functions -- trader` if this fails)', async () => {
    // @ts-expect-error: plain JavaScript build script
    const { buildFunction } = await import('../../../scripts/build-functions.mjs');
    const built: string = await buildFunction('trader');
    expect(readFileSync(resolve('supabase/functions/trader/index.ts'), 'utf8')).toBe(built);
  });
});
