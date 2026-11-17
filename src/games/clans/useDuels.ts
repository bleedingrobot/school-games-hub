/**
 * Keeps a pupil's Live Clan Duels up to date while Clan Quest is open (the same as Dragon Maths' useClashes):
 * "I'm here" every HERE_EVERY_MS (not while the tab is hidden), Realtime on the pupil's duels, and asking the server to
 * play a round when its time runs out. Newer versions of a duel always win, so a late message can't take it backwards.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { duelOpen, type DuelRow } from '../../../shared/clans/duelServer';
import type { DuelApi, DuelAsk, DuelCheer, DuelMate, DuelRequest, DuelResult, LiveStatus } from '../../data/clanDuel';

export const HERE_EVERY_MS = 30_000;

export interface Duels {
  /** Live duels are on for this class ("I'm here" has answered and said so). */
  on: boolean;
  me: string;
  online: DuelMate[] | null;
  asks: DuelAsk[];
  duel: DuelRow | null;
  live: LiveStatus;
  serverNow: () => number;
  refresh: () => Promise<void>;
  send: (request: DuelRequest) => Promise<DuelResult>;
  cheer: (cheer: DuelCheer) => Promise<void>;
  forget: (duelId: number) => void;
}

function newer(prev: DuelRow | null, next: DuelRow): boolean {
  if (!prev) return true;
  if (prev.id === next.id) return next.version > prev.version;
  return duelOpen(next) && (!duelOpen(prev) || next.id > prev.id);
}

export function useDuels(api: DuelApi | undefined): Duels {
  const me = api?.me ?? '';
  const [on, setOn] = useState(false);
  const [online, setOnline] = useState<DuelMate[] | null>(null);
  const [asks, setAsks] = useState<DuelAsk[]>([]);
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [live, setLive] = useState<LiveStatus>('connecting');
  const offset = useRef(0);
  const forgotten = useRef(new Set<number>());
  const duelRef = useRef<DuelRow | null>(null);
  duelRef.current = duel;

  const accept = useCallback((next: DuelRow | null | undefined) => {
    if (!next || forgotten.current.has(next.id)) return;
    setAsks((list) => {
      const without = list.filter((a) => a.duel !== next.id);
      return next.status === 'asked' && next.seat_b === me ? [...without, { duel: next.id, from: next.name_a, deadline: next.deadline }] : without;
    });
    if (next.status === 'asked' && next.seat_b === me) return;
    if (next.seat_b === me && next.status !== 'playing' && !(next.status === 'done' && next.ending) && duelRef.current?.id !== next.id) return;
    setDuel((prev) => (newer(prev, next) ? next : prev));
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
    setAsks(h.asks.filter((a) => !forgotten.current.has(a.duel)));
    if (h.duel) accept(h.duel);
  }, [api, accept]);

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

  useEffect(() => {
    if (!api || !me) return;
    return api.watch(me, accept, setLive);
  }, [api, me, accept]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  useEffect(() => {
    if (!api || !duel || duel.status !== 'playing') return;
    const wait = Date.parse(duel.deadline) - serverNow() + 1600 + Math.random() * 1500;
    const timer = window.setTimeout(() => {
      void api.send({ action: 'duel-times-up', duel: duel.id }).then((r) => accept(r.duel ?? undefined));
    }, Math.max(0, wait));
    return () => window.clearTimeout(timer);
  }, [api, duel, serverNow, accept]);

  useEffect(() => {
    if (!duel || duel.status !== 'asked') return;
    const timer = window.setTimeout(() => void refresh(), Math.max(0, Date.parse(duel.deadline) - serverNow() + 1500));
    return () => window.clearTimeout(timer);
  }, [duel, serverNow, refresh]);

  const send = useCallback(async (request: DuelRequest) => {
    if (!api) return { ok: false as const, message: 'Live duels aren’t on here.' };
    const r = await api.send(request);
    accept(r.duel ?? undefined);
    return r;
  }, [api, accept]);

  const cheer = useCallback(async (c: DuelCheer) => {
    if (!api || !duelRef.current) return;
    accept(await api.cheer(duelRef.current.id, c));
  }, [api, accept]);

  const forget = useCallback((id: number) => {
    forgotten.current.add(id);
    setAsks((list) => list.filter((a) => a.duel !== id));
    setDuel((d) => (d?.id === id ? null : d));
  }, []);

  return { on, me, online, asks, duel, live, serverNow, refresh, send, cheer, forget };
}
