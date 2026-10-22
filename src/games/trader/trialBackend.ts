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
import { makeHandler, type ClassSettings, type Saved, type SaveArgs, type Services, type StoredDay } from '../../../supabase/functions/trader/handler';
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
  data: { game: Saved | null; days: Map<number, StoredDay>; requests: Map<string, unknown>; records: { once: string }[]; settings: ClassSettings; skippedDays: number; market: SchoolMarket };
  /** Test tools for the preview (never in the real game). Each changes the pretend database; reload the game after. */
  tools: {
    give(credits: number): void;
    setShip(ship: number): void;
    forcePirates(tier: number): void;
    nextDay(): void;
    /** Pretend classmates trade all day on the school's market, so the news and moved prices can be seen. */
    busySchool(pupils?: number): void;
    restart(): void;
  };
}

export function trialBackend(options: TrialOptions = {}): Trial {
  const data: Trial['data'] = {
    game: null,
    days: new Map(),
    requests: new Map(),
    records: [],
    settings: { enabled: true, ...DEFAULT_SETTINGS, ...options.settings },
    skippedDays: 0,
    market: new SchoolMarket(),
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
      restart: () => {
        data.market.clear();
        data.game = null;
        data.requests.clear();
        data.days.clear();
      },
    },
  };
}
