/**
 * Goblin Storm talking to the school's server (the `goblinstorm` function, docs/GOBLINSTORM-PLAN.md "Server"). The
 * function makes and marks the level-up questions and replays each run; the preview uses `standInBackend` instead.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../../config';
import { supabase } from '../../lib/supabase';
import { fromServer, type GoblinStormBackend } from './backend';

export const liveGoblinStorm: GoblinStormBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/goblinstorm`, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'The storm couldn’t be reached. Check the internet and try again.' } };
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    // An empty or broken reply: the status still says what happened.
  }
  return { status: response.status, body: parsed };
});
