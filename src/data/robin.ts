/**
 * Robin’s Berry Basket’s talking to the server (docs/ROBIN-PLAN.md). The `robin` server function keeps the pupil's rope, makes
 * each challenge from their maths records and replays it. The preview uses the browser-only trial instead (trialBackend
 * in src/games/robin/backend.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type RobinBackend } from '../games/robin/backend';
import type { HelpSetting } from '../../shared/kit/help';
import type { HelpLevel, Step } from '../../shared/robin/config';
import type { Slip } from '../../shared/robin/round';
import { HELP_SETTINGS } from '../../shared/robin/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveRobin: RobinBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/robin`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The berry basket couldn’t be reached. Check the internet and try again.' } };
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

export interface RobinSettings {
  enabled: boolean;
  /** The pictures' help: fading as each child's challenges go well (to start), always some, or off. */
  help: HelpSetting;
}

export async function fetchRobinSettings(classId?: string | null): Promise<RobinSettings> {
  const row = await readSettings(['robin_enabled', 'robin_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Robin’s Berry Basket settings.');
  const help = HELP_SETTINGS.includes(row.robin_help as HelpSetting) ? (row.robin_help as HelpSetting) : 'fade';
  return { enabled: row.robin_enabled === true, help };
}

export const fetchRobinEnabled = async (classId?: string | null) => (await fetchRobinSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_robin leaves out the other). */
export async function saveRobinSetting(change: Partial<RobinSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_robin', {
    enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchRobinClass(classId: string): Promise<{ players: number; feasts: number }> {
  const { data, error } = await supabase.rpc('teacher_robin_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Robin’s Berry Basket for this class.');
  return data as { players: number; feasts: number };
}

export interface RobinStudent {
  daysDone: number;
  lastDay: string | null;
  step: Step;
  /** The picture help level, 5 (most help) to 0 (none). */
  level: HelpLevel;
  lastPlayed: string;
  /** The commonest slip in their last ten challenges (over, under, skip, double and so on); null if none stands out (fewer than three, or a tie). */
  slip: Slip | null;
  /** Up to three keys they find hardest: "give:n7", "howmany:n8:ring", "counton:5+1". */
  hardest: string[];
}

/** One student's baskets, or null if they haven't played. */
export async function fetchRobinStudent(student: string): Promise<RobinStudent | null> {
  const { data, error } = await supabase.rpc('teacher_robin_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Robin’s Berry Basket for this student.');
  return (data ?? null) as RobinStudent | null;
}
