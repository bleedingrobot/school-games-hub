/**
 * Sky Isles' talking to the server (docs/ISLES-PLAN.md, section 8). The `isles` server function keeps the whole island:
 * the browser sends a turn's choices or an answer and gets the island back as it now is. The preview uses the
 * browser-only trial instead (src/games/isles/trialBackend.ts).
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { IslesError, readReply, type IslesBackend } from '../games/isles/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';

/** The real school server. */
export const liveIsles: IslesBackend = {
  trial: false,
  async send(body) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new IslesError('Please sign in again.', 'signed-out', 401);
    let response: Response;
    try {
      response = await fetch(`${SUPABASE_URL}/functions/v1/isles`, {
        method: 'POST',
        signal: AbortSignal.timeout(12_000),
        headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new IslesError("The sky post couldn't get through. Check the internet and try again.", 'offline');
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

export async function fetchIslesEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['isles_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Sky Isles setting.');
  return row.isles_enabled === true;
}
