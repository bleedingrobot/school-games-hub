/**
 * Connection numbers for the Cloudflare pilot's before-and-after (docs/plans/classlive-edge/PLAN.md): the same numbers
 * on the school server and on Cloudflare. Each Ghost Tag pad and big screen counts its spot calls (how long each took,
 * how many came back empty or failed) and how often fresh spots arrived, then sends one summary when the game ends
 * (`action: 'stats'`, kept in classlive_netstats). No answers, scores or names.
 */
import { useEffect, useRef } from 'react';
import type { ClassLiveLink } from './link';

const pct = (xs: number[], p: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]);
};

export class NetStats {
  private start = Date.now();
  private rtts: number[] = [];
  private gaps: number[] = [];
  private calls = 0;
  private empty = 0;
  private fresh = 0;
  private lastFresh = 0;
  /** Big screen: pupil dots that moved between reads. */
  private moved = 0;

  /** One spot call: how long it took, and whether fresh spots came back (`seen` changed). */
  call(ms: number, got: boolean, isNew: boolean, moved = 0) {
    this.calls++;
    if (this.rtts.length < 5000) this.rtts.push(ms);
    if (!got) this.empty++;
    if (got && isNew) this.freshNow(moved);
  }

  private freshNow(moved: number) {
    const now = Date.now();
    if (this.lastFresh && this.gaps.length < 5000) this.gaps.push(now - this.lastFresh);
    this.lastFresh = now;
    this.fresh++;
    this.moved += moved;
  }

  summary() {
    const s = Math.max(1, (Date.now() - this.start) / 1000);
    return {
      seconds: Math.round(s), calls: this.calls, empty: this.empty, fresh: this.fresh,
      rttP50: pct(this.rtts, 0.5), rttP95: pct(this.rtts, 0.95), gapP50: pct(this.gaps, 0.5), gapP95: pct(this.gaps, 0.95),
      freshPerS: Math.round((this.fresh / s) * 10) / 10, movedPerS: Math.round((this.moved / s) * 10) / 10,
    };
  }

  get worth() {
    return this.calls >= 20;
  }
}

/** Counts while the game is live and sends the summary once, when it's over (or the screen closes). */
export function useNetStats(link: ClassLiveLink, room: number | null, part: 'pad' | 'screen', live: boolean, over: boolean, edge: boolean) {
  const stats = useRef<NetStats | null>(null);
  const sent = useRef(false);
  if (live && !stats.current) stats.current = new NetStats();
  const send = useRef(() => {});
  send.current = () => {
    const s = stats.current;
    if (sent.current || !s?.worth || room === null) return;
    sent.current = true;
    void link.send({ action: 'stats', room, part, version: edge ? 'edge' : 'db', stats: s.summary() }).catch(() => undefined);
  };
  useEffect(() => { if (over) send.current(); }, [over]);
  useEffect(() => () => send.current(), []);
  return stats;
}
