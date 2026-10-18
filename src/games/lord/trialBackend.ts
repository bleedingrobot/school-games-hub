import { emptyDb, memoryServices, type MemoryDb, type MemoryOptions } from '../../../shared/lord/memoryServices';
import { ALL_TOPICS } from '../../../shared/lord/maths';
import { runLord } from '../../../shared/lord/server';
import type { LordBackend, Sent } from '../../data/lord';

/**
 * The browser-only Dragon Maths (preview/lord): the SAME rules the school's server runs (`runLord`), against a
 * little database kept in this browser, with the pupil as their own teacher so the test tools work. Nothing is
 * sent anywhere. The live game never uses this: it talks to the `lord` server function (src/data/lord.ts).
 */
export function createLocalBackend(db: MemoryDb, options: MemoryOptions & { trial?: boolean } = {}): LordBackend {
  const services = memoryServices(db, options);
  return {
    trial: options.trial ?? true,
    waiting: () => 0,
    flush: async () => 'done',
    // The trial keeps its own little news, a Warriors list of one and its own Hall of Heroes.
    fetchNews: async () => [...db.news].reverse().map((n) => ({ day: n.day, kind: n.kind, line: n.text.replace('{p}', 'You') })),
    fetchWarriors: async () =>
      db.row
        ? [{ place: 1, display_name: 'You', avatar: null, level: db.row.hero.level, stars: db.row.hero.dragonKills, dragons: db.hall.reduce((n, h) => n + h.kills, 0), is_me: true }]
        : [],
    fetchHall: async () => [...db.hall].sort((a, b) => b.season - a.season).map((h) => ({ season: h.season, display_name: 'You', avatar: null, kills: h.kills, is_me: true })),
    async load() {
      const out = await runLord(services, 'trial', { action: 'load' });
      if (out.status !== 200 || !('ok' in out.body)) return { kind: 'offline' };
      if (!out.body.ok) {
        if (out.body.reason === 'closed') return { kind: 'closed' };
        if (out.body.reason === 'not-started') return { kind: 'not-started', message: out.body.message ?? '' };
        return { kind: 'offline' };
      }
      return { kind: 'ready', state: out.body.state, facts: [], teacher: db.teacher, abandoned: (out.body.result as { abandoned?: 'forest' | 'master' | 'dragon' }).abandoned };
    },
    async send(request): Promise<Sent> {
      const out = await runLord(services, 'trial', request);
      if (out.status !== 200 || !('ok' in out.body)) return { kind: 'offline' };
      return { kind: 'reply', reply: out.body };
    },
  };
}

const key = (player: string) => `dragon-maths:trial2:${player || 'guest'}`;

/** The trial in the browser: the hero is kept in localStorage so it survives a refresh. */
export function createTrialBackend(player: string): LordBackend {
  let db: MemoryDb = emptyDb({ enabled: true });
  try {
    const raw = window.localStorage.getItem(key(player));
    if (raw) db = { ...db, ...(JSON.parse(raw) as Partial<MemoryDb>) };
  } catch {
    /* a fresh trial */
  }
  db.teacher = true;
  db.settings = { enabled: true, forestPerDay: 10, seasonStart: null, topics: [...ALL_TOPICS] };
  return createLocalBackend(db, {
    onChange: (d) => {
      try {
        window.localStorage.setItem(key(player), JSON.stringify(d));
      } catch {
        /* storage blocked or full: the trial lasts until the page closes */
      }
    },
  });
}

export function clearTrial(player: string) {
  try {
    window.localStorage.removeItem(key(player));
  } catch {
    /* nothing to do */
  }
}
