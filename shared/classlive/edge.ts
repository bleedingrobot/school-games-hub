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
import type { CrewGame } from './crew';
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

/** Games whose positions run on Cloudflare for every teacher. */
export const EDGE_LIVE: readonly string[] = ['ghost'];
/**
 * Games on trial: Cloudflare for EDGE_TEACHERS only (James, 27 Nov 2026 NZ: "might as well" move the other moving games,
 * class-testing each first). A game joins once its iPad and big screen talk to Cloudflare (useEdgeLink).
 */
export const EDGE_TRIAL: readonly string[] = [];

/** Whether this teacher's new game of this activity runs its positions on Cloudflare. */
export function edgeFor(teacher: string, activity: string): boolean {
  if (EDGE_LIVE.includes(activity)) return EDGE_EVERYONE || EDGE_TEACHERS.includes(teacher);
  return EDGE_TRIAL.includes(activity) && EDGE_TEACHERS.includes(teacher);
}

/** Whether this teacher sees the "Run it on" choice for this game, to compare the two. */
export const edgeChoice = (teacher: string, activity: string) => EDGE_TEACHERS.includes(teacher) && edgeFor(teacher, activity);

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

/**
 * What each pupil's device is shown: `ghost` (Ghost Tag: kinds, no invisible pupils), `all` (every spot, theirs too, as
 * classlive_move answers: Four Corners, Shark Bay, Floor is Lava, Musical Thrones, Colour Clash) or `crew` (Glitches: names,
 * colours, other Glitches; only near spots while the lights are out, as classlive_crew_move answers).
 */
export type EdgeView = 'ghost' | 'all' | 'crew';

/** Glitches: [glitch 1/0, drone 1/0, cameraTo, factory name, colour]. */
export type CrewRole = [number, number, number, string, number];

/** Glitches' lights-out reach (as classlive_crew_move). */
export const CREW_DARK_R = 0.2;

/** What the server function sends the room after each save. */
export interface EdgeSync {
  room: number;
  /** Missing: `ghost` (a room synced before 27 Nov 2026). */
  view?: EdgeView;
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
  /** Glitches: each player's role, and when the lights come back (session ms). */
  crew?: { lightsTo: number; roles: Record<string, CrewRole> };
}

/** What a pupil's device gets: like classlive_ghost_move's answer. Kind 0 pupil, 1 ghost, 2 frozen ghost, 3 lit by my lantern. */
export interface PupilFrame { me: { ghost: boolean }; spots: [number, number, 0 | 1 | 2 | 3][] }
/** `all`: every spot, mine too (classlive_move's answer). */
export interface AllFrame { spots: [number, number][] }
/** `crew`: classlive_crew_move's answer. Kind 0 crew, 1 drone, 2 another Glitch (shown to Glitches only). */
export interface CrewFrame { me: { glitch: boolean; drone: boolean }; spots: [number, number, 0 | 1 | 2, string, number][] }

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

  /** What one pupil's device is sent, for this room's game. */
  frameFor(me: string, now: number): PupilFrame | AllFrame | CrewFrame {
    const view = this.sync?.view ?? 'ghost';
    if (view === 'all') return { spots: [...this.spots.values()].map((p) => [r4(p.x), r4(p.y)]) };
    if (view === 'crew') return this.crewView(me, now);
    return this.pupilView(me, now);
  }

  /** Glitches: names and colours; Glitches see each other; while the lights are out the crew see only who is near. */
  crewView(me: string, now: number): CrewFrame {
    const s = this.sync;
    const t = s?.startedAt == null ? 0 : now - s.startedAt;
    const roles = s?.crew?.roles ?? {};
    const mine = roles[me];
    const glitch = !!mine && mine[0] === 1;
    const drone = !!mine && mine[1] === 1;
    const dark = (s?.crew?.lightsTo ?? 0) > t && !glitch && !drone && !(mine && mine[2] > t);
    const here = this.spots.get(me);
    const spots: CrewFrame['spots'] = [];
    for (const [id, p] of this.spots) {
      if (id === me) continue;
      const role = roles[id];
      if (!role) continue;
      if (dark && (!here || Math.hypot(p.x - here.x, p.y - here.y) > CREW_DARK_R)) continue;
      const kind: 0 | 1 | 2 = role[1] === 1 ? 1 : glitch && role[0] === 1 ? 2 : 0;
      spots.push([r4(p.x), r4(p.y), kind, role[3], role[4]]);
    }
    return { me: { glitch, drone }, spots };
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

type SyncSession = { state: string; order: string[]; game: { kind: string }; players?: Record<string, { name?: string | null; colour?: number }> };

/** The sync for a Ghost Tag session. */
export function ghostSync(room: number, s: SyncSession, startedAt: number | null, places: EdgeSync['places']): EdgeSync {
  const g = s.game.kind === 'ghost' ? (s.game as GhostGame) : null;
  const mine = g?.mine ?? {};
  const roles: Record<string, EdgeRole> = {};
  for (const id of s.order) {
    const m = mine[id];
    roles[id] = m ? [m.ghost ? 1 : 0, m.hideTo, m.frozenTo, m.lanternTo] : [0, 0, 0, 0];
  }
  return { room, view: 'ghost', startedAt, live: s.state === 'live', maxSpeed: MAX_SPEED, width: g?.w ?? 1, teleports: g?.round?.teleports ?? [], roles, places };
}

/** A first name for the crew view when a pupil has no factory name yet (as classlive_crew_move). */
const firstName = (name: string | null | undefined) => (name ?? '').trim().split(' ')[0].slice(0, 20);

/** The sync for any moving game's session (server.ts calls this after each save of a Cloudflare room). */
export function edgeSync(room: number, s: SyncSession, startedAt: number | null, places: EdgeSync['places']): EdgeSync {
  if (s.game.kind === 'ghost') return ghostSync(room, s, startedAt, places);
  const g = s.game as { kind: string; w?: number; round?: { teleports?: Teleport[] } | null };
  const roles: Record<string, EdgeRole> = Object.fromEntries(s.order.map((id) => [id, [0, 0, 0, 0] as EdgeRole]));
  const base = { room, startedAt, live: s.state === 'live', maxSpeed: 0.6, width: g.w ?? 1, teleports: g.round?.teleports ?? [], roles, places };
  if (s.game.kind !== 'crew') return { ...base, view: 'all' };
  const c = s.game as CrewGame;
  const crew: Record<string, CrewRole> = {};
  for (const id of s.order) {
    const m = c.mine[id];
    if (m) crew[id] = [m.glitch ? 1 : 0, m.drone ? 1 : 0, m.cameraTo, m.nick ?? firstName(s.players?.[id]?.name), s.players?.[id]?.colour ?? 0];
  }
  return { ...base, view: 'crew', crew: { lightsTo: c.round?.lightsTo ?? 0, roles: crew } };
}
