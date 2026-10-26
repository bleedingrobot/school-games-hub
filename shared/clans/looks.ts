/**
 * How a member looks: each race and class was painted four times (two girls, two boys), and the pupil picks one in the
 * creator or with "Change look". Only the picture changes, never the stats. Members saved before looks existed have
 * none, so they get one worked out from their name: it never changes by itself, and the pupil can still pick another.
 */
import type { Done } from './empire';
import type { Clan, Member } from './types';

export const LOOKS = ['female-1', 'female-2', 'male-1', 'male-2'] as const;
export type Look = (typeof LOOKS)[number];

export const isLook = (v: unknown): v is Look => typeof v === 'string' && (LOOKS as readonly string[]).includes(v);

/** The same name always gives the same look. */
export function lookFromName(name: string): Look {
  let h = 0;
  for (const ch of name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return LOOKS[Math.abs(h) % LOOKS.length];
}

export const lookOf = (m: Pick<Member, 'name' | 'look'>): Look => (isLook(m.look) ? m.look : lookFromName(m.name));

/** "Change look" for one member. Allowed any time, free. */
export function setLook(clan: Clan, memberIndex: number, look: Look): Done {
  const m = clan.members[memberIndex];
  if (!m) return { ok: false, why: 'member', say: 'Pick one of your clan.' };
  if (!isLook(look)) return { ok: false, why: 'look', say: 'Pick one of the four looks.' };
  m.look = look;
  return { ok: true };
}
