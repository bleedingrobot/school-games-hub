/**
 * Kererū’s Number Line’s talking to the server (docs/KERERU-PLAN.md). The `kereru` server function keeps the pupil's branch, makes
 * each challenge from their maths records and replays it. The preview uses the browser-only trial instead (trialBackend
 * in src/games/kereru/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type KereruBackend } from '../games/kereru/backend';
import type { Tap } from '../../shared/kereru/play';
import type { HelpLevel, HelpSetting, Round, Step } from '../../shared/kereru/round';
import { HELP_SETTINGS } from '../../shared/kereru/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveKereru: KereruBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/kereru`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The branch couldn’t be reached. Check the internet and try again.' } };
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

export interface KereruSettings {
  enabled: boolean;
  /** The pictures' help: fading as each child's challenges go well (to start), always every berry, or off. */
  help: HelpSetting;
}

export async function fetchKereruSettings(classId?: string | null): Promise<KereruSettings> {
  const row = await readSettings(['kereru_enabled', 'kereru_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Kererū’s Number Line settings.');
  const help = HELP_SETTINGS.includes(row.kereru_help as HelpSetting) ? (row.kereru_help as HelpSetting) : 'fade';
  return { enabled: row.kereru_enabled === true, help };
}

export const fetchKereruEnabled = async (classId?: string | null) => (await fetchKereruSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_kereru leaves out the other). */
export async function saveKereruSetting(change: Partial<KereruSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_kereru', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchKereruClass(classId: string): Promise<{ players: number; prizes: number }> {
  const { data, error } = await supabase.rpc('teacher_kereru_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Kererū’s Number Line for this class.');
  return data as { players: number; prizes: number };
}

export interface KereruStudent {
  daysDone: number;
  lastDay: string | null;
  step: Step;
  /** The picture help level, 5 (every number marked) to 0 (numbers only). */
  level: HelpLevel;
  lastPlayed: string;
  /** Up to five keys they find hardest: "place100:n63", "tens100:+63". */
  hardest: string[];
  /** Their last three challenges, for the placing summary. */
  recent: { round: Round; taps: Tap[] }[];
}

/** One student's tree, or null if they haven't played. */
export async function fetchKereruStudent(student: string): Promise<KereruStudent | null> {
  const { data, error } = await supabase.rpc('teacher_kereru_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Kererū’s Number Line for this student.');
  return (data ?? null) as KereruStudent | null;
}
