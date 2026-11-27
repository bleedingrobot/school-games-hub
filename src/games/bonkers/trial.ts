/** Smash Quest's trial backend: the whole game in this browser, for the preview. Never talks to the school's server. */
import { emptyData, memoryServices, type MemoryData } from '../../../shared/bonkers/memoryServices';
import { handleBonkers } from '../../../shared/bonkers/server';
import { emptyProgress, starsToTrainer, type Progress } from '../../../shared/bonkers/engine';
import { MAX_LEVEL } from '../../../shared/bonkers/config';
import { fromServer } from './backend';

/** The preview's one pretend pupil. */
const PUPIL = 'preview-pupil';

/** The whole game in this browser, kept under `storageKey`, plus the preview's tools. */
export function trialBackend({ storageKey }: { storageKey: string }) {
  const read = (): MemoryData => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as MemoryData | null;
      if (saved?.players && Array.isArray(saved.adventures)) return saved;
    } catch {
      // A private window, or an old save: start fresh.
    }
    return emptyData();
  };
  let data = read();
  const write = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // Not kept: it lasts until the page closes.
    }
  };
  // The preview's "Unlimited today": on, so testers can play adventure after adventure.
  let unlimited = true;
  const backend = fromServer(async (body) => {
    data = read();
    return handleBonkers(memoryServices({ data, settings: () => ({ enabled: true, unlimited }), changed: write }), PUPIL, body);
  });

  const progress = (): Progress => data.players[PUPIL]?.progress ?? emptyProgress();
  const setProgress = (p: Progress) => {
    const had = data.players[PUPIL] ?? { progress: p, version: 0 };
    data.players[PUPIL] = { progress: p, version: had.version + 1 };
    write();
  };

  /** Preview-only buttons. */
  const tools = {
    /** The star bar full, so the trainer comes after the next adventure's fights. */
    fillBar: () => {
      const p = progress();
      if (p.level < MAX_LEVEL) setProgress({ ...p, stars: starsToTrainer(p.level) });
    },
    /** Up a level (and the zones it opens). */
    levelUp: () => {
      const p = progress();
      setProgress({ ...p, level: Math.min(MAX_LEVEL, p.level + 1), stars: 0 });
    },
    setUnlimited: (on: boolean) => {
      unlimited = on;
    },
    reset: () => {
      data = emptyData();
      write();
    },
  };
  return { backend, tools };
}
