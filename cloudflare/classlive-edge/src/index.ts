/**
 * Class Live's Cloudflare Worker (docs/plans/classlive-edge/PLAN.md): one Durable Object per Class Live room keeps the
 * room's spots in memory. The rules for spots are shared/classlive/edge.ts (`EdgeRoom`); this file is only the wiring.
 *
 *   GET  /room/<id>/ws?ticket=…   a device's WebSocket (ticket from the classlive server function)
 *   POST /room/<id>/sync          the server function: who is a ghost, who it moved          (Bearer EDGE_SECRET)
 *   GET  /room/<id>/positions     the server function: every spot, to check for catches      (Bearer EDGE_SECRET)
 *
 * Devices send `{"m":[x,y]}` (pupils) or "ping"; the room sends pupils `{"s":PupilFrame}` and the projector
 * `{"p":{id:[x,y]}}` every 100 ms while something changed (at least every second). With the WebSocket Hibernation API
 * the object can sleep once every socket has closed and wake on the next one.
 */
import { EDGE_IDLE_MS, EDGE_TICK_MS, EdgeRoom, readTicket, type EdgeSync } from '../../../shared/classlive/edge';

// ---- The little of Cloudflare's types this needs (no extra package) ----
interface CfSocket extends WebSocket {
  serializeAttachment(v: unknown): void;
  deserializeAttachment(): unknown;
}
interface DurableObjectState {
  acceptWebSocket(ws: CfSocket, tags?: string[]): void;
  getWebSockets(tag?: string): CfSocket[];
  setWebSocketAutoResponse(pair: unknown): void;
  storage: { get<T>(key: string): Promise<T | undefined>; put(key: string, v: unknown): Promise<void> };
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>;
}
interface Stub { fetch(req: Request): Promise<Response> }
interface Namespace { idFromName(name: string): unknown; get(id: unknown, opts?: { locationHint?: string }): Stub }
interface Env { ROOMS: Namespace; EDGE_SECRET: string }
declare const WebSocketPair: { new (): { 0: CfSocket; 1: CfSocket } };
declare const WebSocketRequestResponsePair: { new (req: string, res: string): unknown };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const secretOk = (req: Request, env: Env) => !!env.EDGE_SECRET && req.headers.get('Authorization') === `Bearer ${env.EDGE_SECRET}`;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const m = /^\/room\/(\d{1,15})\/(ws|sync|positions)$/.exec(url.pathname);
    if (!m) return url.pathname === '/' ? new Response('Class Live rooms') : new Response('Not found', { status: 404 });
    const room = Number(m[1]);
    const what = m[2];
    const headers = new Headers({ 'x-room': String(room) });
    if (what === 'ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', { status: 426 });
      const t = await readTicket(env.EDGE_SECRET, url.searchParams.get('ticket') ?? '', room, Date.now());
      if (!t) return new Response('Bad ticket', { status: 403 });
      headers.set('x-who', t.u);
      headers.set('x-kind', t.k);
      headers.set('Upgrade', 'websocket');
    } else if (!secretOk(req, env)) return new Response('No', { status: 403 });
    // Rooms start near the school ("oc": Oceania).
    const stub = env.ROOMS.get(env.ROOMS.idFromName(`room-${room}`), { locationHint: 'oc' });
    return stub.fetch(new Request(`https://room/${what}`, { method: req.method, headers, body: what === 'sync' ? await req.text() : undefined }));
  },
};

type Tag = { who: string; kind: 'p' | 't'; x?: number; y?: number };

export class GhostRoom {
  private room = new EdgeRoom();
  private timer: ReturnType<typeof setInterval> | null = null;
  private sent = -1;
  private sentAt = 0;

  constructor(private ctx: DurableObjectState, _env: Env) {
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    // Woken from sleep: the last sync from storage, the spots from the sockets.
    void ctx.blockConcurrencyWhile(async () => {
      const s = await ctx.storage.get<EdgeSync>('sync');
      if (s) this.room.applySync({ ...s, places: [] }, Date.now());
      for (const ws of ctx.getWebSockets()) {
        const tag = ws.deserializeAttachment() as Tag | null;
        if (tag?.kind === 'p' && typeof tag.x === 'number' && typeof tag.y === 'number') this.room.spots.set(tag.who, { x: tag.x, y: tag.y, at: 0, placedAt: null });
      }
    });
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/positions') return json(this.room.positions());
    if (url.pathname === '/sync') {
      let s: EdgeSync;
      try {
        s = (await req.json()) as EdgeSync;
      } catch {
        return new Response('Bad sync', { status: 400 });
      }
      if (!s || typeof s.roles !== 'object' || !Array.isArray(s.places) || !Array.isArray(s.teleports)) return new Response('Bad sync', { status: 400 });
      this.room.applySync(s, Date.now());
      await this.ctx.storage.put('sync', { ...s, places: [] });
      this.wake();
      return json({ ok: true });
    }
    // A device's WebSocket.
    const who = req.headers.get('x-who') ?? '';
    const kind = req.headers.get('x-kind') === 't' ? 't' : 'p';
    if (!who) return new Response('No', { status: 403 });
    // One socket each: a reconnecting iPad replaces its old one.
    for (const old of this.ctx.getWebSockets(who)) try { old.close(4000, 'replaced'); } catch { /* already gone */ }
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server, [who, kind]);
    server.serializeAttachment({ who, kind } satisfies Tag);
    this.sent = -1;
    this.wake();
    return new Response(null, { status: 101, webSocket: pair[0] } as ResponseInit);
  }

  webSocketMessage(ws: CfSocket, msg: string | ArrayBuffer) {
    if (typeof msg !== 'string' || msg.length > 200) return;
    const tag = ws.deserializeAttachment() as Tag | null;
    if (!tag || tag.kind !== 'p') return;
    let m: unknown;
    try {
      m = (JSON.parse(msg) as { m?: unknown }).m;
    } catch {
      return;
    }
    if (!Array.isArray(m) || m.length !== 2) return;
    if (this.room.move(tag.who, m[0], m[1], Date.now())) {
      const p = this.room.spots.get(tag.who)!;
      ws.serializeAttachment({ ...tag, x: p.x, y: p.y } satisfies Tag);
    }
    this.wake();
  }

  webSocketClose(ws: CfSocket, code: number) {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch { /* already closed */ }
  }

  webSocketError(ws: CfSocket) {
    try { ws.close(1011, 'error'); } catch { /* already closed */ }
  }

  /**
   * Sends while there are sockets (at least every second: invisibility runs out on the clock); stops when the last one
   * closes, so the object can sleep. A message or a sync wakes it again.
   */
  private wake() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const sockets = this.ctx.getWebSockets();
      const now = Date.now();
      if (!sockets.length) {
        clearInterval(this.timer!);
        this.timer = null;
        return;
      }
      if (this.room.version === this.sent && now - this.sentAt < EDGE_IDLE_MS) return;
      this.sent = this.room.version;
      this.sentAt = now;
      let teacher: string | null = null;
      for (const ws of sockets) {
        const tag = ws.deserializeAttachment() as Tag | null;
        if (!tag) continue;
        try {
          if (tag.kind === 't') ws.send(teacher ??= JSON.stringify({ p: this.room.teacherView() }));
          else ws.send(JSON.stringify({ s: this.room.frameFor(tag.who, now) }));
        } catch {
          // A socket closing: the next frame skips it.
        }
      }
    }, EDGE_TICK_MS);
  }
}
