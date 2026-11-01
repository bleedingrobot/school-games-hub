/**
 * The browser-only Sky Isles (preview/isles): the SAME rules the school's server runs (handleIsles), with the island
 * kept in this browser. The maths is a fixed pretend pupil, so nothing is ever sent anywhere. The live game never uses
 * this. `daysAhead` moves the clock on, so the preview can skip to a later day.
 */
import { AUTO_FOCUS } from '../../../shared/maths/focus';
import { memoryServices, type MemoryData } from '../../../shared/isles/memoryServices';
import { handleIsles } from '../../../shared/isles/server';
import { readReply, type IslesBackend } from './backend';

const KEY = 'isles-trial';
const DAY_MS = 86_400_000;

function loadData(key: string): MemoryData | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as MemoryData) : undefined;
  } catch {
    return undefined;
  }
}

/** Forgets the trial island (the preview's "Start again"). */
export function forgetTrial(name = 'preview') {
  try {
    localStorage.removeItem(`${KEY}:${name}`);
  } catch {
    // Nothing kept, nothing to forget.
  }
}

export function createTrialBackend(name = 'preview', options: { save?: boolean; random?: () => number; daysAhead?: () => number } = {}): IslesBackend {
  const key = `${KEY}:${name}`;
  const save = options.save ?? true;
  const services = memoryServices({
    data: save ? loadData(key) : undefined,
    // A pretend pupil on auto, starting on the ladder's first skills, with typed answers.
    maths: () => ({ facts: [], settings: { enabledTables: [2, 3, 4, 5, 10], division: false, multipleChoice: false }, focus: AUTO_FOCUS }),
    random: options.random,
    now: () => Date.now() + (options.daysAhead?.() ?? 0) * DAY_MS,
    changed: (data) => {
      if (!save) return;
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        // Private windows can refuse: the trial still works until the page is closed.
      }
    },
  });
  return {
    trial: true,
    async send(body) {
      const r = await handleIsles(services, 'trial', body);
      return readReply(r.status, r.body);
    },
  };
}
