/**
 * Pipi's Hidden Shells' talking to the server (docs/PIPI-PLAN.md, section 3). The `pipi` server function keeps the pupil's
 * beach, makes each challenge from their maths records and replays it. The preview uses the browser-only trial instead
 * (trialBackend in src/games/pipi/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type PipiBackend } from '../games/pipi/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import type { WrongKind } from '../../shared/pipi/round';

/** The real school server. */
export const livePipi: PipiBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/pipi`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The beach couldn’t be reached. Check the internet and try again.' } };
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

export interface PipiSettings {
  enabled: boolean;
  /** The help in the sand (the frame and the outlines of the hiding pipi), on unless the teacher turns it off. */
  help: boolean;
}

export async function fetchPipiSettings(classId?: string | null): Promise<PipiSettings> {
  const row = await readSettings(['pipi_enabled', 'pipi_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Pipi’s Hidden Shells settings.');
  return { enabled: row.pipi_enabled === true, help: row.pipi_help !== false };
}

export const fetchPipiEnabled = async (classId?: string | null) => (await fetchPipiSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_pipi leaves out the other). */
export async function savePipiSetting(change: Partial<PipiSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_pipi', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchPipiClass(classId: string): Promise<{ players: number; pearls: number }> {
  const { data, error } = await supabase.rpc('teacher_pipi_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Pipi’s Hidden Shells for this class.');
  return data as { players: number; pearls: number };
}

export interface PipiStudent {
  daysDone: number;
  lastShellDay: string | null;
  /** The furthest level reached: 1 (wholes 3 to 5), 2 (6 and 7) or 3 (8 to 10). */
  reached: 1 | 2 | 3;
  lastPlayed: string;
  /** The commonest kind of first wrong choice in their last ten finished challenges (at least three, no tie); null when none stands out, or for rounds saved before this was kept. */
  slip?: WrongKind | null;
}

/** One student's beach, or null if they haven't played. */
export async function fetchPipiStudent(student: string): Promise<PipiStudent | null> {
  const { data, error } = await supabase.rpc('teacher_pipi_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Pipi’s Hidden Shells for this student.');
  return (data ?? null) as PipiStudent | null;
}
