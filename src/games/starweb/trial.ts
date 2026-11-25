/**
 * Star Web's trial backend: the very same server rules (shared/starweb/server.ts) on services kept in this browser, for the
 * preview. Never talks to the school's server. The pretend pupil knows a fixed handful of times-table facts.
 */
import type { FactStats } from '../../../shared/maths/leitner';
import { emptyData, memoryServices, type MemoryData } from '../../../shared/starweb/memoryServices';
import { handleStarWeb } from '../../../shared/starweb/server';
import { FREE_AFTER_LIT, TABLES, type Medal } from '../../../shared/starweb/config';
import { fromServer } from './backend';

const KNOWN = ['mul:2x5', 'mul:3x4', 'mul:4x6', 'mul:6x7', 'mul:4x8', 'mul:3x9', 'mul:5x7', 'mul:6x8', 'mul:7x8', 'mul:8x9', 'mul:9x11', 'mul:7x12'];
const FACTS: FactStats[] = KNOWN.map((key) => ({ key, attempts: 8, correct: 8, avgMs: 2500, box: 4, lastSeen: 0, quickDays: ['2026-11-20', '2026-11-21'] }));
const PLAYER = 'preview-pupil';

export function trialBackend({ storageKey }: { storageKey: string }) {
  const read = (): MemoryData => {
    try {
      const d = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as MemoryData | null;
      if (d && d.players && Array.isArray(d.skies)) return d;
    } catch {
      // A private window, or an old save: start fresh.
    }
    return emptyData();
  };
  const data = read();
  const write = (d: MemoryData) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(d));
    } catch {
      // Not kept: it lasts until the page closes.
    }
  };
  // The preview is quick to try: no one-star-a-second limit against a pretend clock that runs a minute ahead each call.
  let clock = Date.now();
  const services = memoryServices({ data, facts: () => FACTS, changed: write, now: () => (clock += 60_000) });
  const backend = fromServer(async (body) => handleStarWeb(services, PLAYER, body));

  const tools = {
    /** Skip the guide and light a few tables, so the Star Map and Free sky can be seen. */
    lightSome: () => {
      const saved = data.players[PLAYER] ?? { progress: { tables: {}, lit: 0, gold: 0, stars: 0, nohint: 0, recent: [], guideSeen: false }, version: 0 };
      const tables: Record<string, Medal> = {};
      TABLES.slice(0, 9).forEach((t, i) => { tables[String(t)] = ((i % 3) + 1) as Medal; });
      data.players[PLAYER] = { progress: { ...saved.progress, tables, lit: FREE_AFTER_LIT + 3, stars: 180, guideSeen: true }, version: saved.version + 1 };
      write(data);
    },
    restart: () => {
      data.players = {};
      data.skies = [];
      write(data);
    },
  };
  return { backend, tools };
}
