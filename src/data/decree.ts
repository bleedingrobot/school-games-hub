/**
 * Royal Decree's talking to the server (docs/DECREE-PLAN.md, section 5). The `decree` server function keeps the
 * whole reign: the browser sends riddle answers and saved moves and gets the reign back as it now is.
 * The preview uses the browser-only trial instead (src/games/decree/trialBackend.ts).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { DecreeError, readReply, type DecreeBackend } from '../games/decree/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveDecree: DecreeBackend = {
  trial: false,
  async send(body) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new DecreeError('Please sign in again.', 'signed-out', 401);
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/decree`, {
        method: 'POST',
        signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new DecreeError("Riverstone couldn't be reached. Check the internet and try again.", 'offline');
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

export async function fetchDecreeEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['decree_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Royal Decree setting.');
  return row.decree_enabled === true;
}

export async function saveDecreeEnabled(enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_decree', { enabled, target_class: classId });
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
