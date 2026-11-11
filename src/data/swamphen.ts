/**
 * Swamp Hen’s Reed Rows talking to the server (docs/SWAMPHEN-PLAN.md). The `swamphen` server function keeps the pupil's garden, makes
 * each challenge from their maths records and replays it. The preview uses the browser-only trial instead (trialBackend
 * in src/games/swamphen/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type SwamphenBackend } from '../games/swamphen/backend';
import type { Tap } from '../../shared/swamphen/play';
import type { HelpLevel, HelpSetting, Round, Step } from '../../shared/swamphen/round';
import { HELP_SETTINGS } from '../../shared/swamphen/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveSwamphen: SwamphenBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/swamphen`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The reeds couldn’t be reached. Check the internet and try again.' } };
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

export interface SwamphenSettings {
  enabled: boolean;
  /** The pictures' help: fading as each child's challenges go well (to start), always every row drawn, or off. */
  help: HelpSetting;
}

export async function fetchSwamphenSettings(classId?: string | null): Promise<SwamphenSettings> {
  const row = await readSettings(['swamphen_enabled', 'swamphen_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Swamp Hen’s Reed Rows settings.');
  const help = HELP_SETTINGS.includes(row.swamphen_help as HelpSetting) ? (row.swamphen_help as HelpSetting) : 'fade';
  return { enabled: row.swamphen_enabled === true, help };
}

export const fetchSwamphenEnabled = async (classId?: string | null) => (await fetchSwamphenSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_swamphen leaves out the other). */
export async function saveSwamphenSetting(change: Partial<SwamphenSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_swamphen', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchSwamphenClass(classId: string): Promise<{ players: number; prizes: number }> {
  const { data, error } = await supabase.rpc('teacher_swamphen_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Swamp Hen’s Reed Rows for this class.');
  return data as { players: number; prizes: number };
}

export interface SwamphenStudent {
  daysDone: number;
  lastDay: string | null;
  step: Step;
  /** The picture help level, 5 (every row drawn) to 0 (numbers only). */
  level: HelpLevel;
  lastPlayed: string;
  /** Up to five keys they find hardest: "rows:4x6", "share:24/4". */
  hardest: string[];
  /** Their last three challenges, for the slip summary. */
  recent: { round: Round; taps: Tap[] }[];
  /** The usual slip saved with their rounds (last 10), or null/missing: older rounds saved none, so the page works it out from `recent`. */
  slip?: string | null;
}

/** One student's garden, or null if they haven't played. */
export async function fetchSwamphenStudent(student: string): Promise<SwamphenStudent | null> {
  const { data, error } = await supabase.rpc('teacher_swamphen_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Swamp Hen’s Reed Rows for this student.');
  return (data ?? null) as SwamphenStudent | null;
}
