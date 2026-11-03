/**
 * The browser-only Sky Isles (preview/isles): the SAME rules the school's server runs (handleIsles), with the island
 * kept in this browser. The maths is a fixed pretend pupil, so nothing is ever sent anywhere. The live game never uses
 * this. `daysAhead` moves the clock on, so the preview can skip to a later day.
 */
import { AUTO_FOCUS } from '../../../shared/maths/focus';
import type { DecorationId, PlotOrEmpty } from '../../../shared/isles/config';
import { newIsland, placeCount, type Island } from '../../../shared/isles/engine';
import { memoryServices, type MemoryData } from '../../../shared/isles/memoryServices';
import { handleIsles, nzDay } from '../../../shared/isles/server';
import { readReply, type IslesBackend } from './backend';

// A new name for the cosy rules (3 Nov 2026), so an island saved under the old rules is left behind, not loaded.
const KEY = 'isles-trial-cosy';
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

/** A pretend classmate's island: its size, buildings, decorations and turns played (past the calm start or not). */
function pretendIsland(spots: number, turn: number, decorations: DecorationId[], lighthouse = 0): Island {
  const kinds: PlotOrEmpty[] = ['farm', 'mine', 'house', 'dock', 'workshop', 'library', 'farm', 'house'];
  const base = newIsland();
  const island: Island = {
    ...base,
    turn,
    lighthouse,
    islanders: 20 + spots * 4,
    spots: Array.from({ length: spots }, (_, i) => ({ kind: kinds[i % kinds.length], level: 1 + ((i * 7) % 3 === 0 ? 1 : 0) + (spots >= 14 && i % 4 === 0 ? 1 : 0) })),
  };
  return { ...island, decorations: decorations.slice(0, placeCount(island)).map((id, place) => ({ id, place })) };
}

/**
 * The preview's pretend class (stage S.4): six classmates' islands to look at, race and give gifts to, one of them
 * still in its calm start, a gift waiting in the post and some news. Only ever in the preview.
 */
export function pretendClass(data: MemoryData, today: number) {
  if (data.names && Object.keys(data.names).length > 1) return;
  const mates: [string, string, string, string | null, Island][] = [
    ['mate-ana', 'Ana', 'g03', 'Honey Meadow', pretendIsland(12, 40, ['flowers', 'cherry', 'fountain', 'bench', 'chimes'])],
    ['mate-rawiri', 'Rawiri', 'b05', 'Puffin Cove', pretendIsland(9, 26, ['lantern', 'flags'])],
    ['mate-mere', 'Mere', 'g11', 'Starlight Haven', pretendIsland(16, 70, ['rainbow', 'balloon', 'fountain', 'cherry', 'bridge', 'flowers', 'arch', 'telescope'], 4)],
    ['mate-tama', 'Tama', 'b12', null, pretendIsland(7, 15, ['flowers'])],
    ['mate-sione', 'Sione', 'b17', 'Misty Peak', pretendIsland(10, 33, ['bench', 'bridge', 'chimes'])],
    ['mate-lily', 'Lily', 'g08', null, pretendIsland(6, 4, [])],
  ];
  data.names = { ...(data.names ?? {}), trial: 'You' };
  for (const [id, name, keeper, islandName, island] of mates) {
    data.names[id] = name;
    data.islands[id] = { seed: id.padEnd(32, '0'), season: 1, version: 1, day: today, island, guideDone: true, keeper, name: islandName };
  }
  // Last season's Hall of the Skies, so the preview has one to show.
  const ended = new Date((today - 9) * 86_400_000).toISOString().slice(0, 10);
  data.hall = [{
    ended,
    entries: [
      { player: 'mate-mere', islandName: 'Starlight Haven', keeper: 'g11', worth: 742, place: 1, lit: true },
      { player: 'mate-sione', islandName: 'Misty Peak', keeper: 'b17', worth: 516, place: 2, lit: false },
      { player: 'mate-ana', islandName: 'Honey Meadow', keeper: 'g03', worth: 488, place: 3, lit: false },
      { player: 'mate-rawiri', islandName: 'Puffin Cove', keeper: 'b05', worth: 455, place: null, lit: true },
    ],
  }];
  data.post = [...(data.post ?? []), { id: 1, from: 'mate-ana', to: 'trial', day: today, opened: false, kind: 'gift', gift: 'cake', coins: 10 }];
  data.news = [
    ...(data.news ?? []),
    { player: 'mate-mere', day: today - 2, kind: 'lighthouse' },
    { player: 'mate-ana', day: today - 1, kind: 'spots', spots: 12 },
    { player: 'mate-rawiri', day: today - 1, kind: 'race', gullRiders: true },
    { player: 'mate-sione', day: today, kind: 'decoration', id: 'bridge' },
  ];
}

export function createTrialBackend(name = 'preview', options: { save?: boolean; random?: () => number; daysAhead?: () => number } = {}): IslesBackend {
  const key = `${KEY}:${name}`;
  const save = options.save ?? true;
  const now = () => Date.now() + (options.daysAhead?.() ?? 0) * DAY_MS;
  const data: MemoryData = (save ? loadData(key) : undefined) ?? { islands: {}, turns: [], questions: [], races: [], nextRace: 1 };
  pretendClass(data, nzDay(now()));
  const services = memoryServices({
    data,
    // A pretend pupil on auto, starting on the ladder's first skills, with typed answers.
    maths: () => ({ facts: [], settings: { enabledTables: [2, 3, 4, 5, 10], division: false, multipleChoice: false }, focus: AUTO_FOCUS }),
    random: options.random,
    now,
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
