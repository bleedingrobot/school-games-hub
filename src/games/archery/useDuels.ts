/**
 * Keeps a pupil's classmate fights up to date while the game is open (docs/ARCHERY-PLAN.md, section 7, Stage 6):
 *
 * - "I'm here" every HERE_EVERY_MS (a little more, at random, so a class doesn't ask in step), which also brings who
 *   else in the class is here and any challenges. Not while the tab is hidden, or during a classmate fight (the fight
 *   has its own checks, and the pupil shows as busy anyway).
 * - Realtime on the pupil's fights: a challenge to them, a yes or no, a pack, every turn.
 * - While a fight is open, a check now and then in case a Realtime change was missed (`useGameChecks`, the hub's
 *   pattern for games with classmates).
 *
 * Newer versions of a fight always win, so a late message can never take it backwards.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { HERE_EVERY_MS } from '../../../shared/archery/config';
import { duelOpen, type Ask, type Classmate, type DuelRow } from '../../../shared/archery/duel';
import type { DuelLink, LiveStatus } from '../../data/archery';
import { useGameChecks } from '../../multiplayer/useGameChecks';

export interface Duels {
  /** Classmates with the game open (null until the first "I'm here" comes back). */
  online: Classmate[] | null;
  /** Challenges waiting for this pupil's answer (newest last). */
  asks: Ask[];
  /** The fight being shown: the pupil's open one, or the last one until it's put away. */
  duel: DuelRow | null;
  live: LiveStatus;
  /** The game was switched off for the class. */
  off: boolean;
  /** "I'm here" couldn't reach the server last time. */
  offline: boolean;
  /** Now by the server's clock (ms). */
  serverNow: () => number;
  /** Says "I'm here" now (opening the list, after a refusal). */
  refresh: () => Promise<void>;
  /** A fight the server just sent back (after a move): shown if it's newer. */
  accept: (duel: DuelRow | null) => void;
  /** Puts away an ended fight (back home), or hides a challenge. */
  forget: (duelId: number) => void;
}

/** Newer wins: the same fight at a higher version, or an open fight over an ended or missing one. */
function newer(prev: DuelRow | null, next: DuelRow): boolean {
  if (!prev) return true;
  if (prev.id === next.id) return next.version > prev.version;
  return duelOpen(next) && (!duelOpen(prev) || next.id > prev.id);
}

export function useDuels(link: DuelLink | undefined, me: string, paused: boolean): Duels {
  const [online, setOnline] = useState<Classmate[] | null>(null);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [live, setLive] = useState<LiveStatus>('connecting');
  const [off, setOff] = useState(false);
  const [offline, setOffline] = useState(false);
  const offset = useRef(0);
  const forgotten = useRef(new Set<number>());
  const duelRef = useRef<DuelRow | null>(null);
  duelRef.current = duel;

  const accept = useCallback((next: DuelRow | null) => {
    if (!next || forgotten.current.has(next.id)) return;
    // A challenge to me shows as an ask until it's answered; then it's the fight.
    setAsks((list) => {
      const without = list.filter((a) => a.duel !== next.id);
      return next.status === 'asked' && next.seat_b === me ? [...without, { duel: next.id, from: next.name_a, world: next.world, deadline: next.deadline }] : without;
    });
    if (next.status === 'asked' && next.seat_b === me) return;
    // Someone else's challenge that ended before I answered isn't mine to show.
    if (next.seat_b === me && next.status !== 'packing' && next.status !== 'playing' && !(next.status === 'done' && next.ending)) {
      if (duelRef.current?.id !== next.id) return;
    }
    setDuel((prev) => (newer(prev, next) ? next : prev));
  }, [me]);

  const refresh = useCallback(async () => {
    if (!link) return;
    const r = await link.here();
    if (!r) {
      setOffline(true);
      return;
    }
    setOffline(false);
    setOff(!!r.off);
    setOnline(r.online);
    setAsks((list) => {
      const now = Date.now() + offset.current;
      const fresh = r.asks.filter((a) => !forgotten.current.has(a.duel) && Date.parse(a.deadline) > now);
      // Keep any that Realtime brought in since (the reply may be older), drop any that ran out.
      const kept = list.filter((a) => !fresh.some((f) => f.duel === a.duel) && Date.parse(a.deadline) > now);
      return [...kept, ...fresh];
    });
    if (r.duel) accept(r.duel);
  }, [link, accept]);

  // The server's clock, once.
  useEffect(() => {
    if (!link) return;
    void link.clockOffset().then((ms) => (offset.current = ms));
  }, [link]);

  // "I'm here": now, then every HERE_EVERY_MS while the tab shows, except during a classmate fight.
  useEffect(() => {
    if (!link || paused) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const beat = () => {
      if (stopped) return;
      if (document.visibilityState !== 'hidden') void refresh();
      timer = setTimeout(beat, Math.round(HERE_EVERY_MS * (1 + 0.2 * Math.random())));
    };
    beat();
    const again = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', again);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', again);
    };
  }, [link, paused, refresh]);

  // Realtime: every change to my fights.
  useEffect(() => {
    if (!link || !me) return;
    return link.watch(
      me,
      (row, id) => {
        if (row) accept(row);
        else void link.read(id).then((r) => r && r !== 'offline' && accept(r));
      },
      setLive,
    );
  }, [link, me, accept]);

  // A backup check while a fight is open, in case a Realtime change was missed.
  const checkFight = useCallback(() => {
    const d = duelRef.current;
    if (!link || !d) return;
    void link.read(d.id).then((r) => r && r !== 'offline' && accept(r));
  }, [link, accept]);
  useGameChecks(!!duel && duelOpen(duel), live, checkFight);

  const forget = useCallback((id: number) => {
    forgotten.current.add(id);
    setAsks((list) => list.filter((a) => a.duel !== id));
    setDuel((d) => (d && d.id === id && !duelOpen(d) ? null : d));
  }, []);

  return { online, asks, duel, live, off, offline, serverNow: () => Date.now() + offset.current, refresh, accept, forget };
}
