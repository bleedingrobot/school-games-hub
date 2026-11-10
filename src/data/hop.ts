/**
 * Hop's Glow-worm Pond's talking to the server (docs/HOP-PLAN.md, section 4). The `hop` server function keeps the pupil's
 * pond, makes each challenge from their maths records and replays it. The preview uses the browser-only trial instead
 * (trialBackend in src/games/hop/backend.ts). The teacher's parts are at the foot (Stage 4).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type HopBackend } from '../games/hop/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import type { HopMistake } from '../../shared/hop/round';

/** The real school server. */
export const liveHop: HopBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/hop`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The pond couldn’t be reached. Check the internet and try again.' } };
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    // An empty or broken reply: the status still says what happened.
  }
  return { status: response.status, body: parsed };
});

// ---------------------------------------------------------------- the teacher's parts (docs/HOP-PLAN.md, Stage 4)

export interface HopSettings {
  enabled: boolean;
  /** The step ("+2") on the hops' arcs, on unless the teacher turns it off. */
  labels: boolean;
}

export async function fetchHopSettings(classId?: string | null): Promise<HopSettings> {
  const row = await readSettings(['hop_enabled', 'hop_labels'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Hop’s Glow-worm Pond settings.');
  return { enabled: row.hop_enabled === true, labels: row.hop_labels !== false };
}

export const fetchHopEnabled = async (classId?: string | null) => (await fetchHopSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_hop leaves out the other). */
export async function saveHopSetting(change: Partial<HopSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_hop', {
    enabled: change.enabled ?? null, labels: change.labels ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchHopClass(classId: string): Promise<{ players: number; jars: number }> {
  const { data, error } = await supabase.rpc('teacher_hop_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Hop’s Glow-worm Pond for this class.');
  return data as { players: number; jars: number };
}

export interface HopStudent {
  daysDone: number;
  lastPadDay: string | null;
  /** The furthest step reached: counting in 10s, 5s, 2s, 3s, 4s, or 200 for tens past 100. */
  reached: 10 | 5 | 2 | 3 | 4 | 200;
  lastPlayed: string;
  /** The commonest kind of first wrong choice in their last ten finished challenges (at least three, no tie); null when none stands out, or for rounds saved before this was kept. */
  slip?: HopMistake | null;
}

/** One student's pond, or null if they haven't played. */
export async function fetchHopStudent(student: string): Promise<HopStudent | null> {
  const { data, error } = await supabase.rpc('teacher_hop_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Hop’s Glow-worm Pond for this student.');
  return (data ?? null) as HopStudent | null;
}
