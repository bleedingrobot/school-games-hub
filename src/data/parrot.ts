/**
 * Parrot’s See-saw’s talking to the server (docs/PARROT-PLAN.md). The `parrot` server function keeps the pupil's rope, makes
 * each challenge from their maths records and replays it. The preview uses the browser-only trial instead (trialBackend
 * in src/games/parrot/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type ParrotBackend } from '../games/parrot/backend';
import type { HelpSetting } from '../../shared/kit/help';
import type { HelpLevel, Step } from '../../shared/parrot/config';
import type { ParrotKind } from '../../shared/parrot/round';
import { HELP_SETTINGS } from '../../shared/parrot/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveParrot: ParrotBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/parrot`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The see-saw couldn’t be reached. Check the internet and try again.' } };
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

export interface ParrotSettings {
  enabled: boolean;
  /** The pictures' help: fading as each child's challenges go well (to start), always stones, or off. */
  help: HelpSetting;
}

export async function fetchParrotSettings(classId?: string | null): Promise<ParrotSettings> {
  const row = await readSettings(['parrot_enabled', 'parrot_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Parrot’s See-saw settings.');
  const help = HELP_SETTINGS.includes(row.parrot_help as HelpSetting) ? (row.parrot_help as HelpSetting) : 'fade';
  return { enabled: row.parrot_enabled === true, help };
}

export const fetchParrotEnabled = async (classId?: string | null) => (await fetchParrotSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_parrot leaves out the other). */
export async function saveParrotSetting(change: Partial<ParrotSettings>, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_parrot', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchParrotClass(classId: string): Promise<{ players: number; bells: number }> {
  const { data, error } = await supabase.rpc('teacher_parrot_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Parrot’s See-saw for this class.');
  return data as { players: number; bells: number };
}

export interface ParrotStudent {
  daysDone: number;
  lastDay: string | null;
  step: Step;
  /** The picture help level, 5 (stones with live tilt) to 0 (equation only). */
  level: HelpLevel;
  lastPlayed: string;
  /** Up to three facts they find hardest: "eqmiss:8=5+?" (empty until the shared maths keys are live). */
  /** The commonest first slip in their last ten challenges: any kind of wrong pick; null if none stands out (fewer than three, or a tie). */
  slip: ParrotKind | null;
  hardest: string[];
}

/** One student's rope, or null if they haven't played. */
export async function fetchParrotStudent(student: string): Promise<ParrotStudent | null> {
  const { data, error } = await supabase.rpc('teacher_parrot_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Parrot’s See-saw for this student.');
  return (data ?? null) as ParrotStudent | null;
}
