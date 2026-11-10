/**
 * Weka’s Stepping Stones’ talking to the server (docs/WEKA-PLAN.md). The `weka` server function keeps the pupil's stream, makes
 * each challenge from their maths records and replays it. The preview uses the browser-only trial instead (trialBackend
 * in src/games/weka/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type WekaBackend } from '../games/weka/backend';
import { HELP_SETTINGS, type HelpSetting } from '../../shared/weka/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import type { LandKind } from '../../shared/weka/round';

/** The real school server. */
export const liveWeka: WekaBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/weka`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The stream couldn’t be reached. Check the internet and try again.' } };
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

export interface WekaSettings {
  enabled: boolean;
  /** The pictures' help: following each child's records (to start), always full, or off. */
  help: HelpSetting;
}

export async function fetchWekaSettings(classId?: string | null): Promise<WekaSettings> {
  const row = await readSettings(['weka_enabled', 'weka_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Weka’s Stepping Stones settings.');
  const help = HELP_SETTINGS.includes(row.weka_help as HelpSetting) ? (row.weka_help as HelpSetting) : 'fade';
  return { enabled: row.weka_enabled === true, help };
}

export const fetchWekaEnabled = async (classId?: string | null) => (await fetchWekaSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_weka leaves out the other). */
export async function saveWekaSetting(change: Partial<WekaSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_weka', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchWekaClass(classId: string): Promise<{ players: number; baskets: number }> {
  const { data, error } = await supabase.rpc('teacher_weka_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Weka’s Stepping Stones for this class.');
  return data as { players: number; baskets: number };
}

export interface WekaStudent {
  daysDone: number;
  lastStoneDay: string | null;
  /** The furthest level reached, 1 to 4. */
  reached: 1 | 2 | 3 | 4;
  lastPlayed: string;
  /** Up to three facts they find hardest: "add:5+8", "add:6+7". */
  hardest: string[];
  /** The commonest kind of first wrong choice in their last ten finished challenges (at least three, no tie); null when none stands out, or for rounds saved before this was kept. */
  slip?: LandKind | null;
}

/** One student's stream, or null if they haven't played. */
export async function fetchWekaStudent(student: string): Promise<WekaStudent | null> {
  const { data, error } = await supabase.rpc('teacher_weka_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Weka’s Stepping Stones for this student.');
  return (data ?? null) as WekaStudent | null;
}
