/**
 * A Cloudflare room's spots over a WebSocket (shared/classlive/edge.ts, docs/plans/classlive-edge/PLAN.md). For a
 * room with `edge`, `useEdgeLink` gives back the same link with `move`, `ghostMove`, `crewMove` and `positions` answered
 * from the socket at once (the latest frame the room sent); every other step still goes to the server function. A dropped socket
 * reconnects by itself (a new ticket each time) and, meanwhile, the spot calls answer null ("nothing new this time").
 */
import { useEffect, useMemo, useRef } from 'react';
import { EDGE_IDLE_MS, EDGE_SEND_MS, type AllFrame, type CrewFrame, type PupilFrame } from '../../../shared/classlive/edge';
import type { GhostSpots } from '../../../shared/classlive/ghostBot';
import type { ClassLiveLink } from './link';

type Frame = PupilFrame | AllFrame | CrewFrame;

class EdgeSocket {
  frame: Frame | null = null;
  people: Record<string, { x: number; y: number }> | null = null;
  private ws: WebSocket | null = null;
  private stopped = false;
  private tries = 0;
  private ping = 0;
  private last = { x: -1, y: -1, at: 0 };

  constructor(private link: ClassLiveLink, private room: number) {
    void this.connect();
  }

  get open() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private async connect() {
    if (this.stopped) return;
    let url = '';
    try {
      const out = await this.link.send({ action: 'edge', room: this.room });
      const b = out.body as { url?: unknown; ticket?: unknown };
      if (out.status === 200 && typeof b.url === 'string' && typeof b.ticket === 'string') url = `${b.url}?ticket=${encodeURIComponent(b.ticket)}`;
    } catch {
      // Tried again below.
    }
    if (this.stopped) return;
    if (!url) return this.retry();
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => { this.tries = 0; this.last.at = 0; };
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      try {
        const m = JSON.parse(e.data) as { s?: Frame; p?: Record<string, [number, number]> };
        if (m.s) this.frame = m.s;
        if (m.p) this.people = Object.fromEntries(Object.entries(m.p).map(([id, [x, y]]) => [id, { x, y }]));
      } catch {
        // A frame that can't be read: the next one comes in 0.1 s.
      }
    };
    ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.retry(); } };
    window.clearInterval(this.ping);
    this.ping = window.setInterval(() => { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send('ping'); }, 20_000);
  }

  private retry() {
    if (this.stopped) return;
    const wait = Math.min(8000, 500 * 2 ** this.tries++);
    window.setTimeout(() => void this.connect(), wait);
  }

  /** Says where I am, unless I haven't moved and said so less than a second ago. */
  move(x: number, y: number) {
    if (!this.open) return false;
    const now = Date.now();
    const same = Math.abs(x - this.last.x) < 0.0005 && Math.abs(y - this.last.y) < 0.0005;
    if (same && now - this.last.at < EDGE_IDLE_MS) return true;
    this.last = { x, y, at: now };
    this.ws!.send(JSON.stringify({ m: [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000] }));
    return true;
  }

  close() {
    this.stopped = true;
    window.clearInterval(this.ping);
    try { this.ws?.close(1000, 'bye'); } catch { /* already closed */ }
    this.ws = null;
  }
}

/** The link to use for this room: the Cloudflare one for a pilot room, else `link` itself. */
export function useEdgeLink(link: ClassLiveLink, room: number | null, edge: boolean | undefined): ClassLiveLink & { sendMs?: number; readMs?: number } {
  const sock = useRef<EdgeSocket | null>(null);
  const on = !!edge && room !== null;
  useEffect(() => {
    if (!on || room === null) return;
    const s = new EdgeSocket(link, room);
    sock.current = s;
    return () => { s.close(); if (sock.current === s) sock.current = null; };
  }, [on, room, link]);
  return useMemo(() => {
    if (!on) return link;
    return {
      ...link,
      sendMs: EDGE_SEND_MS,
      readMs: EDGE_SEND_MS,
      async move(_room, x, y) {
        const s = sock.current;
        if (!s?.move(x, y)) return null;
        return s.frame ? s.frame.spots.map(([sx, sy]) => ({ x: sx, y: sy })) : [];
      },
      async ghostMove(_room, x, y): Promise<GhostSpots | null> {
        const s = sock.current;
        if (!s?.move(x, y) || !s.frame || !('me' in s.frame) || !('ghost' in s.frame.me)) return null;
        return s.frame as PupilFrame;
      },
      async crewMove(_room, x, y) {
        const s = sock.current;
        if (!s?.move(x, y) || !s.frame || !('me' in s.frame) || !('glitch' in s.frame.me)) return null;
        return s.frame as CrewFrame;
      },
      async positions() {
        return sock.current?.people ?? null;
      },
    };
  }, [on, link]);
}
