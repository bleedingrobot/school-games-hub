/** Toon Flap's trial backend: the whole game in this browser, for the preview. Never talks to the school's server. */
import { emptyData, memoryServices, type MemoryData } from '../../../shared/toonflap/memoryServices';
import { handleToonFlap } from '../../../shared/toonflap/server';
import type { Progress } from '../../../shared/toonflap/collection';
import { LEVELS } from '../../../shared/toonflap/levels';
import { fromServer } from './backend';

interface TrialSave {
  data: MemoryData;
  maths: boolean;
}

/** The preview's one pretend pupil. */
const PUPIL = 'preview-pupil';

/** The whole game in this browser, kept under `storageKey`, plus the preview's tools. Never talks to the school's server. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const fresh = (): TrialSave => ({ data: emptyData(), maths: true });
  const read = (): TrialSave => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as TrialSave | null;
      if (saved?.data?.players && Array.isArray(saved.data.runs)) return saved;
    } catch {
      // A private window, or an old save: start fresh.
    }
    return fresh();
  };
  let save = read();
  const write = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(save));
    } catch {
      // Not kept: it lasts until the page closes.
    }
  };
  // The preview has no wait for real time: a run can be checked as soon as it finishes (the pretend clock runs ahead).
  let ahead = 0;
  const services = () =>
    memoryServices({ data: save.data, settings: () => ({ enabled: true, maths: save.maths, readTime: true }), now: () => Date.now() + ahead, changed: write });

  const backend = fromServer(async (body) => {
    save = read();
    if (body.action === 'finish') ahead += 10 * 60 * 1000;
    return handleToonFlap(services(), PUPIL, body);
  });

  const progress = (): Progress => save.data.players[PUPIL]?.progress ?? { levels: {}, checksRight: 0, streak: 0, cleanFlights: 0, rightGaps: 0, potions: 0, potionsEarned: 0 };
  const setProgress = (p: Progress) => {
    const had = save.data.players[PUPIL] ?? { progress: p, picks: { flyer: 'fantail', trail: null }, version: 0 };
    save.data.players[PUPIL] = { ...had, progress: p, version: had.version + 1 };
    write();
  };

  /** Preview-only buttons. */
  const tools = {
    openAll: () => {
      const p = progress();
      const levels = { ...p.levels };
      for (const l of LEVELS) levels[l.id] = { finishes: Math.max(levels[l.id]?.finishes ?? 0, 1), best: levels[l.id]?.best ?? null, bestPlain: levels[l.id]?.bestPlain ?? null, medal: levels[l.id]?.medal ?? 'bronze' };
      setProgress({ ...p, levels, opened: LEVELS.length });
    },
    /** Jumps the pretend clock a day on, so the next level can open (only one opens a day). */
    nextDay: () => {
      ahead += 24 * 60 * 60 * 1000;
    },
    unlockAll: () => {
      const p = progress();
      const levels = { ...p.levels };
      for (const l of LEVELS) levels[l.id] = { finishes: 3, best: levels[l.id]?.best ?? null, bestPlain: levels[l.id]?.bestPlain ?? null, medal: 'gold' };
      setProgress({ ...p, levels, opened: LEVELS.length, checksRight: Math.max(p.checksRight, 20), cleanFlights: Math.max(p.cleanFlights, 3), potions: 3 });
    },
    setMaths: (on: boolean) => {
      save.maths = on;
      write();
    },
    maths: () => save.maths,
    restart: () => {
      save = { ...fresh(), maths: save.maths };
      write();
    },
  };
  return { backend, tools };
}
