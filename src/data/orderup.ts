/**
 * Order Up!'s talking to the server (docs/ORDERUP-PLAN.md). The `orderup` server function keeps the pupil's place, makes each
 * set of bags and replays every bag. The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type OrderUpBackend } from '../games/orderup/backend';
import { HELP_SETTINGS, type HelpSetting } from '../../shared/orderup/server';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveOrderUp: OrderUpBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/orderup`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The diner couldn’t be reached. Check the internet and try again.' } };
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

export interface OrderUpSettings {
  enabled: boolean;
  help: HelpSetting;
}

export async function fetchOrderUpSettings(classId?: string | null): Promise<OrderUpSettings> {
  const row = await readSettings(['orderup_enabled', 'orderup_help'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Order Up! settings.');
  const help = HELP_SETTINGS.includes(row.orderup_help as HelpSetting) ? (row.orderup_help as HelpSetting) : 'fade';
  return { enabled: row.orderup_enabled === true, help };
}

export const fetchOrderUpEnabled = async (classId?: string | null) => (await fetchOrderUpSettings(classId)).enabled;

/** Saves one setting or both (teacher_set_orderup leaves out the other). */
export async function saveOrderUpSetting(change: Partial<OrderUpSettings>, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_orderup', { enabled: change.enabled ?? null, help: change.help ?? null, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

export interface OrderUpPupil {
  student: string;
  passed: number;
  at: string;
  /** Three hard sets in a row on a level. */
  stuck: boolean;
  /** Bags this week. */
  week: number;
  /** Their most common mistake in the last 30 days. */
  slip: string | null;
}

export interface OrderUpClass {
  pupils: OrderUpPupil[];
  /** The class's mistakes in the last 30 days, most pupils first. */
  slips: { kind: string; pupils: number }[];
}

let cache: { classId: string; at: number; value: Promise<OrderUpClass> } | null = null;

/** The class report (cached for a minute: the Games table and the drawer both ask). */
export function fetchOrderUpClass(classId: string): Promise<OrderUpClass> {
  if (cache && cache.classId === classId && Date.now() - cache.at < 60_000) return cache.value;
  const value = (async () => {
    const { data, error } = await supabase.rpc('teacher_orderup_class', { target_class: classId });
    if (error || !data) {
      cache = null;
      throw new FriendlyError('We couldn’t load Order Up! for this class.');
    }
    return data as OrderUpClass;
  })();
  cache = { classId, at: Date.now(), value };
  return value;
}
