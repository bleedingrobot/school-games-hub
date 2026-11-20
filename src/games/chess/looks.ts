import { useSyncExternalStore } from 'react';
import castle from './art/bg/castle.webp';
import castleSmall from './art/bg/castle-800.webp';
import coast from './art/bg/coast.webp';
import coastSmall from './art/bg/coast-800.webp';
import forest from './art/bg/forest.webp';
import forestSmall from './art/bg/forest-800.webp';
import snow from './art/bg/snow.webp';
import snowSmall from './art/bg/snow-800.webp';
import space from './art/bg/space.webp';
import spaceSmall from './art/bg/space-800.webp';
import underwater from './art/bg/underwater.webp';
import underwaterSmall from './art/bg/underwater-800.webp';
import volcano from './art/bg/volcano.webp';
import volcanoSmall from './art/bg/volcano-800.webp';
import beachDark from './art/board/beach-dark.webp';
import beachLight from './art/board/beach-light.webp';
import lavaDark from './art/board/lava-dark.webp';
import lavaLight from './art/board/lava-light.webp';
import marbleDark from './art/board/marble-dark.webp';
import marbleLight from './art/board/marble-light.webp';
import starfieldDark from './art/board/starfield-dark.webp';
import starfieldLight from './art/board/starfield-light.webp';
import { fetchLooks, markSeen, saveLook, type LookData, type LookKind } from './lookData';

export type { LookKind } from './lookData';

/** What drifts across each painting: the castle's gold dust, the forest's leaves, and so on. */
export type Particle = 'dust' | 'leaves' | 'spray' | 'embers' | 'snow' | 'bubbles' | 'stars';

export interface Look {
  kind: LookKind;
  id: string;
  name: string;
  /** How to unlock it, in pupil words. Null for the ones everyone has. */
  how: string | null;
  /** The words under the progress bar, e.g. "Win 3 more games". */
  toGo?: (left: number) => string;
  emoji: string;
}

export interface Background extends Look {
  kind: 'background';
  img: string;
  small: string;
  particle: Particle;
}

const games = (n: number) => `${n} more game${n === 1 ? '' : 's'}`;

/** The plan's unlock table (docs/CHESS-LOOK-PLAN.md). The server holds the rules; these are only the words. */
export const BACKGROUNDS: Background[] = [
  { kind: 'background', id: 'castle', name: 'Castle hall', how: null, emoji: '🏰', img: castle, small: castleSmall, particle: 'dust' },
  {
    kind: 'background', id: 'forest', name: 'Forest clearing', emoji: '🌳', img: forest, small: forestSmall, particle: 'leaves',
    how: 'Castle your king in a game (move the king two squares towards a rook).',
  },
  { kind: 'background', id: 'coast', name: 'Wairarapa coast at sunset', emoji: '🌅', img: coast, small: coastSmall, particle: 'spray', how: 'Win a game.' },
  { kind: 'background', id: 'volcano', name: 'Volcano', emoji: '🌋', img: volcano, small: volcanoSmall, particle: 'embers', how: 'Checkmate with a knight.' },
  {
    kind: 'background', id: 'snow', name: 'Snowy mountain top', emoji: '🏔️', img: snow, small: snowSmall, particle: 'snow',
    how: 'Play 25 games.', toGo: (n) => `Play ${games(n)}`,
  },
  {
    kind: 'background', id: 'underwater', name: 'Underwater palace', emoji: '🐠', img: underwater, small: underwaterSmall, particle: 'bubbles',
    how: 'Promote a pawn: get one all the way to the far end.',
  },
  { kind: 'background', id: 'space', name: 'Space station', emoji: '🚀', img: space, small: spaceSmall, particle: 'stars', how: 'Win a game in under 20 of your moves.' },
];

/** Painted piece sets (art/set/<id>/), keeping the normal chess shapes so they read on small squares. */
export const SETS: Look[] = [
  { kind: 'set', id: 'classic', name: 'Classic', how: null, emoji: '♞' },
  { kind: 'set', id: 'wood', name: 'Carved Wood', emoji: '🪵', how: 'Finish 3 games.', toGo: (n) => `Finish ${games(n)}` },
  { kind: 'set', id: 'birds', name: 'Bush Birds', emoji: '🥝', how: 'Beat the Very Easy bot.' },
  { kind: 'set', id: 'ice', name: 'Ice Crystal', emoji: '🧊', how: 'Beat the Easy bot.' },
  { kind: 'set', id: 'robot', name: 'Robot', emoji: '🤖', how: 'Play 10 games against classmates.', toGo: (n) => `Play ${games(n)} against classmates` },
  { kind: 'set', id: 'dragon', name: 'Dragon Knights', emoji: '🐉', how: 'Beat the Easy bot 5 times.', toGo: (n) => `Beat the Easy bot ${n} more time${n === 1 ? '' : 's'}` },
  { kind: 'set', id: 'golden', name: 'Golden', emoji: '👑', how: 'Win 20 games against anyone.', toGo: (n) => `Win ${games(n)}` },
];

/** What moves on each board: a gleam across the marble, sun glints on the beach, lava throbbing, stars twinkling. */
export type BoardFx = 'none' | 'gleam' | 'glint' | 'lava' | 'twinkle';

export interface BoardLook extends Look {
  kind: 'board';
  /** Painted textures for the light and dark squares. Classic wood has none: it keeps its flat colours. */
  light?: string;
  dark?: string;
  fx: BoardFx;
}

export const BOARDS: BoardLook[] = [
  { kind: 'board', id: 'classic', name: 'Classic wood', how: null, emoji: '🟫', fx: 'none' },
  {
    kind: 'board', id: 'marble', name: 'Marble', emoji: '🏛️', light: marbleLight, dark: marbleDark, fx: 'gleam',
    how: 'Win 5 games by checkmate.', toGo: (n) => `${n} more checkmate${n === 1 ? '' : 's'}`,
  },
  { kind: 'board', id: 'beach', name: 'Beach sand and shell', emoji: '🐚', light: beachLight, dark: beachDark, fx: 'glint', how: 'Win a game playing Black.' },
  {
    kind: 'board', id: 'lava', name: 'Glowing lava rock', emoji: '🔥', light: lavaLight, dark: lavaDark, fx: 'lava',
    how: 'Promote 3 pawns.', toGo: (n) => `Promote ${n} more pawn${n === 1 ? '' : 's'}`,
  },
  {
    kind: 'board', id: 'starfield', name: 'Starfield glass', emoji: '✨', light: starfieldLight, dark: starfieldDark, fx: 'twinkle',
    how: 'Win 5 games against classmates.', toGo: (n) => `Win ${games(n)} against classmates`,
  },
];

/** Kinds pupils can pick and see revealed: every kind now. */
export const READY_KINDS: LookKind[] = ['set', 'board', 'background'];

const PREFIX: Record<LookKind, string> = { set: 'set:', board: 'board:', background: 'bg:' };
export const keyOf = (look: Pick<Look, 'kind' | 'id'>) => PREFIX[look.kind] + look.id;
export const ALL_LOOKS: Look[] = [...BACKGROUNDS, ...SETS, ...BOARDS];
export const lookByKey = (key: string) => ALL_LOOKS.find((l) => keyOf(l) === key);
export const backgroundById = (id: string | undefined) => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
export const boardById = (id: string | undefined) => BOARDS.find((b) => b.id === id) ?? BOARDS[0];

// ---------- The pupil's looks, shared by every chess screen on the page ----------

interface State {
  data: LookData | null;
  /** Unlocks waiting to burst out of the treasure chest, oldest first. */
  reveal: string[];
  error: string | null;
}

let state: State = { data: null, reveal: [], error: null };
const listeners = new Set<() => void>();
let loading: Promise<void> | null = null;

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLooks() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** Loads the pupil's looks once per page. */
export function loadLooks(): Promise<void> {
  loading ??= fetchLooks()
    .then((data) => set({ data, error: null }))
    .catch(() => {
      loading = null;
    });
  return loading;
}

/**
 * After a game is saved: asks the server again, and queues any new unlock for the treasure chest. The server has already
 * written the unlock down when it saved the game.
 */
export async function checkUnlocks(): Promise<void> {
  try {
    const data = await fetchLooks();
    const waiting = new Set(state.reveal);
    const fresh = data.fresh.filter((key) => {
      const look = lookByKey(key);
      return look && READY_KINDS.includes(look.kind) && !waiting.has(key);
    });
    loading = Promise.resolve();
    set({ data, reveal: [...state.reveal, ...fresh] });
  } catch {
    // The chest can open next time.
  }
}

/** The chest has shown this one. */
export function revealShown(key: string) {
  set({ reveal: state.reveal.filter((k) => k !== key) });
  void markSeen([key]).catch(() => {});
}

export function isUnlocked(data: LookData | null, look: Look) {
  return look.how === null || !!data?.unlocked.includes(keyOf(look));
}

export function chosenId(data: LookData | null, kind: LookKind) {
  if (!data) return kind === 'background' ? 'castle' : 'classic';
  return kind === 'set' ? data.set : kind === 'board' ? data.board : data.background;
}

/** Equip a look. Shows straight away; goes back if the server says no. */
export async function chooseLook(kind: LookKind, id: string): Promise<void> {
  const before = state.data;
  const key = keyOf({ kind, id });
  if (before) set({ data: { ...before, [kind]: id } });
  try {
    const data = await saveLook(kind, id);
    // Picked straight from the Locker: the chest needn't show it any more.
    if (data.fresh.includes(key)) {
      void markSeen([key]).catch(() => {});
      data.fresh = data.fresh.filter((k) => k !== key);
    }
    set({ data, reveal: state.reveal.filter((k) => k !== key), error: null });
  } catch (e) {
    set({ data: before, error: e instanceof Error ? e.message : "We couldn't save that." });
  }
}
