/**
 * Bonkers Quest's talking to the server (docs/BONKERS-PLAN.md): the `bonkers` function makes each adventure's fights and
 * questions, marks every answer once and replays the adventure to save it. The teacher's switch is at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../config';
import { supabase } from '../../lib/supabase';
import { readSettings } from '../../data/classSettings';
import { FriendlyError } from '../../data/profile';
import { forgetSettings } from '../../data/settingsMemory';
import { fromServer, type BonkersBackend } from './backend';

/** The real school server. */
export const liveBonkers: BonkersBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/bonkers`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'Bonkers Quest couldn’t be reached. Check the internet and try again.' } };
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

export async function fetchBonkersEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['bonkers_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Bonkers Quest settings.');
  return (row as Record<string, unknown>).bonkers_enabled !== false;
}

/** Saves the switch (teacher_set_bonkers, in the server migration). */
export async function saveBonkersEnabled(enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_bonkers' as never, { enabled, target_class: classId } as never);
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
