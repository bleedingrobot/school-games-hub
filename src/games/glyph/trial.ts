/** Glyph Gates' trial backend: the same rules, in this browser, for the preview. Never talks to the school's server. */
import { MIN_GO_MS } from '../../../shared/glyph/config';
import { emptyProgress, progressAfter, replayTemple, type Progress, type WallPlay } from '../../../shared/glyph/play';
import { makeTemple, publicWall } from '../../../shared/glyph/walls';
import { TOP_TEMPLE } from '../../../shared/glyph/config';
import type { FinishReply, GlyphBackend, StartReply } from './backend';

/** A pretend pupil kept under `storageKey`, plus the preview's tools. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const read = (): Progress => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Progress | null;
      if (saved && typeof saved.passed === 'number' && saved.help) return saved;
    } catch {
      // A private window, or an old save: start fresh.
    }
    return emptyProgress();
  };
  let progress = read();
  const write = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progress));
    } catch {
      // Not kept: it lasts until the page closes.
    }
  };
  const done = new Set<string>();

  const backend: GlyphBackend = {
    load: async () => ({ enabled: true, progress, today: new Date().toISOString().slice(0, 10) }),
    start: async (temple): Promise<StartReply> => {
      const seed = Math.random().toString(36).slice(2, 10);
      return { seed, temple, walls: makeTemple(seed, temple).map(publicWall), help: progress.help.level };
    },
    finish: async (seed: string, plays: WallPlay[]): Promise<FinishReply> => {
      if (done.has(seed)) return { already: true };
      done.add(seed);
      const temple = lastTemple;
      const clean = plays.map((p) => ({ ...p, goes: p.goes.map((g) => ({ ...g, ms: Math.max(g.ms, MIN_GO_MS) })) }));
      const result = replayTemple(makeTemple(seed, temple), clean);
      progress = progressAfter(progress, temple, result);
      write();
      return { result, progress, points: result.finished ? (result.passed ? 5 : 2) : 0 };
    },
    guideSeen: async () => {
      progress = { ...progress, guideSeen: true };
      write();
    },
  };
  // The seed doesn't carry the temple, so remember the one just started.
  let lastTemple = 1;
  const start = backend.start;
  backend.start = async (temple) => {
    lastTemple = temple;
    return start(temple);
  };

  const tools = {
    openAll: () => {
      progress = { ...progress, passed: TOP_TEMPLE - 1, guideSeen: true };
      write();
    },
    restart: () => {
      progress = emptyProgress();
      write();
    },
  };
  return { backend, tools };
}
