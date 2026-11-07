/**
 * Lizard’s Bundles talking to the server (docs/LIZARD-PLAN.md). The `lizard` server function keeps the pupil's den, makes
 * each challenge from their maths records and replays it. The preview uses the browser-only trial instead (trialBackend
 * in src/games/lizard/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type LizardBackend } from '../games/lizard/backend';
import type { Tap } from '../../shared/lizard/play';
import type { HelpLevel, HelpSetting, Round, Step } from '../../shared/lizard/round';
import { HELP_SETTINGS } from '../../shared/lizard/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveLizard: LizardBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/lizard`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The den couldn’t be reached. Check the internet and try again.' } };
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

export interface LizardSettings {
  enabled: boolean;
  /** The pictures' help: fading as each child's challenges go well (to start), always the labelled mat, or off. */
  help: HelpSetting;
}

export async function fetchLizardSettings(classId?: string | null): Promise<LizardSettings> {
  const row = await readSettings(['lizard_enabled', 'lizard_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Lizard’s Bundles settings.');
  const help = HELP_SETTINGS.includes(row.lizard_help as HelpSetting) ? (row.lizard_help as HelpSetting) : 'fade';
  return { enabled: row.lizard_enabled === true, help };
}

export const fetchLizardEnabled = async (classId?: string | null) => (await fetchLizardSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_lizard leaves out the other). */
export async function saveLizardSetting(change: Partial<LizardSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_lizard', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchLizardClass(classId: string): Promise<{ players: number; prizes: number }> {
  const { data, error } = await supabase.rpc('teacher_lizard_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Lizard’s Bundles for this class.');
  return data as { players: number; prizes: number };
}

export interface LizardStudent {
  daysDone: number;
  lastDay: string | null;
  step: Step;
  /** The picture help level, 5 (a labelled mat) to 0 (numbers only). */
  level: HelpLevel;
  lastPlayed: string;
  /** Up to five keys they find hardest: "pvbuild:n47", "pvten:+47". */
  hardest: string[];
  /** Their last three challenges, for the slips summary. */
  recent: { round: Round; taps: Tap[] }[];
}

/** One student's den, or null if they haven't played. */
export async function fetchLizardStudent(student: string): Promise<LizardStudent | null> {
  const { data, error } = await supabase.rpc('teacher_lizard_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Lizard’s Bundles for this student.');
  return (data ?? null) as LizardStudent | null;
}
