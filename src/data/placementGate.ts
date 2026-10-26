/**
 * The maths warm-up comes first (James, 22 Oct 2026): in a class whose games pick the maths (auto), a student does the warm-up
 * once before any game opens, so the games and Training start in the right place. This asks whether it is still to do.
 *
 * Cheap on purpose: the class's settings row is already remembered for the game switches, so a class without auto costs nothing
 * more; only a student in an auto class asks for their ladder, and once the warm-up is done that is remembered on the device.
 */
import { useEffect, useState } from 'react';
import { needsPlacement } from '../../shared/training/start';
import { useAuth } from '../auth/AuthContext';
import { readSettings } from './classSettings';
import { fetchMyLadder } from './ladder';

const placedKey = (player: string) => `sgh-placed:${player}`;

/** The warm-up is done (or the device remembers it was), so there is nothing to ask. */
export function rememberedPlaced(player: string): boolean {
  try {
    return localStorage.getItem(placedKey(player)) === '1';
  } catch {
    return false;
  }
}

export function rememberPlaced(player: string): void {
  try {
    localStorage.setItem(placedKey(player), '1');
  } catch {
    // Not remembered: the next game asks the server again, which is fine.
  }
}

/** True when this student must do the warm-up before playing. Anything that fails counts as "no": a failure never locks the games. */
export async function placementNeeded(player: string, role: string): Promise<boolean> {
  if (role === 'teacher' || rememberedPlaced(player)) return false;
  try {
    const settings = await readSettings(['maths_auto']);
    if (!settings || (settings as { maths_auto?: unknown }).maths_auto !== true) return false;
    const ladder = (await fetchMyLadder()).focus.ladder;
    if (!ladder) return false;
    if (ladder.placed !== null) rememberPlaced(player);
    return needsPlacement(ladder, role);
  } catch {
    return false;
  }
}

export type PlacementGateState = { ready: false } | { ready: true; needed: boolean };

/** Decided once when the page opens (a game already going is never closed). */
export function usePlacementGate(): PlacementGateState {
  const { profile } = useAuth();
  const player = profile?.id;
  const role = profile?.role ?? 'student';
  const skip = !player || role === 'teacher' || rememberedPlaced(player);
  const [answer, setAnswer] = useState<{ player: string; needed: boolean } | null>(null);

  useEffect(() => {
    if (!player || skip) return;
    let current = true;
    void placementNeeded(player, role).then((needed) => current && setAnswer({ player, needed }));
    return () => {
      current = false;
    };
  }, [player, role, skip]);

  if (skip) return { ready: true, needed: false };
  if (!answer || answer.player !== player) return { ready: false };
  return { ready: true, needed: answer.needed };
}
