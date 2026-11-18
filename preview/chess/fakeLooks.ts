// The preview saves nothing: these stand in for src/games/chess/lookData. The pupil starts with the coast unlocked
// (and not yet revealed), and every finished game unlocks the next board or background, so the treasure chest can be
// watched. Add board=lava (or marble, beach, starfield) to the address to start on that board, e.g. #show&board=lava.
import type { LookData, LookKind } from '../../src/games/chess/lookData';

const ORDER = ['board:beach', 'board:starfield', 'bg:forest', 'bg:volcano', 'bg:snow', 'bg:underwater', 'bg:space'];
let fetches = 0;
const state: LookData = {
  set: 'classic',
  board: /board=(\w+)/.exec(location.hash)?.[1] ?? 'classic',
  background: 'castle',
  unlocked: ['bg:coast', 'set:wood', 'board:marble', 'board:lava'],
  fresh: ['bg:coast', 'board:lava'],
  progress: {
    'set:wood': { have: 3, need: 3 }, 'set:birds': { have: 0, need: 1 }, 'set:ice': { have: 0, need: 1 },
    'set:robot': { have: 4, need: 10 }, 'set:dragon': { have: 2, need: 5 }, 'set:golden': { have: 7, need: 20 },
    'board:marble': { have: 1, need: 5 }, 'board:beach': { have: 0, need: 1 }, 'board:lava': { have: 1, need: 3 },
    'board:starfield': { have: 0, need: 5 }, 'bg:forest': { have: 0, need: 1 }, 'bg:coast': { have: 1, need: 1 },
    'bg:volcano': { have: 0, need: 1 }, 'bg:snow': { have: 11, need: 25 }, 'bg:underwater': { have: 0, need: 1 },
    'bg:space': { have: 0, need: 1 },
  },
};
const copy = () => structuredClone(state);

export async function fetchLooks(): Promise<LookData> {
  fetches += 1;
  if (fetches > 1 || location.hash.startsWith('#reveal')) {
    const next = ORDER.find((k) => !state.unlocked.includes(k));
    if (next) {
      state.unlocked.push(next);
      state.fresh.push(next);
    }
  }
  return copy();
}

export async function saveLook(kind: LookKind, item: string): Promise<LookData> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  state[kind] = item;
  return copy();
}

export async function markSeen(items: string[]): Promise<void> {
  state.fresh = state.fresh.filter((k) => !items.includes(k));
}
