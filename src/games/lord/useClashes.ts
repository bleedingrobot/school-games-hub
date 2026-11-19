/**
 * Keeps a pupil's live arena clashes up to date while Dragon Maths is open (the Archery classmate-fight pattern):
 *
 * - "I'm here" every HERE_EVERY_MS (a little more, at random, so a class doesn't ask in step), which also brings who else
 *   in the class is here, any challenges, and the open clash (a backup to Realtime). Not while the tab is hidden.
 * - Realtime on the pupil's clashes: a challenge to them, a yes or no, every round.
 * - When a round's time runs out, asks the server to play it (the server checks its own clock).
 *
 * Newer versions of a clash always win, so a late message can never take it backwards.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { clashOpen, type ClashRow } from '../../../shared/lord/clashServer';
import type { Cheer, ClashApi, ClashAsk, ClashClassmate, ClashRequest, ClashResult, LiveStatus } from '../../data/lordClash';

export type { ClashApi };

export const HERE_EVERY_MS = 30_000;

export interface Clashes {
  /** Classmate clashes are on for this class ("I'm here" has answered and said so). */
  on: boolean;
  online: ClashClassmate[] | null;
  asks: ClashAsk[];
  /** The clash being shown: the open one, or the last one until it's put away. */
  clash: ClashRow | null;
  live: LiveStatus;
  /** Now by the server's clock (ms). */
  serverNow: () => number;
  refresh: () => Promise<void>;
  send: (request: ClashRequest) => Promise<ClashResult>;
  cheer: (cheer: Cheer) => Promise<void>;
  /** Puts away an ended clash, or hides a challenge. */
  forget: (clashId: number) => void;
}

function newer(prev: ClashRow | null, next: ClashRow): boolean {
  if (!prev) return true;
  if (prev.id === next.id) return next.version > prev.version;
  return clashOpen(next) && (!clashOpen(prev) || next.id > prev.id);
}

export function useClashes(api: ClashApi | undefined, me: string): Clashes {
  const [on, setOn] = useState(false);
  const [online, setOnline] = useState<ClashClassmate[] | null>(null);
  const [asks, setAsks] = useState<ClashAsk[]>([]);
  const [clash, setClash] = useState<ClashRow | null>(null);
  const [live, setLive] = useState<LiveStatus>('connecting');
  const offset = useRef(0);
  const forgotten = useRef(new Set<number>());
  const clashRef = useRef<ClashRow | null>(null);
  clashRef.current = clash;

  const accept = useCallback((next: ClashRow | null | undefined) => {
    if (!next || forgotten.current.has(next.id)) return;
    setAsks((list) => {
      const without = list.filter((a) => a.clash !== next.id);
      return next.status === 'asked' && next.seat_b === me ? [...without, { clash: next.id, from: next.name_a, deadline: next.deadline }] : without;
    });
    if (next.status === 'asked' && next.seat_b === me) return;
    // A challenge to me that ended before I said yes isn't mine to show.
    if (next.seat_b === me && next.status !== 'playing' && !(next.status === 'done' && next.ending) && clashRef.current?.id !== next.id) return;
    setClash((prev) => (newer(prev, next) ? next : prev));
  }, [me]);

  const refresh = useCallback(async () => {
    if (!api) return;
    const h = await api.here();
    if (!h) return;
    if (h.off) {
      setOn(false);
      setOnline(null);
      setAsks([]);
      return;
    }
    setOn(true);
    setOnline(h.online);
    setAsks(h.asks.filter((a) => !forgotten.current.has(a.clash)));
    if (h.clash) accept(h.clash);
  }, [api, accept]);

  // "I'm here", now and then.
  useEffect(() => {
    if (!api || !me) return;
    let stopped = false;
    let timer: number | undefined;
    const loop = async () => {
      if (stopped) return;
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') await refresh();
      timer = window.setTimeout(() => void loop(), HERE_EVERY_MS + Math.random() * 5000);
    };
    void api.clockOffset().then((o) => { offset.current = o; });
    void loop();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [api, me, refresh]);

  // Realtime.
  useEffect(() => {
    if (!api || !me) return;
    return api.watch(me, accept, setLive);
  }, [api, me, accept]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  // The round's time ran out: ask the server to play it (a moment late, at random, so both screens don't ask at once).
  useEffect(() => {
    if (!api || !clash || clash.status !== 'playing') return;
    const wait = Date.parse(clash.deadline) - serverNow() + 1600 + Math.random() * 1500;
    const timer = window.setTimeout(() => {
      void api.send({ action: 'clash-times-up', clash: clash.id }).then((r) => accept(r.clash ?? undefined));
    }, Math.max(0, wait));
    return () => window.clearTimeout(timer);
  }, [api, clash, serverNow, accept]);

  // A challenge I sent runs out: look again.
  useEffect(() => {
    if (!clash || clash.status !== 'asked') return;
    const timer = window.setTimeout(() => void refresh(), Math.max(0, Date.parse(clash.deadline) - serverNow() + 1500));
    return () => window.clearTimeout(timer);
  }, [clash, serverNow, refresh]);

  const send = useCallback(async (request: ClashRequest) => {
    if (!api) return { ok: false as const, message: 'Arena clashes with friends aren’t on here.' };
    const r = await api.send(request);
    accept(r.clash ?? undefined);
    return r;
  }, [api, accept]);

  const cheer = useCallback(async (c: Cheer) => {
    if (!api || !clashRef.current) return;
    accept(await api.cheer(clashRef.current.id, c));
  }, [api, accept]);

  const forget = useCallback((id: number) => {
    forgotten.current.add(id);
    setAsks((list) => list.filter((a) => a.clash !== id));
    setClash((c) => (c?.id === id ? null : c));
  }, []);

  return { on, online, asks, clash, live, serverNow, refresh, send, cheer, forget };
}
