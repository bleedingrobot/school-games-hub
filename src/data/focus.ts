/**
 * The maths focus (docs/MATHS-FOCUS-PLAN.md). The database decides every student's focus; these functions only ask for it,
 * let a student save their own choice, and let teachers set, extend and end focuses. Every one is checked on the server.
 */
import { AUTO_FOCUS, parseFocus, type MathsFocus } from '../../shared/maths/focus';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

/** Messages we wrote in the database are safe to show; anything else gets the fallback. */
function fail(error: { code?: string; message?: string } | null, fallback: string): never {
  if (error?.code && ['22023', '42501'].includes(error.code) && error.message && !error.message.includes('permission denied')) {
    throw new FriendlyError(error.message);
  }
  throw new FriendlyError(fallback);
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------

/**
 * My focus right now, or an error if it cannot be read. A game uses this between levels and keeps the focus it has when it fails,
 * so a dropped connection never changes the maths halfway through a visit.
 */
export async function tryFetchMyFocus(): Promise<MathsFocus> {
  const { data, error } = await supabase.rpc('my_maths_focus');
  if (error || !data) throw new FriendlyError('We couldn’t load your maths focus.');
  return parseFocus(data);
}

/** My focus right now. If it cannot be read the answer is auto, so a screen never waits on it or breaks. */
export async function fetchMyFocus(): Promise<MathsFocus> {
  try {
    return await tryFetchMyFocus();
  } catch {
    return AUTO_FOCUS;
  }
}

/** Saves my own choice (kept underneath any teacher focus). Returns my focus as it is now. */
export async function saveMyFocus(skills: string[], onlyThese: boolean): Promise<MathsFocus> {
  const { data, error } = await supabase.rpc('set_my_maths_focus', { skills, only_these: onlyThese });
  if (error || !data) fail(error, 'We couldn’t save that. Please try again.');
  return parseFocus(data);
}

/** Back to auto. */
export async function clearMyFocus(): Promise<MathsFocus> {
  const { data, error } = await supabase.rpc('clear_my_maths_focus');
  if (error || !data) fail(error, 'We couldn’t change that. Please try again.');
  return parseFocus(data);
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

export type FocusLength = 'lesson' | 'today' | 'friday' | 'week' | 'custom';
export type FocusScope = 'class' | 'group' | 'student';

export interface FocusBatch {
  batch: string;
  classId: string;
  className: string;
  scope: FocusScope;
  /** The groups or students it is for (empty for the whole class). */
  targets: { id: string; name: string }[];
  skills: string[];
  onlyThese: boolean;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  status: 'running' | 'later' | 'ended';
}

export interface NewFocus {
  classId: string;
  scope: FocusScope;
  /** Group ids or student ids; ignored for the whole class. */
  targets: string[];
  skills: string[];
  onlyThese: boolean;
  length: FocusLength;
  /** For 'custom': an ISO time. */
  custom?: string;
}

/** The focuses of one class (or every class I teach): running ones, and the ended history when asked. */
export async function fetchFocuses(classId: string | null, includeEnded = false): Promise<FocusBatch[]> {
  const { data, error } = await supabase.rpc('teacher_maths_focuses', { target_class: classId, include_ended: includeEnded });
  if (error || !Array.isArray(data)) fail(error, 'We couldn’t load the focuses.');
  return data as FocusBatch[];
}

export async function setFocus(f: NewFocus): Promise<number> {
  const { data, error } = await supabase.rpc('teacher_set_maths_focus', {
    target_class: f.classId,
    scope: f.scope,
    targets: f.scope === 'class' ? null : f.targets,
    skills: f.skills,
    only_these: f.onlyThese,
    length: f.length,
    custom: f.length === 'custom' ? (f.custom ?? null) : null,
  });
  if (error) fail(error, 'We couldn’t set that focus.');
  return Number(data ?? 0);
}

/** Makes a running focus last longer. Returns when it now ends. */
export async function extendFocus(batch: string, length: FocusLength, custom?: string): Promise<string> {
  const { data, error } = await supabase.rpc('teacher_extend_maths_focus', { batch, length, custom: length === 'custom' ? (custom ?? null) : null });
  if (error || !data) fail(error, 'We couldn’t extend that focus.');
  return data as string;
}

export async function endFocus(batch: string): Promise<void> {
  const { error } = await supabase.rpc('teacher_end_maths_focus', { batch });
  if (error) fail(error, 'We couldn’t end that focus.');
}
