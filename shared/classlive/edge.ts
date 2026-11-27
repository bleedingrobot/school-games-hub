/**
 * Class Live on Cloudflare (docs/plans/classlive-edge/PLAN.md), a pilot for James's own Ghost Tag games only. Pupils'
 * spots go from the iPad to one Cloudflare Durable Object per room over a WebSocket, not to the database: the crash on
 * 26 Nov 2026 was ~75 spot saves a second from one class. Everything else (joining, questions, answers, catches, points,
 * trophies) still runs in the `classlive` server function and the database, exactly as before.
 *
 *   - The server function opens a pilot room with `session.edge`, sends the room what it needs after every save
 *     (`EdgeSync`: who is a ghost, invisible, frozen, lit; the teleports; who the server moved) and reads the spots back
 *     from it when it checks for catches.
 *   - A device asks the server function for a ticket (`action: 'edge'`), signed with a secret only the server function and
 *     the Worker know, and connects with it. So the room trusts Supabase's sign-in without asking Supabase anything.
 *   - The room sends every device what it may see 10 times a second (`pupilView`, `teacherView`), the same as
 *     classlive_ghost_move answered.
 *
 * Pure: the Worker (cloudflare/classlive-edge), the server function and the tests share it.
 */
import type { Positions, Spot, Teleport } from './corners';
import { LANTERN_R, MAX_SPEED, type GhostGame } from './ghost';

/**
 * Teachers who get the "Run it on" choice on the Ghost Tag card, to compare Cloudflare with the school server
 * (James, 26 Nov 2026 NZ: "with my log on only").
 */
export const EDGE_TEACHERS: readonly string[] = ['e5dfc120-92de-4a09-a3fa-acc400dd4990'];

/**
 * Every teacher's Ghost Tag runs on Cloudflare (James, 27 Nov 2026 NZ, after a 30-pupil test: "Move every teacher now").
 * Set to false to put everyone but EDGE_TEACHERS back on the school server.
 */
export const EDGE_EVERYONE = true;

/** Whether this teacher's new game of this activity runs its positions on Cloudflare. */
export function edgeFor(teacher: string, activity: string): boolean {
  return activity === 'ghost' && (EDGE_EVERYONE || EDGE_TEACHERS.includes(teacher));
}

/** How often the room sends devices the spots, and how often a pad sends its own (ms). */
export const EDGE_TICK_MS = 100;
export const EDGE_SEND_MS = 100;
/** A pad that hasn't moved still says where it is this often (ms). */
export const EDGE_IDLE_MS = 1000;
/** Moves closer together than this are dropped (a pad sends every 100 ms). */
const MIN_GAP_MS = 60;
/** Just after the server moved someone, a far move is their device not yet knowing: dropped, not dragged back. */
const PLACE_GRACE_MS = 1500;
/** Tickets last a school day. */
export const TICKET_MS = 6 * 3600_000;

/** [ghost 1/0, hideTo, frozenTo, lanternTo]: session times (ms since the start). */
export type EdgeRole = [number, number, number, number];

/** What the server function sends the room after each save. */
export interface EdgeSync {
  room: number;
  /** ms since 1970 the session started, or null in the lobby. */
  startedAt: number | null;
  live: boolean;
  maxSpeed: number;
  /** The map's width (height 1); 1 when missing. */
  width?: number;
  teleports: Teleport[];
  /** Every player in the room (only these may move). */
  roles: Record<string, EdgeRole>;
  /** Players the server just moved (a new round). */
  places: { player: string; x: number; y: number }[];
}

/** What a pupil's device gets: like classlive_ghost_move's answer. Kind 0 pupil, 1 ghost, 2 frozen ghost, 3 lit by my lantern. */
export interface PupilFrame { me: { ghost: boolean }; spots: [number, number, 0 | 1 | 2 | 3][] }

/** The server function's side of the room (entry.ts makes it when the secrets are set). */
export interface EdgeServices {
  /** May this teacher's game of this kind run on Cloudflare? */
  allowed(teacher: string, activity: string): boolean;
  positions(room: number): Promise<Positions | 'busy'>;
  sync(room: number, sync: EdgeSync): Promise<void>;
  ticket(room: number, who: string, kind: 'p' | 't'): Promise<{ url: string; ticket: string }>;
}

// ---- Tickets ----

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmac(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(text))));
}

export interface Ticket { r: number; u: string; k: 'p' | 't'; e: number }

export async function makeTicket(secret: string, t: Ticket): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(t)));
  return `${body}.${await hmac(secret, body)}`;
}

/** The ticket's holder, if it is ours, for this room and not expired. */
export async function readTicket(secret: string, ticket: string, room: number, now: number): Promise<Ticket | null> {
  const [body, sig, extra] = ticket.split('.');
  if (!body || !sig || extra !== undefined || !secret) return null;
  if ((await hmac(secret, body)) !== sig) return null;
  try {
    const t = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Ticket;
    if (t.r !== room || typeof t.u !== 'string' || (t.k !== 'p' && t.k !== 't') || !(t.e > now)) return null;
    return t;
  } catch {
    return null;
  }
}

// ---- The room ----

/** `placedAt`: when the server last moved them, or null. */
interface Kept extends Spot { at: number; placedAt: number | null }

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** One room's spots, in memory (the Durable Object holds one). */
export class EdgeRoom {
  spots = new Map<string, Kept>();
  sync: EdgeSync | null = null;
  /** Bumped on every change, so the room only sends when something moved. */
  version = 0;

  applySync(s: EdgeSync, now: number) {
    this.sync = s;
    for (const p of s.places) if (finite(p.x) && finite(p.y)) this.spots.set(p.player, { x: p.x, y: p.y, at: now, placedAt: now });
    for (const id of this.spots.keys()) if (!s.roles[id]) this.spots.delete(id);
    this.version++;
  }

  /** A pupil's device says where it is: kept within the speed limit, as classlive_move does. True if kept. */
  move(id: string, x: unknown, y: unknown, now: number): boolean {
    const s = this.sync;
    if (!s || !s.live || !s.roles[id] || !finite(x) || !finite(y)) return false;
    let nx = Math.min(s.width ?? 1, Math.max(0, x));
    let ny = Math.min(1, Math.max(0, y));
    const prev = this.spots.get(id);
    if (prev) {
      const dt = now - prev.at;
      if (dt < MIN_GAP_MS) return false;
      const most = Math.min(s.maxSpeed, MAX_SPEED) * Math.min(5, Math.max(0, dt) / 1000) + 0.05;
      const gap = Math.hypot(nx - prev.x, ny - prev.y);
      if (gap > most) {
        if (prev.placedAt !== null && now - prev.placedAt < PLACE_GRACE_MS) return false;
        const through = s.teleports.some((tp) =>
          (Math.hypot(nx - tp.a.x, ny - tp.a.y) < 0.12 && Math.hypot(prev.x - tp.b.x, prev.y - tp.b.y) < 0.15) ||
          (Math.hypot(nx - tp.b.x, ny - tp.b.y) < 0.12 && Math.hypot(prev.x - tp.a.x, prev.y - tp.a.y) < 0.15));
        if (!through) {
          nx = prev.x + ((nx - prev.x) * most) / gap;
          ny = prev.y + ((ny - prev.y) * most) / gap;
        }
      }
    }
    this.spots.set(id, { x: nx, y: ny, at: now, placedAt: prev?.placedAt ?? null });
    this.version++;
    return true;
  }

  positions(): Positions {
    return Object.fromEntries([...this.spots].map(([id, p]) => [id, { x: p.x, y: p.y }]));
  }

  /** The projector's frame: everyone's spot by id (teachers only). */
  teacherView(): Record<string, [number, number]> {
    return Object.fromEntries([...this.spots].map(([id, p]) => [id, [r4(p.x), r4(p.y)]]));
  }

  /** What one pupil may see: no names or ids; the invisible left out unless my lantern is lit and they're near. */
  pupilView(me: string, now: number): PupilFrame {
    const s = this.sync;
    const t = s?.startedAt == null ? 0 : now - s.startedAt;
    const mine = s?.roles[me];
    const ghost = !!mine && mine[0] === 1;
    const lantern = ghost && mine![3] > t;
    const here = this.spots.get(me);
    const spots: PupilFrame['spots'] = [];
    for (const [id, p] of this.spots) {
      if (id === me) continue;
      const role = s?.roles[id];
      if (!role) continue;
      let kind: 0 | 1 | 2 | 3;
      if (role[0] === 1) kind = role[2] > t ? 2 : 1;
      else if (role[1] > t) {
        if (!lantern || !here || Math.hypot(p.x - here.x, p.y - here.y) >= LANTERN_R) continue;
        kind = 3;
      } else kind = 0;
      spots.push([r4(p.x), r4(p.y), kind]);
    }
    return { me: { ghost }, spots };
  }
}

/** The sync for a Ghost Tag session (server.ts calls this after each save of a pilot room). */
export function ghostSync(room: number, s: { state: string; order: string[]; game: { kind: string } }, startedAt: number | null, places: EdgeSync['places']): EdgeSync {
  const g = s.game.kind === 'ghost' ? (s.game as GhostGame) : null;
  const mine = g?.mine ?? {};
  const roles: Record<string, EdgeRole> = {};
  for (const id of s.order) {
    const m = mine[id];
    roles[id] = m ? [m.ghost ? 1 : 0, m.hideTo, m.frozenTo, m.lanternTo] : [0, 0, 0, 0];
  }
  return { room, startedAt, live: s.state === 'live', maxSpeed: MAX_SPEED, width: g?.w ?? 1, teleports: g?.round?.teleports ?? [], roles, places };
}
