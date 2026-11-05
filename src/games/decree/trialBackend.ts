/**
 * The browser-only Royal Decree (preview/decree): the SAME rules the school's server runs (handleDecree), with the
 * reigns kept in this browser. The maths is a fixed pretend pupil (times tables), so nothing is ever sent anywhere.
 * The live game never uses this.
 */
import { memoryServices, type MemoryData } from '../../../shared/decree/memoryServices';
import { handleDecree } from '../../../shared/decree/server';
import { readReply, type DecreeBackend } from './backend';

const KEY = 'decree-trial';

function loadData(key: string): MemoryData | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as MemoryData) : undefined;
  } catch {
    return undefined;
  }
}

export function createTrialBackend(name = 'preview', options: { save?: boolean; random?: () => number } = {}): DecreeBackend {
  const key = `${KEY}:${name}`;
  const save = options.save ?? true;
  const services = memoryServices({
    data: save ? loadData(key) : undefined,
    maths: () => ({ facts: [], settings: {} }),
    random: options.random,
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
      const r = await handleDecree(services, 'trial', body);
      return readReply(r.status, r.body);
    },
  };
}
