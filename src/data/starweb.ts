/**
 * Star Web's talking to the server (docs/STARWEB-PLAN.md). The `starweb` function picks each sky's known fact and re-checks
 * every star. The preview uses the browser-only trial instead (src/games/starweb/trial.ts). The teacher's parts are at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type StarWebBackend } from '../games/starweb/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';
import { shortCache } from '../teacher/shortCache';

/** The real school server. */
export const liveStarWeb: StarWebBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/starweb`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'Star Web couldn’t be reached. Check the internet and try again.' } };
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

export async function fetchStarWebEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['starweb_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Star Web settings.');
  return (row as Record<string, unknown>).starweb_enabled === true;
}

/** Saves the switch (teacher_set_starweb, in the server migration). */
export async function saveStarWebEnabled(enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_starweb' as never, { enabled, target_class: classId } as never);
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}

export interface StarWebClass {
  /** Pupils who have finished a sky. */
  players: number;
  /** Tables lit, added up over the class. */
  tablesLit: number;
  /** The class's Star Map skies of the last 7 days, the pupils who played them, and how many lit each arm. */
  skies: number;
  pupils: number;
  arms: Record<string, number>;
}

/** One read for the class (the Games table and Today). Shared for a few seconds between Today's parts. */
export function fetchStarWebClass(classId: string): Promise<StarWebClass> {
  return shortCache(`starweb:${classId}`, async () => {
    const { data, error } = await supabase.rpc('teacher_starweb_class' as never, { target_class: classId } as never);
    if (error || !data) throw new FriendlyError('We couldn’t load Star Web for this class.');
    return data as StarWebClass;
  });
}
