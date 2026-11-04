/**
 * QR sign-in badges for young pupils (docs/BADGE-SIGN-IN-PLAN.md). The teacher prints a card per pupil; its QR code is a link
 * to this site's /#/badge/<code> page. Scanning it with the iPad's camera (or the "Scan my badge" button) opens that page,
 * which asks the "badge" server function for a one-time key and signs the pupil in with it.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '../config';
import { supabase } from '../lib/supabase';
import { FriendlyError } from './profile';

const CODE = /^[0-9a-f]{32}$/;

/** The badge code in whatever a scan read: the card's link, or the bare code. Null if it isn't a badge. */
export function codeFromScan(text: string): string | null {
  const t = text.trim().toLowerCase();
  if (CODE.test(t)) return t;
  const m = t.match(/#\/badge\/([0-9a-f]{32})(?:[/?#]|$)/);
  return m ? m[1] : null;
}

/** The link a badge's QR code holds, on this copy of the site. */
export function badgeLink(code: string, where: Pick<Location, 'origin' | 'pathname'> = window.location): string {
  return `${where.origin}${where.pathname}#/badge/${code}`;
}

/** Signs in as the pupil this badge belongs to (whoever was signed in on this device before). Returns their id. */
export async function signInWithBadge(code: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/badge`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  } catch {
    throw new FriendlyError('Can’t reach the internet. Check the wifi and try again.');
  }
  const body = (await response.json().catch(() => ({}))) as { key?: string; error?: string };
  if (!response.ok || !body.key) throw new FriendlyError(body.error ?? 'That badge didn’t work. Try again.');
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: body.key, type: 'magiclink' });
  if (error || !data.user) throw new FriendlyError('That badge didn’t work. Try again.');
  return data.user.id;
}

export interface PupilBadge {
  player: string;
  displayName: string;
  realName: string;
  code: string;
}

/** The class's badges, made the first time (teachers of the class only). */
export async function fetchClassBadges(classId: string): Promise<PupilBadge[]> {
  const { data, error } = await supabase.rpc('teacher_class_badges', { target_class: classId });
  if (error) throw new FriendlyError(error.code === '42501' ? 'That isn’t one of your classes.' : 'Couldn’t load the badges. Please try again.');
  return ((data ?? []) as { player: string; display_name: string; real_name: string; code: string }[]).map((r) => ({
    player: r.player,
    displayName: r.display_name,
    realName: r.real_name,
    code: r.code,
  }));
}

/** A new code for one pupil: their old card stops working. Returns the new code. */
export async function renewBadge(player: string): Promise<string> {
  const { data, error } = await supabase.rpc('teacher_renew_badge', { pupil: player });
  if (error || typeof data !== 'string') throw new FriendlyError('Couldn’t make a new badge. Please try again.');
  return data;
}
