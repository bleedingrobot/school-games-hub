/**
 * Musical Thrones: is the music on right now? True from a round's start until its (secret) stop time, false from then
 * until the next round starts. Re-renders exactly at those moments, so the track cuts out when the music stops.
 */
import { useEffect, useState } from 'react';
import type { ThronesGame } from '../../../shared/classlive/thrones';

type RoundTimes = Pick<NonNullable<ThronesGame['round']>, 'n' | 'startAt' | 'musicEnd'>;

export function useMusicOn(round: RoundTimes | null | undefined, startedAt: number | null, clock: () => number): boolean {
  const [, setTick] = useState(0);
  const t = startedAt === null ? 0 : clock() - startedAt;
  const on = !!round && t >= round.startAt && t < round.musicEnd;
  const startAt = round?.startAt;
  const musicEnd = round?.musicEnd;
  useEffect(() => {
    if (startAt === undefined || musicEnd === undefined || startedAt === null) return;
    const now = clock() - startedAt;
    const nextAt = now < startAt ? startAt : now < musicEnd ? musicEnd : null;
    if (nextAt === null) return;
    const id = window.setTimeout(() => setTick((x) => x + 1), Math.max(0, nextAt - now) + 5);
    return () => window.clearTimeout(id);
  }, [startAt, musicEnd, startedAt, clock, on]);
  return on;
}
