/**
 * Puts the class's three answers together into one row for each pupil: a cell for every idea and their stuck flags (R7 plan,
 * 3.1 and 3.2). The rules are in shared/kit/teacherGrid.ts and know no game words; this file says which words and numbers to
 * give them (./config.ts) and where each pupil's numbers are.
 */
import { stuckFlags, type Flag, type Recent, type Track } from '../../../shared/kit/teacherGrid';
import { nzDay } from '../../../shared/maths/leitner';
import { GAME_IDS, type FoundationalClass, type FoundationalPupil } from '../../data/foundational';
import type { MapStudent } from '../../data/skillMap';
import { FLAG_RULES, GAMES, QUICK_LOOKS_ID, QUICK_LOOKS_NAME } from './config';
import { IDEAS, ideaCell, type IdeaCell } from './ideas';

export interface PupilRow {
  id: string;
  name: string;
  /** The part of the school email before the @, where the skill map already shows it. */
  realName: string | null;
  cells: IdeaCell[];
  flags: Flag[];
}

/** One pupil's games (and Quick looks) in the shape the flag rules take. */
export function tracksOf(pupil: FoundationalPupil | undefined): Track[] {
  const tracks: Track[] = [];
  for (const id of GAME_IDS) {
    const g = pupil?.games[id];
    if (!g) continue;
    const words = GAMES[id];
    tracks.push({
      id,
      label: words.name,
      level: g.level,
      levelLabel: g.level === null ? null : (words.levels[g.level] ?? null),
      top: g.level !== null && g.level === words.top,
      daysDone: g.daysDone,
      lastDay: g.lastDay,
      challenges: g.recent.map((c) => ({ day: c.day, wrong: c.wrong, level: c.level })),
    });
  }
  const q = pupil?.quickLooks;
  if (q) tracks.push({ id: QUICK_LOOKS_ID, label: QUICK_LOOKS_NAME, level: null, levelLabel: null, top: false, daysDone: q.sessions, lastDay: q.lastDay, challenges: [] });
  return tracks;
}

/** One pupil's row. `today` is the NZ day, YYYY-MM-DD. */
export function pupilRow(student: MapStudent, data: FoundationalPupil | undefined, today: string): PupilRow {
  const cells = IDEAS.map((idea) => ideaCell(idea, student.facts, data?.quickLooks ?? null));
  const recents: Recent[] = data?.quickLooks
    ? [{ id: QUICK_LOOKS_ID, label: QUICK_LOOKS_NAME, unit: 'pictures', answered: data.quickLooks.answered, correct: data.quickLooks.correct }]
    : [];
  const flags = stuckFlags(
    {
      tracks: tracksOf(data),
      ideas: cells.filter((c) => c.idea.game !== QUICK_LOOKS_ID).map((c) => ({ id: c.idea.id, label: c.idea.label, track: c.idea.game, score: c.score })),
      recents,
      today,
    },
    FLAG_RULES,
  );
  return { id: student.id, name: student.name, realName: student.realName, cells, flags };
}

/** Every pupil of the class, in the order the skill map has them (by name). */
export function classRows(data: FoundationalClass, today: string = nzDay(Date.now())): PupilRow[] {
  return data.map.students.map((s) => pupilRow(s, data.pupils.get(s.id), today));
}
