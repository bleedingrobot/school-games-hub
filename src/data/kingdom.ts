/**
 * Kingdom Keeper's talking to the server (docs/KINGDOM-PLAN.md, section 5). The `kingdom` server function keeps the
 * whole reign: the browser sends a year's decisions or a council answer and gets the reign back as it now is.
 * The preview uses the browser-only trial instead (src/games/kingdom/trialBackend.ts).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { KingdomError, readReply, type KingdomBackend } from '../games/kingdom/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveKingdom: KingdomBackend = {
  trial: false,
  async send(body) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new KingdomError('Please sign in again.', 'signed-out', 401);
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/kingdom`, {
        method: 'POST',
        signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new KingdomError("Riverstone couldn't be reached. Check the internet and try again.", 'offline');
    }
    let parsed: Record<string, unknown> = {};
    try {
      parsed = (await response.json()) as Record<string, unknown>;
    } catch {
      // An empty or broken reply: the status still says what happened.
    }
    return readReply(response.status, parsed);
  },
};

export async function fetchKingdomEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['kingdom_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Kingdom Keeper setting.');
  return row.kingdom_enabled === true;
}

export async function saveKingdomEnabled(enabled: boolean, classId?: string | null): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_kingdom', { enabled, target_class: classId ?? null });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
