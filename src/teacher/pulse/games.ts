/**
 * Every row on the Pulse's games table: the hub's games (registry), the two that live outside it (Quick looks, Basic facts
 * training), grouped like the dashboard, with Activities on their own. The server counts the same ids
 * (pulse_plays, migration 20261127074205_teacher_pulse.sql): a new game must be added there too, or it shows 0 goes.
 */
import { ALL_GAMES, GAMES } from '../../games/registry';
import type { GameDefinition } from '../../games/types';

export type PulseGroup = 'foundational' | 'no-maths' | 'easy-maths' | 'complex-maths' | 'activities' | 'practice';

export const PULSE_GROUPS: { group: PulseGroup; title: string }[] = [
  { group: 'foundational', title: 'Foundational skills' },
  { group: 'no-maths', title: 'No maths' },
  { group: 'easy-maths', title: 'Easy maths' },
  { group: 'complex-maths', title: 'Complex maths' },
  { group: 'activities', title: 'Activities' },
  { group: 'practice', title: 'Maths practice' },
];

export interface PulseRow {
  id: string;
  name: string;
  tagline: string;
  group: PulseGroup;
  /** The registry game, for its on/off switch; null for Quick looks and training. */
  game: GameDefinition | null;
  inDevelopment: boolean;
  /** What one go is, in the game's words. */
  unit: string;
}

/** What one counted go is, where it isn't "a finished game". */
const UNITS: Record<string, string> = {
  trader: 'days played',
  classlive: 'pupils joining a session',
  showdown: 'pupils joining a battle',
  glyph: 'temple goes started',
  orderup: 'sets started',
  'quick-looks': 'sessions',
  training: 'sessions',
  kingdom: 'reigns',
  decree: 'reigns',
  marble: 'runs',
  toonflap: 'runs',
  goblinstorm: 'runs',
  circuit: 'races',
  mine: 'runs',
  starweb: 'skies finished',
};

const EXTRA: PulseRow[] = [
  { id: 'quick-looks', name: 'Quick looks', tagline: 'See small numbers at a glance (subitising)', group: 'foundational', game: null, inDevelopment: false, unit: UNITS['quick-looks'] },
  { id: 'training', name: 'Basic facts training', tagline: 'Quick daily practice of the basic facts', group: 'practice', game: null, inDevelopment: false, unit: UNITS.training },
];

const rowOf = (g: GameDefinition): PulseRow => ({
  id: g.id,
  name: g.name,
  tagline: g.tagline,
  group: g.activity ? 'activities' : (g.group ?? 'complex-maths'),
  game: g,
  inDevelopment: g.inDevelopment === true,
  unit: UNITS[g.id] ?? (g.group === 'foundational' ? 'rounds' : 'games'),
});

/** Every game on the hub now, plus any the server counted that isn't switched on in code any more. */
export function pulseRows(countedIds: string[] = []): PulseRow[] {
  const rows = [...GAMES.map(rowOf), ...EXTRA];
  for (const id of countedIds) {
    if (rows.some((r) => r.id === id)) continue;
    const old = ALL_GAMES.find((g) => g.id === id);
    if (old) rows.push(rowOf(old));
  }
  return rows;
}
