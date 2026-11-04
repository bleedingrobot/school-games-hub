/**
 * A browser-only stand-in for the school's database, so the preview (and tests) can play the whole game with no sign-in.
 * It runs the REAL server function logic (supabase/functions/trader/handler.ts) against a pretend database kept in this
 * page, so the preview behaves exactly like the real game: the same checks, the same questions, the same refusals.
 * Nothing leaves the browser.
 */
import { DEFAULT_SETTINGS, type Game } from '../../../shared/trader/server';
import { startFight } from '../../../shared/trader/fight';
import type { MathsContext } from '../../../shared/trader/questions';
import { SHIPS } from '../../../shared/trader/config';
import { makeGalaxy } from '../../../shared/trader/galaxy';
import { SchoolMarket } from '../../../shared/trader/schoolMarket';
import { busyLunchtime } from '../../../shared/trader/sim';
import { PICTURE_GAP_MINUTES, type StickerId } from '../../../shared/trader/gallery';
import { PRETEND_CLASSMATES, type PretendClassmate } from './trialClassmates';
import type { SystemDesign } from '../../../shared/trader/system';
import { makeHandler, type ClassSettings, type GalleryRow, type Saved, type SaveArgs, type SeasonSystem, type Services, type StoredDay } from '../../../supabase/functions/trader/handler';
import type { Transport } from '../../data/trader';

export interface TrialOptions {
  /** The school's galaxy seed. */
  seed?: string;
  settings?: Partial<ClassSettings>;
  /** A fixed clock for tests (milliseconds); the preview uses the real one plus any "pretend tomorrow". */
  now?: () => number;
  /** The pupil's maths records and focus (the preview has none). */
  maths?: MathsContext;
}

export interface Trial {
  transport: Transport;
  /** The pretend database. */
  data: { game: Saved | null; days: Map<number, StoredDay>; requests: Map<string, unknown>; records: { once: string }[]; settings: ClassSettings; skippedDays: number; market: SchoolMarket; /** Last season's system, waiting for its owner's choice (see tools.endSeason). */ waiting: SeasonSystem | null;
    /** Pretend classmates in the gallery (see tools.classmates), the stickers the pupil gave them, and the ones they gave the pupil. */
    classmates: PretendClassmate[]; given: Map<string, StickerId>; mine: Partial<Record<StickerId, number>>;
    /** Saved gallery pictures (as links), and when the pupil's was last saved. */
    pictures: Map<string, string>; drawnAt: number | null };
  /** Test tools for the preview (never in the real game). Each changes the pretend database; reload the game after. */
  tools: {
    give(credits: number): void;
    setShip(ship: number): void;
    forcePirates(tier: number): void;
    nextDay(): void;
    /** Pretend classmates trade all day on the school's market, so the news and moved prices can be seen. */
    busySchool(pupils?: number): void;
    restart(): void;
    /** Pretend classmates with built systems join the class gallery, and some leave stickers on the pupil's system. */
    classmates(): void;
    /** Give the pupil this solar system (as if built). */
    setSystem(design: SystemDesign): void;
    /** Give a pretend classmate a gallery picture (a link to it). */
    classmatePicture(id: string, link: string): void;
    /** Pretend a New Season has started: a built system waits for the keep-or-fresh choice, and the game is cleared. Reload after. */
    endSeason(): void;
  };
}

export function trialBackend(options: TrialOptions = {}): Trial {
  const data: Trial['data'] = {
    game: null,
    days: new Map(),
    requests: new Map(),
    records: [],
    // The Star Forge is open in the preview so pupils can build; pass settings: { forge: false } to test it closed.
    settings: { enabled: true, ...DEFAULT_SETTINGS, forge: true, forgeTyping: true, ...options.settings },
    skippedDays: 0,
    market: new SchoolMarket(),
    waiting: null,
    classmates: [],
    given: new Map(),
    mine: {},
    pictures: new Map(),
    drawnAt: null,
  };
  /** The preview's pretend school: the pupil plus this many classmates (the market's depth). */
  const SCHOOL_SIZE = 30;
  const seed = options.seed ?? 'preview-season';
  const context: MathsContext = options.maths ?? { facts: [], settings: {} };
  const clock = options.now ?? (() => Date.now());
  const services: Services = {
    userIdFor: async (token) => (token === 'pupil' ? 'pupil' : null),
    now: () => clock() + data.skippedDays * 86_400_000,
    random: Math.random,
    randomHex: (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join(''),
    settings: async () => data.settings,
    schoolSeed: async () => ({ seed, season: 1 }),
    loadGame: async () => (data.game ? structuredClone(data.game) : null),
    request: async (_p, id) => data.requests.get(id) ?? null,
    loadDay: async (_p, day) => structuredClone(data.days.get(day) ?? null),
    storeDay: async (_p, day, questions) => {
      if (!data.days.has(day)) data.days.set(day, { questions, answered: {} });
      return true;
    },
    mathsContext: async () => context,
    seasonSystem: async () => structuredClone(data.waiting),
    chooseSeason: async () => {
      data.waiting = null;
      return true;
    },
    market: async (_p, day) => data.market.view(day),
    save: async (_p, a: SaveArgs) => {
      if ((data.game?.version ?? 0) !== a.expectedVersion) return null;
      const version = a.expectedVersion + 1;
      data.game = { game: structuredClone(a.game), version, season: a.season };
      const day = data.days.get(a.day);
      if (day) Object.assign(day.answered, a.claims);
      data.requests.set(a.requestId, a.reply);
      if (a.market.length) data.market.apply(a.day, a.market, SCHOOL_SIZE);
      return version;
    },
    recordAnswers: async (_p, once) => {
      data.records.push({ once });
    },
    gallery: async () => {
      const own = data.game?.game.system;
      const rows: GalleryRow[] = own?.sun?.built ? [{ id: 'pupil', name: 'You', design: structuredClone(own), mine: true, drawn: data.pictures.has('pupil'), stickers: { ...data.mine } }] : [];
      for (const c of data.classmates) rows.push({ id: c.id, name: c.name, design: structuredClone(c.design), mine: false, drawn: data.pictures.has(c.id), stickers: data.given.get(c.id) ?? null });
      return rows;
    },
    pictureLinks: async (players) => Object.fromEntries(players.flatMap((p) => (data.pictures.has(p) ? [[p, data.pictures.get(p)!]] : []))),
    giveSticker: async (visitor, owner, sticker) => {
      if (visitor === owner) return 'own';
      if (!data.classmates.some((c) => c.id === owner)) return 'class';
      if (sticker) data.given.set(owner, sticker);
      else data.given.delete(owner);
      return 'ok';
    },
    mayDraw: async () => {
      const now = services.now();
      if (!data.game?.game.system?.sun?.built || (data.drawnAt !== null && now - data.drawnAt < PICTURE_GAP_MINUTES * 60_000)) return false;
      data.drawnAt = now;
      return true;
    },
    storePicture: async (player, webp) => {
      let text = '';
      for (const b of webp) text += String.fromCharCode(b);
      data.pictures.set(player, `data:image/webp;base64,${btoa(text)}`);
      return true;
    },
  };
  const handler = makeHandler(services);
  const transport: Transport = async (body) => {
    const response = await handler(
      new Request('https://trial.invalid/trader', {
        method: 'POST',
        headers: { Authorization: 'Bearer pupil', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  /** Change the saved game the way a database edit would (and bump the version, so an open game must reload). */
  const edit = (change: (g: Game) => void) => {
    if (!data.game) return;
    const next = structuredClone(data.game);
    change(next.game);
    data.game = { ...next, version: next.version + 1 };
  };
  return {
    transport,
    data,
    tools: {
      give: (credits) => edit((g) => void (g.t.credits += credits)),
      setShip: (ship) =>
        edit((g) => {
          g.t.ship = ship;
          g.t.hull = SHIPS[ship].hull;
          g.t.fuel = SHIPS[ship].fuelTank;
          g.t.cargo = g.t.cargo.map(() => 0);
          g.t.pods = 0;
          // A test ship comes fitted with the best gear that fits, so fights can be tried straight away.
          g.t.weapons = Array.from({ length: SHIPS[ship].weaponSlots }, () => 1);
          g.t.shields = Array.from({ length: SHIPS[ship].shieldSlots }, () => 0);
          g.pending = null;
        }),
      forcePirates: (tier) => edit((g) => void (g.pending = { kind: 'fight', tier, fight: startFight(g.t, tier, `forced:${g.t.jumpNo}:${tier}`) })),
      nextDay: () => {
        data.skippedDays += 1;
      },
      busySchool: (pupils = SCHOOL_SIZE) => {
        const day = data.game?.game.t.day;
        if (day !== undefined) busyLunchtime(makeGalaxy(seed), data.market, day, pupils, `busy-${data.skippedDays}`);
      },
      classmates: () => {
        data.classmates = structuredClone(PRETEND_CLASSMATES);
        data.mine = { wow: 3, planets: 2, amazing: 1 };
      },
      setSystem: (design) => edit((g) => void (g.system = structuredClone(design))),
      classmatePicture: (id, link) => {
        data.pictures.set(id, link);
      },
      endSeason: () => {
        const g = data.game?.game;
        if (!g?.system?.sun?.built) return;
        data.waiting = { design: structuredClone(g.system), carry: { ship: g.t.ship, credits: g.t.credits, weapons: [...g.t.weapons], shields: [...g.t.shields], pods: g.t.pods } };
        data.game = null;
        data.requests.clear();
        data.days.clear();
      },
      restart: () => {
        data.waiting = null;
        data.market.clear();
        data.game = null;
        data.requests.clear();
        data.days.clear();
      },
    },
  };
}
