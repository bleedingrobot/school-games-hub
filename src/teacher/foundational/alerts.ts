/**
 * Today's "Needs you" lines and "Hardest right now" rows for the Foundational games (R7 plan, 3.3), built from the same cached
 * class data as the grid. Each game's definition calls these lazily (`teacher.alerts`, `teacher.hardest`), so the games need no
 * shared edit. One line a game at most, counts and made-up display names only (Today may be on a projector), nothing for a
 * game the class has switched off, and nothing for "gone quiet", which is a grey flag and not an alert.
 */
import type { Flag, FlagKind } from '../../../shared/kit/teacherGrid';
import { weakestFacts } from '../../../shared/kit/teacherGrid';
import { fetchBeanstalkEnabled } from '../../data/beanstalk';
import { classFacts, foundationalClass, GAME_IDS, type FoundationalGameId } from '../../data/foundational';
import { fetchHopEnabled } from '../../data/hop';
import { fetchKororaEnabled } from '../../data/korora';
import { fetchLizardEnabled } from '../../data/lizard';
import { fetchParrotEnabled } from '../../data/parrot';
import { fetchPigeonEnabled } from '../../data/pigeon';
import { fetchPipiEnabled } from '../../data/pipi';
import { fetchRobinEnabled } from '../../data/robin';
import { fetchSwamphenEnabled } from '../../data/swamphen';
import { fetchTuiEnabled } from '../../data/tui';
import { fetchWekaEnabled } from '../../data/weka';
import type { HardestRow, TeacherAlert } from '../../games/types';
import { ALERT_NAMES, FLAG_RULES, GAMES, HARDEST_COUNT, HARDEST_MIN_ATTEMPTS, QUICK_LOOKS_ID, QUICK_LOOKS_NAME } from './config';
import { classRows } from './flags';
import { gameKeys, IDEAS, keyWords } from './ideas';

const ENABLED: Record<FoundationalGameId, (classId: string) => Promise<boolean>> = {
  beanstalk: fetchBeanstalkEnabled,
  hop: fetchHopEnabled,
  korora: fetchKororaEnabled,
  pipi: fetchPipiEnabled,
  tui: fetchTuiEnabled,
  weka: fetchWekaEnabled,
  pigeon: fetchPigeonEnabled,
  parrot: fetchParrotEnabled,
  lizard: fetchLizardEnabled,
  swamphen: fetchSwamphenEnabled,
  robin: fetchRobinEnabled,
};

/** The games switched on for a class, in GAME_IDS order. A game whose check fails counts as off. */
export async function enabledGames(classId: string): Promise<FoundationalGameId[]> {
  const on = await Promise.all(GAME_IDS.map((id) => ENABLED[id](classId).catch(() => false)));
  return GAME_IDS.filter((_, i) => on[i]);
}

/** Where "See" goes, after /teacher/:classId/ (the grid's tab is added in Stage 2). */
export const GRID_SECTION = 'maths/foundational';

/** Warnings first: the kind with the most pupils makes the line, and a tie goes to the earlier kind here. */
const ORDER: FlagKind[] = ['same-level', 'guessing', 'low-accuracy', 'recent-accuracy'];

const pupils = (n: number) => `${n} pupil${n === 1 ? '' : 's'}`;

function who(names: string[]): string {
  const shown = names.slice(0, ALERT_NAMES).join(', ');
  return names.length > ALERT_NAMES ? `${shown} and ${names.length - ALERT_NAMES} more` : shown;
}

function phrase(kind: FlagKind, n: number, levelWord: string): string {
  switch (kind) {
    case 'same-level':
      return `${pupils(n)} on the same ${levelWord} for ${FLAG_RULES.sameLevelDays} or more days`;
    case 'guessing':
      return `${pupils(n)} look${n === 1 ? 's' : ''} like guessing`;
    case 'low-accuracy':
      return `${pupils(n)} under ${Math.round(FLAG_RULES.lowAccuracyShare * 100)}% right on a skill they are learning`;
    default:
      return `${pupils(n)} under ${Math.round(FLAG_RULES.recentShare * 100)}% right on their last ${FLAG_RULES.recentAnswers} pictures`;
  }
}

/** One line for a game (or Quick looks) from the flags that name it, or none. */
function lineFor(track: string, name: string, levelWord: string, flagged: { name: string; flags: Flag[] }[]): TeacherAlert[] {
  const byKind = new Map<FlagKind, string[]>();
  for (const p of flagged) {
    for (const kind of new Set(p.flags.filter((f) => f.track === track && !f.quiet).map((f) => f.kind))) byKind.set(kind, [...(byKind.get(kind) ?? []), p.name]);
  }
  const best = ORDER.map((kind) => ({ kind, names: byKind.get(kind) ?? [] })).reduce((a, b) => (b.names.length > a.names.length ? b : a));
  if (best.names.length === 0) return [];
  // The "same step" line opens the Progress tab on the stuck pupils in that game; the other lines still open the grid.
  const section = best.kind === 'same-level' ? `progress?show=stuck&game=${track}` : GRID_SECTION;
  return [{ id: `foundational-${track}`, text: `${name}: ${phrase(best.kind, best.names.length, levelWord)} (${who(best.names)})`, section }];
}

/** Today's alert for one game, for its definition's `teacher.alerts`. Nothing while the game is switched off for the class. */
export async function foundationalAlerts(game: FoundationalGameId, classId: string): Promise<TeacherAlert[]> {
  const [on, data] = await Promise.all([ENABLED[game](classId), foundationalClass(classId)]);
  if (!on) return [];
  return lineFor(game, GAMES[game].name, GAMES[game].levelWord, classRows(data));
}

/** Today's Quick looks alert. Quick looks has no game definition, so Stage 2 adds this to `useClassAlerts`. */
export async function quickLooksAlerts(classId: string): Promise<TeacherAlert[]> {
  return lineFor(QUICK_LOOKS_ID, QUICK_LOOKS_NAME, 'stage', classRows(await foundationalClass(classId)));
}

/** The class's 3 weakest facts in one game, for its definition's `teacher.hardest`. Needs only the skill map's call. */
export async function foundationalHardest(game: FoundationalGameId, classId: string): Promise<HardestRow[]> {
  const map = await classFacts(classId);
  const topic = new Map(IDEAS.flatMap((i) => i.parts.flatMap((p) => p.keys.map((k) => [k, i.label] as const))));
  return weakestFacts(
    map.students.map((s) => s.facts),
    gameKeys(game),
    { minAttempts: HARDEST_MIN_ATTEMPTS, count: HARDEST_COUNT },
  ).map((f) => ({ question: keyWords(f.key), topic: topic.get(f.key) ?? null, attempts: f.attempts, correct: f.correct, students: f.students }));
}
