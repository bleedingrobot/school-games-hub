/**
 * Toon Flap's talking to the server (docs/TOON-FLAP-PLAN.md). The `toonflap` server function makes each run's checks,
 * marks them once and replays the flaps to check the time. The preview uses the browser-only trial instead (trialBackend
 * in src/games/toonflap/backend.ts). The teacher's switch is at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type ToonFlapBackend } from '../games/toonflap/backend';
import type { Progress } from '../../shared/toonflap/collection';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveToonFlap: ToonFlapBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/toonflap`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'Toon Flap couldn’t be reached. Check the internet and try again.' } };
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    // An empty or broken reply: the status still says what happened.
  }
  return { status: response.status, body: parsed };
});

// ---------------------------------------------------------------- the teacher's parts

export type ToonFlapMaths = 'off' | 'choose' | 'on';

export interface ToonFlapSettings {
  enabled: boolean;
  maths: ToonFlapMaths;
  /** Extra time at the gaps on levels 3 to 5. */
  readTime: boolean;
}

export async function fetchToonFlapSettings(classId?: string | null): Promise<ToonFlapSettings> {
  const row = await readSettings(['toonflap_enabled', 'toonflap_maths', 'toonflap_read_time'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Toon Flap settings.');
  const maths = (['off', 'choose', 'on'] as const).find((m) => m === row.toonflap_maths) ?? 'on';
  return { enabled: row.toonflap_enabled === true, maths, readTime: row.toonflap_read_time !== false };
}

export const fetchToonFlapEnabled = async (classId?: string | null) => (await fetchToonFlapSettings(classId)).enabled;

export interface ToonFlapClass {
  players: number;
  /** Levels finished, added up over the class. */
  levels: number;
  golds: number;
}

/** The teacher's Games table line for a class. */
export async function fetchToonFlapClass(classId: string): Promise<ToonFlapClass> {
  const { data, error } = await supabase.rpc('teacher_toonflap_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Toon Flap for this class.');
  return data as ToonFlapClass;
}

export interface ToonFlapStudent {
  progress: Progress;
  flyer: string | null;
  lastPlayed: string;
  /** Finished runs in all. */
  runs: number;
}

/** One student's flights, or null if they haven't played. */
export async function fetchToonFlapStudent(student: string): Promise<ToonFlapStudent | null> {
  const { data, error } = await supabase.rpc('teacher_toonflap_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Toon Flap for this student.');
  return (data ?? null) as ToonFlapStudent | null;
}

/** Saves any of the settings (teacher_set_toonflap leaves out the rest). */
export async function saveToonFlapSetting(change: Partial<ToonFlapSettings>, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_toonflap', {
    enabled: change.enabled ?? null, maths: change.maths ?? null, read_time: change.readTime ?? null, target_class: classId,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
