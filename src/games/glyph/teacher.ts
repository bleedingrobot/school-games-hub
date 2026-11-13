import { GOES_PER_WALL, PASS_FIRST_GO, WALLS_PER_TEMPLE } from '../../../shared/glyph/config';
import { TEMPLES, TOP_TEMPLE } from '../../../shared/glyph/config';
import { fetchGlyphClass, fetchGlyphEnabled, fetchGlyphStudent, saveGlyphEnabled } from '../../data/glyph';
import { useOtherGameCells } from '../../data/otherGames';
import { useSetting } from '../../teacher/useSetting';
import type { HardestRow, TeacherAlert } from '../types';

/** Glyph Gates on the teacher's Games table: the on/off switch for the class. The server checks it on every request. */
export function useGlyphClassSwitch(classId: string) {
  return useSetting(() => fetchGlyphEnabled(classId), [classId]);
}

export const saveGlyphClassSwitch = (on: boolean, classId: string) => saveGlyphEnabled(on, classId);

export const GLYPH_ABOUT = `Equivalent fractions (Years 4 to 6): students tap the fraction tiles equal to a gold stone, press Light the runes and pick the glyph their tiles make. ${WALLS_PER_TEMPLE} walls make a temple and there are ${TEMPLES.length} temples; opening ${PASS_FIRST_GO} walls at the first go passes a temple. ${GOES_PER_WALL} goes a wall, with a fraction bar, lens and arrows as help. The server makes and checks every wall. Nobody is ranked. Off hides it from students.`;

/** The Progress tab's Glyph Gates column: temples passed, of 6. */
export const useGlyphCells = (classId: string) => useOtherGameCells(classId, 'glyph', TOP_TEMPLE);

/** Each named mistake in a teacher's words (the pupil's wrong tile, and what they did to get it). */
const MISTAKE_WORDS: Record<string, string> = {
  'add-same': 'adds the same to top and bottom (5/6 → 6/7)',
  'top-only': 'multiplies only the top (1/6 → 2/6)',
  'bottom-only': 'multiplies only the bottom (5/6 → 5/12)',
  'same-bottom': 'keeps the bottom and changes the top (5/6 → 4/6)',
  'same-top': 'keeps the top and changes the bottom (5/6 → 5/7)',
  'near-miss': 'picks a near miss (30/37 for 5/6)',
  'diff-mult': 'multiplies top and bottom by different numbers (10/18 for 5/6)',
  missed: 'misses a tile that is equal',
};

export const mistakeWords = (mistake: string): string => MISTAKE_WORDS[mistake] ?? mistake;

/**
 * Today's "Hardest right now". The walls come from seeds and are not stored, so this is the class's most common mistakes over
 * the last 14 days, not gold stones. Counts are of wrong tiles shown on first goes.
 */
export async function glyphHardest(classId: string): Promise<HardestRow[]> {
  const { hardest } = await fetchGlyphClass(classId);
  return hardest.map((h) => ({ question: `Often ${mistakeWords(h.mistake)}`, topic: 'Equivalent fractions', attempts: h.count, correct: 0, students: h.students ?? 0 }));
}

/** Today's "Needs you": pupils who have tried one temple on 3 or more days without passing it. Counts, no names. */
export async function glyphAlerts(classId: string): Promise<TeacherAlert[]> {
  const { players } = await fetchGlyphClass(classId);
  const byTemple = new Map<number, { pupils: number; days: number }>();
  for (const p of players) {
    if (p.stuckTemple == null || p.stuckDays == null) continue;
    const t = byTemple.get(p.stuckTemple) ?? { pupils: 0, days: 0 };
    byTemple.set(p.stuckTemple, { pupils: t.pupils + 1, days: Math.max(t.days, p.stuckDays) });
  }
  return [...byTemple.entries()]
    .sort(([a], [b]) => a - b)
    .map(([temple, t]) => ({
      id: `stuck-${temple}`,
      text: `${t.pupils === 1 ? '1 pupil is' : `${t.pupils} pupils are`} stuck on ${TEMPLES[temple - 1]?.name ?? `temple ${temple}`} for ${t.days} days`,
      section: 'games/glyph',
    }));
}

/** The student page's folded Games line. */
export async function glyphStudentSummary(student: string): Promise<string | null> {
  const s = await fetchGlyphStudent(student);
  if (!s) return null;
  const top = s.mistakes[0];
  return `${s.passed} of ${TOP_TEMPLE} temples passed, ${s.walls} walls opened${top ? `. Often ${mistakeWords(top.mistake)}` : ''}`;
}
