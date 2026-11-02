/**
 * A browser-only stand-in for Diamond Drop's server, so the preview (and the tests) can play the whole game with no
 * sign-in. It runs the server's own rules (shared/diamond/server.ts) on an in-memory copy of the database
 * (shared/diamond/memoryServices.ts), with a fixed pretend maths focus. Nothing leaves the browser.
 */
import { AUTO_FOCUS, type MathsFocus } from '../../../shared/maths/focus';
import type { MathsContext } from '../../../shared/maths/serverQuestions';
import { LAST_LEVEL } from '../../../shared/diamond/config';
import { emptyData, memoryServices, type MemoryData } from '../../../shared/diamond/memoryServices';
import { nzDate, newPlayer } from '../../../shared/diamond/progress';
import { handleDiamond } from '../../../shared/diamond/server';
import { fromServer, type DiamondBackend, type HallRow } from './backend';

/** The preview's pretend pupil works on times tables (with a little review), whatever the real class does. */
export const PREVIEW_FOCUS: MathsFocus = { ...AUTO_FOCUS, source: 'teacher-class', skills: ['times-tables'], onlyThese: false };
const PREVIEW_MATHS: MathsContext = { facts: [], settings: { multipleChoice: false }, focus: PREVIEW_FOCUS };

/** The pretend pupil, and some pretend classmates for the Hall. */
const ME = 'preview-pupil';
const CLASSMATES: HallRow[] = [
  { name: 'Brave Kea', found: '2026-10-28', worn: { head: 'dino-jaw', hat: 'pirate-hat' }, me: false },
  { name: 'Swift Tui', found: '2026-10-21', worn: { head: 'golden-claw', rope: 'rainbow-rope' }, me: false },
];

export interface TrialOptions {
  /** A fixed clock for tests (milliseconds); the preview uses the real one plus any "pretend tomorrow". */
  now?: () => number;
  /** Keep the pretend pupil in this browser's storage under this key, so the preview remembers them. */
  storageKey?: string;
  /** Seeds for new levels (tests pass a fixed list), as a random number from 0 to 1. */
  random?: () => number;
}

export interface Trial {
  backend: DiamondBackend;
  /** Every request, for tests. */
  log: { type: string; body: unknown }[];
  /** Preview tools (never in the real game). Reload the game after each. */
  tools: {
    give(coins: number): void;
    /** Pretend it is tomorrow, so the next level opens now. */
    nextDay(): void;
    /** Pretend every level above this one is passed (and today's new level not yet used). */
    jumpTo(level: number): void;
    restart(): void;
  };
}

interface Stored {
  db: MemoryData;
  skippedDays: number;
}

export function trialBackend(options: TrialOptions = {}): Trial {
  const read = (): Stored => {
    try {
      const raw = options.storageKey ? localStorage.getItem(options.storageKey) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Stored>;
        if (parsed.db?.players && parsed.db.levels) return { db: { ...parsed.db, finds: parsed.db.finds ?? [] }, skippedDays: parsed.skippedDays ?? 0 };
      }
    } catch {
      // Start fresh.
    }
    return { db: emptyData(), skippedDays: 0 };
  };
  const stored = read();
  const save = () => {
    try {
      if (options.storageKey) localStorage.setItem(options.storageKey, JSON.stringify(stored));
    } catch {
      // Not remembered, that's all.
    }
  };
  const clock = options.now ?? (() => Date.now());
  const now = () => clock() + stored.skippedDays * 86_400_000;
  const services = memoryServices({ data: stored.db, now, random: options.random, maths: () => PREVIEW_MATHS, changed: save });
  const log: Trial['log'] = [];

  const backend = fromServer(
    async (body) => {
      log.push({ type: String(body.action), body });
      return handleDiamond(services, ME, body);
    },
    async () => {
      const mine = stored.db.finds.find((f) => f.player === ME);
      const me: HallRow[] = mine ? [{ name: 'You', found: nzDate(new Date(mine.at)), worn: stored.db.players[ME]?.player.worn ?? {}, me: true }] : [];
      return { ok: true, value: [...me, ...CLASSMATES] };
    },
  );

  const player = () => {
    const saved = (stored.db.players[ME] ??= { player: newPlayer(), version: 0 });
    saved.version++;
    return saved.player;
  };

  return {
    backend,
    log,
    tools: {
      give(coins) {
        player().coins += coins;
        save();
      },
      nextDay() {
        stored.skippedDays++;
        save();
      },
      jumpTo(level) {
        const p = player();
        p.deepest = Math.max(0, Math.min(LAST_LEVEL, level - 1));
        p.newLevelDate = null;
        p.stars = p.stars.map((s, i) => (i < p.deepest ? Math.max(s, 1) : 0));
        p.lifetime.plays = Math.max(p.lifetime.plays, 1);
        save();
      },
      restart() {
        Object.assign(stored.db, emptyData());
        stored.skippedDays = 0;
        save();
      },
    },
  };
}
