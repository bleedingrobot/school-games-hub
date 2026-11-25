/**
 * Adding new pupils by school email, and finding any pupil's badge (docs/plans/badge-review/ADD-PUPILS.md). The "pupils"
 * server function makes accounts for emails that have none; teacher_add_pupils_by_email then puts everyone in the class and
 * makes their badges. When the pupil later signs in with Google, it joins the same account.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

export { emailsIn } from '../../shared/pupils/emails';

export type Outcome = 'added' | 'here' | 'other-class' | 'teacher' | 'no-account' | 'not-school';

export interface AddedPupil {
  email: string;
  outcome: Outcome;
  player: string | null;
  displayName: string | null;
  realName: string;
  code: string | null;
  className: string | null;
}

export interface FoundPupil {
  player: string;
  displayName: string;
  realName: string;
  code: string;
  className: string | null;
}

async function callPupils(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new FriendlyError('Please sign in again.');
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/pupils`, {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new FriendlyError('Can’t reach the server. Check the internet and try again.');
  }
  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new FriendlyError(typeof parsed.error === 'string' ? parsed.error : 'Something went wrong. Please try again.');
  return parsed;
}

/** The emails in a Google Doc or Sheet shared as "anyone with the link can view". */
export async function emailsFromGoogle(link: string): Promise<string[]> {
  const body = await callPupils({ link });
  return Array.isArray(body.emails) ? (body.emails as string[]) : [];
}

/** Makes accounts for the new emails, then puts every pupil in the class with a badge. One row per email. */
export async function addPupils(classId: string, emails: string[]): Promise<AddedPupil[]> {
  await callPupils({ emails });
  const { data, error } = await supabase.rpc('teacher_add_pupils_by_email', { target_class: classId, emails });
  if (error) throw new FriendlyError(error.code === '42501' ? 'That isn’t one of your classes.' : 'Couldn’t add the pupils. Please try again.');
  return ((data ?? []) as Record<string, string | null>[]).map((r) => ({
    email: r.email ?? '',
    outcome: r.outcome as Outcome,
    player: r.player,
    displayName: r.display_name,
    realName: r.real_name ?? '',
    code: r.code,
    className: r.class_name,
  }));
}

/** Pupils I may see whose name, email name or player name has these words, with their badges. */
export async function findPupils(words: string): Promise<FoundPupil[]> {
  const { data, error } = await supabase.rpc('teacher_find_pupils', { words });
  if (error) throw new FriendlyError('Couldn’t search. Please try again.');
  return ((data ?? []) as Record<string, string | null>[]).map((r) => ({
    player: r.player ?? '',
    displayName: r.display_name ?? '',
    realName: r.real_name ?? '',
    code: r.code ?? '',
    className: r.class_name,
  }));
}
