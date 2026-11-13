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
import { shortCache } from '../teacher/shortCache';

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

// ---------------------------------------------------------------- the teacher's reads (migration 20261114000300)

export interface GlyphClassPupil {
  student: string;
  /** Temples passed, of 6. */
  passed: number;
  walls: number;
  lastPlayed: string | null;
  /** The temple tried on 3 or more days without a pass, and on how many days; null when not stuck. */
  stuckTemple: number | null;
  stuckDays: number | null;
}

export interface GlyphMistakeCount {
  /** A named mistake (shared/glyph/config.ts TrapKind, or 'missed'). */
  mistake: string;
  count: number;
  /** Pupils who made it (class read only). */
  students?: number;
}

export interface GlyphClass {
  players: GlyphClassPupil[];
  /** The class's most common mistakes over the last 14 days. */
  hardest: GlyphMistakeCount[];
}

/** One read for the class (stuck pupils and the common mistakes). Shared for a few seconds between Today's parts. */
export function fetchGlyphClass(classId: string): Promise<GlyphClass> {
  return shortCache(`glyph:${classId}`, async () => {
    const { data, error } = await supabase.rpc('teacher_glyph_class' as never, { target_class: classId } as never);
    if (error || !data) throw new FriendlyError('We couldn’t load Glyph Gates for this class.');
    return data as GlyphClass;
  });
}

export interface GlyphStudent {
  passed: number;
  walls: number;
  /** Best first-go walls (of 9) by temple number. */
  best: Record<string, number>;
  lastPlayed: string | null;
  mistakes: GlyphMistakeCount[];
}

/** One student's temples, or null if they haven't played. */
export async function fetchGlyphStudent(student: string): Promise<GlyphStudent | null> {
  const { data, error } = await supabase.rpc('teacher_glyph_student' as never, { student } as never);
  if (error) throw new FriendlyError('We couldn’t load Glyph Gates for this student.');
  return (data ?? null) as GlyphStudent | null;
}
