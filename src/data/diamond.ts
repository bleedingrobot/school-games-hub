/**
 * Diamond Drop's talking to the server (docs/DIAMOND-PLAN.md, section 5). The `diamond` server function keeps the
 * pupil's progress and replays every level; the Hall and the teacher's lines are read straight from the database.
 * The preview uses the browser-only trial instead (src/games/diamond/trialBackend.ts).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type DiamondBackend, type HallRow } from '../games/diamond/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveDiamond: DiamondBackend = fromServer(
  async (body) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/diamond`, {
        method: 'POST',
        signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('The mine couldn’t be reached. Check the internet and try again.');
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = (await response.json()) as Record<string, unknown>;
    } catch {
      // An empty or broken reply: the status still says what happened.
    }
    return { status: response.status, body: parsed };
  },
  async () => {
    const { data, error } = await supabase.rpc('diamond_hall');
    if (error) return { ok: false, message: 'The Hall couldn’t be loaded just now.' };
    return { ok: true, value: (data ?? []) as HallRow[] };
  },
);

export async function fetchDiamondEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['diamond_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Diamond Drop setting.');
  return row.diamond_enabled === true;
}

export async function saveDiamondEnabled(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_diamond', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchDiamondClass(classId: string): Promise<{ players: number; pastFive: number; found: number }> {
  const { data, error } = await supabase.rpc('teacher_diamond_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Diamond Drop for this class.');
  return data as { players: number; pastFive: number; found: number };
}

/** One student's line, or null if they haven't played. */
export async function fetchDiamondStudent(student: string): Promise<{ deepest: number; kinds: number; found: number } | null> {
  const { data, error } = await supabase.rpc('teacher_diamond_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Diamond Drop for this student.');
  return (data ?? null) as { deepest: number; kinds: number; found: number } | null;
}

/** Starts one student again from level 1 (their upgrades, achievements and the Hall stay). */
export async function restartDiamondStudent(student: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_diamond_restart', { student });
  if (error) throw new FriendlyError('We couldn’t start them again.');
}
