/**
 * Glyph Gates' talking to the server (docs/GLYPH-PLAN.md). The `glyph` function makes each temple's walls and replays the
 * goes. The preview uses the browser-only trial instead (src/games/glyph/trial.ts). The teacher's switch is at the foot.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { fromServer, type GlyphBackend } from '../games/glyph/backend';
import { readSettings } from './classSettings';
import { FriendlyError } from './profile';
import { forgetSettings } from './settingsMemory';

/** The real school server. */
export const liveGlyph: GlyphBackend = fromServer(async (body) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: 401, body: { error: 'Please sign in again.' } };
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/glyph`, {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 503, body: { error: 'Glyph Gates couldn’t be reached. Check the internet and try again.' } };
  }
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await response.json()) as Record<string, unknown>;
  } catch {
    // An empty or broken reply: the status still says what happened.
  }
  return { status: response.status, body: parsed };
});

// ---------------------------------------------------------------- the teacher's switch

export async function fetchGlyphEnabled(classId?: string | null): Promise<boolean> {
  const row = await readSettings(['glyph_enabled'], classId);
  if (!row) throw new FriendlyError('We couldn’t load the Glyph Gates settings.');
  return (row as Record<string, unknown>).glyph_enabled === true;
}

/** Saves the switch (teacher_set_glyph, in the server migration). */
export async function saveGlyphEnabled(enabled: boolean, classId: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_set_glyph' as never, { enabled, target_class: classId } as never);
  forgetSettings();
  if (error) throw new FriendlyError('We couldn’t change that.');
}
