/**
 * Kiwi's Beanstalk's talking to the server (docs/BEANSTALK-PLAN.md, section 5). The `beanstalk` server function keeps the
 * pupil's beanstalk and replays every challenge. The preview uses the browser-only trial instead (trialBackend in
 * src/games/beanstalk/backend.ts).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { DAYS_PER_EGG, stageForEggs, type HelpLevel } from '../../shared/beanstalk/progress';
import type { Stage } from '../../shared/beanstalk/round';
import { fromServer, type BeanstalkBackend } from '../games/beanstalk/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveBeanstalk: BeanstalkBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/beanstalk`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The beanstalk couldn’t be reached. Check the internet and try again.' } };
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    // An empty or broken reply: the status still says what happened.
  }
  return { status: response.status, body: parsed };
});

// ---------------------------------------------------------------- the teacher's parts (docs/BEANSTALK-PLAN.md, Stage 4)

export interface BeanstalkSettings {
  enabled: boolean;
  /** The leaves' ten-frame dots, on unless the teacher turns them off. */
  dots: boolean;
}

export async function fetchBeanstalkSettings(classId?: string | null): Promise<BeanstalkSettings> {
  const row = await readSettings(['beanstalk_enabled', 'beanstalk_dots'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Kiwi’s Beanstalk settings.');
  return { enabled: row.beanstalk_enabled === true, dots: row.beanstalk_dots !== false };
}

export const fetchBeanstalkEnabled = async (classId?: string | null) => (await fetchBeanstalkSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_beanstalk leaves out the other). */
export async function saveBeanstalkSetting(change: Partial<BeanstalkSettings>, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_beanstalk', {
    enabled: change.enabled ?? null, dots: change.dots ?? null, target_class: classId ?? null,
  });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

/** The teacher's Games table line for a class. */
export async function fetchBeanstalkClass(classId: string): Promise<{ players: number; eggs: number }> {
  const { data, error } = await supabase.rpc('teacher_beanstalk_class', { target_class: classId });
  if (error || !data) throw new FriendlyError('We couldn’t load Kiwi’s Beanstalk for this class.');
  return data as { players: number; eggs: number };
}

/** One student's finished days, dots help (0 full, 1 small, 2 none) and stage (the sum they are on), or null if they haven't played. */
export async function fetchBeanstalkStudent(student: string): Promise<{ daysDone: number; lastLeafDay: string | null; help: HelpLevel; stage: Stage } | null> {
  const { data, error } = await supabase.rpc('teacher_beanstalk_student', { student });
  if (error) throw new FriendlyError('We couldn’t load Kiwi’s Beanstalk for this student.');
  const row = (data ?? null) as { daysDone: number; lastLeafDay: string | null; help: HelpLevel; stage?: Stage } | null;
  // Before the stage was saved it was the calendar's.
  return row && { ...row, stage: row.stage ?? stageForEggs(Math.floor(row.daysDone / DAYS_PER_EGG)) };
}
