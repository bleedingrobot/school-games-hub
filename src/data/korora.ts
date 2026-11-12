/**
 * Penguin Pairs' talking to the server (docs/KORORA-PLAN.md). The `korora` server function keeps the pupil's pool, makes
 * each challenge from their maths records and replays it. The preview uses the browser-only trial instead (trialBackend
 * in src/games/korora/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type KororaBackend } from '../games/korora/backend';
import { HELP_SETTINGS, type HelpSetting } from '../../shared/korora/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import type { WrongKind } from '../../shared/korora/round';

/** The real school server. */
export const liveKorora: KororaBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/korora`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The pool couldn’t be reached. Check the internet and try again.' } };
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

export interface KororaSettings {
  enabled: boolean;
  /** The pictures' help: fading with the pebbles (to start), always full, or off. */
  help: HelpSetting;
}

export async function fetchKororaSettings(classId?: string | null): Promise<KororaSettings> {
  const row = await readSettings(['korora_enabled', 'korora_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Penguin Pairs settings.');
  const help = HELP_SETTINGS.includes(row.korora_help as HelpSetting) ? (row.korora_help as HelpSetting) : 'fade';
  return { enabled: row.korora_enabled === true, help };
}

export const fetchKororaEnabled = async (classId?: string | null) => (await fetchKororaSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_korora leaves out the other). */
export async function saveKororaSetting(change: Partial<KororaSettings>, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_korora', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchKororaClass(classId: string): Promise<{ players: number; fish: number }> {
  const { data, error } = await supabase.rpc('teacher_korora_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Penguin Pairs for this class.');
  return data as { players: number; fish: number };
}

export interface KororaStudent {
  daysDone: number;
  lastPebbleDay: string | null;
  /** The furthest level reached, 1 to 4. */
  reached: 1 | 2 | 3 | 4;
  lastPlayed: string;
  /** Up to three facts they find hardest: "dbl:7", "half:14", "oddeven:9". */
  hardest: string[];
  /** The commonest kind of first wrong choice in their last ten finished challenges (at least three, no tie); null when none stands out, or for rounds saved before this was kept. */
  slip?: WrongKind | null;
}

/** One student's pool, or null if they haven't played. */
export async function fetchKororaStudent(student: string): Promise<KororaStudent | null> {
  const { data, error } = await supabase.rpc('teacher_korora_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Penguin Pairs for this student.');
  return (data ?? null) as KororaStudent | null;
}
