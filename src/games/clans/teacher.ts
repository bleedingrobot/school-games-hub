import { readSettings } from '../../data/classSettings';
import { fetchClansEnabled } from '../../data/clans';
import { useSetting } from '../../teacher/useSetting';

/**
 * Clan Quest on the teacher's Games table (docs/TEACHER-VIEW-PLAN.md, 4.5), for the header's class: the on/off switch in the
 * On column, and its maths settings summed up in the Maths column ("Year 4 · 5 topics · 10/day"). Made-up hero names, the
 * maths settings, raids, the class report and the villages (whole school) are in its Settings (src/pages/TeacherClans.tsx).
 *
 * This file reads the three settings it needs straight from the class's settings row, so the dashboard doesn't download the
 * story-question code just to draw the table.
 */
export function useClansClassSwitch(classId: string) {
  return useSetting(() => fetchClansEnabled(classId), [classId]);
}

interface Brief {
  yearBand: number;
  topics: number;
  fightsPerDay: number;
}

async function fetchBrief(classId: string): Promise<Brief> {
  const row = await readSettings(['clans_year_band', 'clans_topics', 'clans_fights_per_day'], classId);
  if (!row || !Array.isArray(row.clans_topics)) throw new Error('no settings');
  return {
    yearBand: row.clans_year_band as number,
    topics: (row.clans_topics as unknown[]).length,
    fightsPerDay: row.clans_fights_per_day as number,
  };
}

export function clansSummary(brief: Brief): string {
  return [`Year ${brief.yearBand}`, `${brief.topics} ${brief.topics === 1 ? 'topic' : 'topics'}`, `${brief.fightsPerDay}/day`].join(' · ');
}

/** The Maths column. Null while loading. */
export function useClansSummary(classId: string): string | null {
  const brief = useSetting(() => fetchBrief(classId), [classId]);
  if (brief.failed) return 'Couldn’t load';
  return brief.value && clansSummary(brief.value);
}

/** Behind the switch's "?". */
export const CLANS_ABOUT =
  'Pupils make a clan of four, fight in the Mines (maths helps), shop, train and build an empire, each with their own clan kept on the school’s server. Everyone’s mine fights come back at midnight. Off hides the card from this class and nothing can be played; clans are kept, and you can still open it yourself to try it.';
