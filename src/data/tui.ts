/**
 * Tūī’s Ten Tree’s talking to the server (docs/TUI-PLAN.md). The `tui` server function keeps the pupil's tree, makes
 * each challenge from their maths records and replays it. The preview uses the browser-only trial instead (trialBackend
 * in src/games/tui/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type TuiBackend } from '../games/tui/backend';
import type { HelpLevel, HelpSetting, Step } from '../../shared/tui/round';
import { HELP_SETTINGS } from '../../shared/tui/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveTui: TuiBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/tui`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The tree couldn’t be reached. Check the internet and try again.' } };
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

export interface TuiSettings {
  enabled: boolean;
  /** The pictures' help: fading as each child's challenges go well (to start), always every berry, or off. */
  help: HelpSetting;
}

export async function fetchTuiSettings(classId?: string | null): Promise<TuiSettings> {
  const row = await readSettings(['tui_enabled', 'tui_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Tūī’s Ten Tree settings.');
  const help = HELP_SETTINGS.includes(row.tui_help as HelpSetting) ? (row.tui_help as HelpSetting) : 'fade';
  return { enabled: row.tui_enabled === true, help };
}

export const fetchTuiEnabled = async (classId?: string | null) => (await fetchTuiSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_tui leaves out the other). */
export async function saveTuiSetting(change: Partial<TuiSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_tui', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchTuiClass(classId: string): Promise<{ players: number; nests: number }> {
  const { data, error } = await supabase.rpc('teacher_tui_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Tūī’s Ten Tree for this class.');
  return data as { players: number; nests: number };
}

export interface TuiStudent {
  daysDone: number;
  lastFlowerDay: string | null;
  step: Step;
  /** The picture help level, 5 (every berry counted in) to 0 (numbers only). */
  level: HelpLevel;
  /** The highest help level among the ways of asking they have met (most help any way still gets); null before their first finish with a level for each way. */
  helpMax?: HelpLevel | null;
  lastPlayed: string;
  /** Up to three facts they find hardest: "tenand:4", "tenand:7". */
  hardest: string[];
}

/** One student's tree, or null if they haven't played. */
export async function fetchTuiStudent(student: string): Promise<TuiStudent | null> {
  const { data, error } = await supabase.rpc('teacher_tui_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Tūī’s Ten Tree for this student.');
  return (data ?? null) as TuiStudent | null;
}
