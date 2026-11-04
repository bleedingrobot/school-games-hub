/**
 * Sky Isles' talking to the server (docs/ISLES-PLAN.md, section 8). The `isles` server function keeps the whole island:
 * the browser sends a turn's choices or an answer and gets the island back as it now is. The preview uses the
 * browser-only trial instead (src/games/isles/trialBackend.ts).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { IslesError, readReply, type IslesBackend } from '../games/isles/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import type { HallSeason } from '../../shared/isles/server';

/** The real school server. */
export const liveIsles: IslesBackend = {
  trial: false,
  async send(body) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new IslesError('Please sign in again.', 'signed-out', 401);
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/isles`, {
        method: 'POST',
        signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new IslesError("The sky post couldn't get through. Check the internet and try again.", 'offline');
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = (await response.json()) as Record<string, unknown>;
    } catch {
      // An empty or broken reply: the status still says what happened.
    }
    return readReply(response.status, parsed);
  },
};

export async function fetchIslesEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['isles_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Sky Isles setting.');
  return row.isles_enabled === true;
}

// ---------------------------------------------------------------- the teacher's parts (docs/ISLES-PLAN.md, section 10)

export interface IslesSettings {
  enabled: boolean;
  races: boolean;
}

export async function fetchIslesSettings(classId?: string | null): Promise<IslesSettings> {
  const row = await readSettings(['isles_enabled', 'isles_races'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Sky Isles settings.');
  return { enabled: row.isles_enabled === true, races: row.isles_races !== false };
}

/** Saves one switch: teacher_set_isles takes both, so the other is read first (from the remembered settings). */
export async function saveIslesSetting(change: Partial<IslesSettings>, classId?: string | null): Promise<void> {
  const now = await fetchIslesSettings(classId);
  const s = { ...now, ...change };
  const { error } = await supabase.rpc('teacher_set_isles', { enabled: s.enabled, races: s.races, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

export type { HallEntry, HallSeason } from '../../shared/isles/server';

/** One student's island this season, as the teacher sees it (never maths: that's in the focus reports). */
export interface IslesStudentRow {
  id: string;
  name: string;
  islandName: string | null;
  spots: number;
  lighthouse: number;
  turns: number;
  worth: number;
  lastPlayed: string | null;
}

export interface IslesClassReport {
  students: IslesStudentRow[];
  hall: HallSeason[];
}

export async function fetchIslesClass(classId: string): Promise<IslesClassReport> {
  const { data, error } = await supabase.rpc('teacher_isles_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load this class’s Sky Isles.');
  return data as IslesClassReport;
}

export type IslesStudent = Omit<IslesStudentRow, 'id' | 'name'> & { islanders: number; decorations: number; racesWon: number };

/** One student's island, or null if they haven't played since the last New Season. */
export async function fetchIslesStudent(student: string): Promise<IslesStudent | null> {
  const { data, error } = await supabase.rpc('teacher_isles_student', { student });
  if (error) throw new FriendlyError('We couldn’t load this student’s Sky Isles.');
  return (data as IslesStudent | null) ?? null;
}

/** Starts one student's island again (achievements, points, name, Sky Keeper and the Hall stay). */
export async function resetIslesIsland(student: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_reset_isles', { student });
  if (error) throw new FriendlyError('We couldn’t start that island again.');
}

/** The Hall of the Skies of every class the teacher teaches that has one. */
export async function fetchIslesHalls(): Promise<{ classId: string; className: string; seasons: HallSeason[] }[]> {
  const { data, error } = await supabase.rpc('teacher_isles_halls');
  if (error) throw new FriendlyError('We couldn’t load the Hall of the Skies.');
  return (data as { classId: string; className: string; seasons: HallSeason[] }[] | null) ?? [];
}
