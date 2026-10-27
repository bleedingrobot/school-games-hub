import { readSettings } from '../../data/classSettings';
import { useSetting } from '../../teacher/useSetting';

/**
 * Gem Keep on the teacher's Games table (docs/TEACHER-VIEW-PLAN.md, 4.5), for the header's class. It is always on, so it has no
 * switch; the Maths column sums up its settings ("Calm · ×2–×10 · typing"). The settings themselves and the class report are in
 * its Settings (src/pages/TeacherGemKeep.tsx), which load only when opened, because they bring the levels and maths code.
 *
 * This file reads the three settings it needs straight from the class's settings row, so the dashboard doesn't download
 * Gem Keep's saving code just to draw the table.
 */
interface Brief {
  mode: 'calm' | 'challenge';
  tables: number[];
  multipleChoice: boolean;
}

async function fetchBrief(classId: string): Promise<Brief> {
  const row = await readSettings(['gem_keep_mode', 'gem_keep_tables', 'gem_keep_multiple_choice'], classId);
  if (!row) throw new Error('no settings');
  return {
    mode: row.gem_keep_mode as Brief['mode'],
    tables: row.gem_keep_tables as number[],
    multipleChoice: row.gem_keep_multiple_choice as boolean,
  };
}

/** "×2–×10" for a run of tables, "×7" for one, else "5 tables". */
export function tablesText(tables: readonly number[]): string {
  const sorted = [...tables].sort((a, b) => a - b);
  if (sorted.length === 0) return 'no tables';
  if (sorted.length === 1) return `×${sorted[0]}`;
  const run = sorted.every((t, i) => i === 0 || t === sorted[i - 1] + 1);
  return run ? `×${sorted[0]}–×${sorted[sorted.length - 1]}` : `${sorted.length} tables`;
}

export function gemKeepSummary(brief: Brief): string {
  return [brief.mode === 'calm' ? 'Calm' : 'Challenge', tablesText(brief.tables), brief.multipleChoice ? 'multiple choice' : 'typing'].join(' · ');
}

/** The Maths column. Null while loading. */
export function useGemKeepSummary(classId: string): string | null {
  const brief = useSetting(() => fetchBrief(classId), [classId]);
  if (brief.failed) return 'Couldn’t load';
  return brief.value && gemKeepSummary(brief.value);
}
