/**
 * Class Showdown's projector state (docs/SHOWDOWN-PLAN.md section 3): a pure reducer that turns feed events into
 * what the big screen draws (roster, hit bursts, banner, shield, dazed names...). No clocks inside: every time is the
 * event's `t` (ms from the round's start), and the screen compares them with its own round clock.
 * It never holds a question or a wrong answer (the feed has none).
 */
import type { Recap } from '../../../shared/showdown/awards';
import { bossInfo } from '../../../shared/showdown/bosses';
import type { FeedEvent, PlayerView, RoomView } from '../../../shared/showdown/server';
import type { Role, TeamId } from '../../../shared/showdown/types';
import type { Arena } from '../../../shared/showdown/types';
import { arenaWords } from './arenaWords';
import { ANNOUNCER } from './voiceLines';

/** What the projector needs from the announcer and sound (src/games/showdown/audio.ts implements it). */
export interface ShowdownSound {
  play(name: 'roar' | 'hit' | 'bighit' | 'clang' | 'crack' | 'chime' | 'drum' | 'cheer' | 'fanfare' | 'countdown' | 'whoosh'): void;
  say(line: string): void;
  muted: boolean;
  setMuted(b: boolean): void;
}

export interface RosterEntry { id: string; name: string; team: TeamId | null; role: Role; score: number }
export interface HitBurst { id: number; pupil: string; name: string; points: number; times: number; weakSpot: boolean; golden: boolean; team: TeamId | null; t: number; /** Gold Rush: the seam dug. */ seam?: number }
export interface Banner { text: string; kind: 'wind' | 'good' | 'bad' | 'info' | 'phase' | 'golden' | 'final' | 'turn'; until: number }
export interface Shield {
  needed: number;
  got: number;
  state: 'held' | 'broke' | null;
  /** Round time the wind-up ends (ms from the start). */
  endsAt: number;
  /** Round time it was held or broke. */
  resolvedAt: number;
  enraged: boolean;
  groups: Record<string, ShieldGroup>;
}
/** One shield group (the class, a team, or one pupil in solo) with its own held/broke moment. */
export interface ShieldGroup { needed: number; got: number; state?: 'held' | 'broke' | null; resolvedAt?: number }
/** A leaderboard climb worth a pop-up (solo). */
export interface BigMove { id: number; pupil: string; name: string; from: number; to: number; t: number }
/** Gold Rush: where a seam is and what it is (kept after it runs dry, so the crack-and-fade can play there). */
export interface SeamInfo { id: number; kind: 'gold' | 'gem' | 'rich'; x: number; y: number; size: number }
export interface DrySeam extends SeamInfo { t: number }
export interface Heal { id: number; text: string; t: number }

export interface ProjectorState {
  view: RoomView | null;
  names: Record<string, string>;
  roster: Record<string, RosterEntry>;
  /** Join order, newest last. */
  order: string[];
  bursts: HitBurst[];
  banner: Banner | null;
  shield: Shield | null;
  /** Pupil id -> round time the daze ends. */
  dazed: Record<string, number>;
  heals: Heal[];
  phase: 1 | 2 | 3;
  /** Round time of the last phase change (0 = none yet): the transform plays for a few seconds after it. */
  phaseAt: number;
  weakUntil: number;
  goldenUntil: number;
  /** Counts up on each golden event, so a screen can play the flash once per golden question. */
  goldenSeq: number;
  enrageUntil: number;
  final: boolean;
  finalUntil: number;
  /** Counts the starts, so the 3-2-1 plays once. */
  startSeq: number;
  /** Counts hits (flinch) and big hits (shake). */
  hitSeq: number;
  bigHitSeq: number;
  /** Round time the boss last healed. */
  healAt: number;
  beaten: boolean;
  timeUp: boolean;
  paused: boolean;
  ended: boolean;
  recap: Recap | null;
  /** 2 teams: counts the tug events (the bridge shakes on each) and who led at the last one. */
  tugSeq: number;
  tugAt: number;
  /** 4 teams: the boss turned on this team at this round time (roar), counted by `turnSeq`. */
  turn: { team: TeamId; at: number } | null;
  turnSeq: number;
  /** Solo: big climbs, bounty trackers (damage per pupil, last hit, longest streak so far). */
  moves: BigMove[];
  damage: Record<string, number>;
  lastHitter: string | null;
  bestStreak: { pupil: string; streak: number } | null;
  /** Each pupil's lowest place so far (a bigger number is lower): "best comeback" is how far they climbed from it. */
  worstRank: Record<string, number>;
  /** Counts "again" resets (the lobby plays the new boss's entrance), and which boss it brought. */
  againSeq: number;
  /** Gold Rush: every seam seen so far, and the ones that ran dry (with when). */
  seamInfo: Record<number, SeamInfo>;
  dry: DrySeam[];
  /** Sky Climb: the latest jumps (a climber leaps), and the last storm's blow-back (who slid down, and when). */
  jumps: { id: number; pupil: string; t: number }[];
  blown: { pupils: string[]; t: number } | null;
  /** Shrinking Island: splashes (the water reached someone), swims back, and when the last wave swept the beach. */
  splashes: { id: number; pupil: string; t: number }[];
  swims: { id: number; pupil: string; t: number }[];
  waveAt: number;
  /** Round time of the latest event. */
  t: number;
  seq: number;
}

export const MAX_BURSTS = 12;
export const BANNER_MS = 3200;

export type ProjectorAction =
  | { kind: 'feed'; event: FeedEvent }
  | { kind: 'view'; view: RoomView }
  | { kind: 'reset'; reply: { view: RoomView; players?: PlayerView[]; recap?: Recap } };

export function initialState(reply?: { view?: RoomView; players?: PlayerView[]; recap?: Recap | null }): ProjectorState {
  const view = reply?.view ?? null;
  const names: Record<string, string> = {};
  const roster: Record<string, RosterEntry> = {};
  const order: string[] = [];
  const dazed: Record<string, number> = {};
  for (const p of reply?.players ?? []) {
    names[p.player] = p.name;
    roster[p.player] = { id: p.player, name: p.name, team: p.team, role: p.role, score: p.score };
    order.push(p.player);
    if (p.dazedUntil > (view?.t ?? 0)) dazed[p.player] = p.dazedUntil;
  }
  let shield: Shield | null = null;
  if (view?.windUp) {
    const gs = Object.values(view.windUp.groups);
    const done = gs.length > 0 && gs.every((g) => g.done) ? (gs.some((g) => g.done === 'broke') ? 'broke' : 'held') : null;
    shield = {
      needed: sum(gs.map((g) => g.needed)), got: sum(gs.map((g) => g.got)), state: done, endsAt: view.windUp.endsAt, resolvedAt: done ? view.t : 0, enraged: view.windUp.enraged,
      groups: Object.fromEntries(Object.entries(view.windUp.groups).map(([k, g]) => [k, { needed: g.needed, got: g.got, state: g.done, resolvedAt: g.done ? view.t : 0 }])),
    };
  }
  return {
    view, names, roster, order, bursts: [], banner: null, shield, dazed, heals: [],
    phase: view?.boss.phase ?? 1, phaseAt: 0,
    weakUntil: view?.weakSpotUntil ?? 0, goldenUntil: view?.goldenUntil ?? 0, goldenSeq: 0, enrageUntil: view?.enrageUntil ?? 0,
    final: view?.finalStarted ?? false, finalUntil: 0, startSeq: 0, hitSeq: 0, bigHitSeq: 0, healAt: 0,
    beaten: view?.result === 'beaten', timeUp: view?.result === 'time', paused: view?.pausedAt != null, ended: view?.state === 'over',
    recap: reply?.recap ?? null, tugSeq: 0, tugAt: 0, turn: null, turnSeq: 0, moves: [], damage: {}, lastHitter: null, bestStreak: null, worstRank: {}, againSeq: 0, seamInfo: seamsOf(view), dry: [], jumps: [], blown: null, splashes: [], swims: [], waveAt: 0, t: view?.t ?? 0, seq: 0,
  };
}

function seamsOf(view: RoomView | null | undefined, into: Record<number, SeamInfo> = {}): Record<number, SeamInfo> {
  const out = { ...into };
  for (const x of view?.seams ?? []) out[x.id] = { id: x.id, kind: x.kind, x: x.x, y: x.y, size: x.size };
  return out;
}
export const isGoldRush = (v: Pick<RoomView, 'arena'> | null | undefined) => v?.arena === 'goldrush';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const TEAM_NAME: Record<TeamId, string> = { red: 'RED', blue: 'BLUE', gold: 'GOLD', green: 'GREEN' };
const teamName = (g: string): string | null => (g in TEAM_NAME ? TEAM_NAME[g as TeamId] : null);

/** A pupil's place (1 = top) by score, ties broken by who joined first; 0 if unknown. */
export function rankOf(s: Pick<ProjectorState, 'roster' | 'order'>, id: string): number {
  const me = s.roster[id];
  if (!me) return 0;
  let r = 1;
  for (const k of s.order) {
    const o = s.roster[k];
    if (k !== id && (o.score > me.score || (o.score === me.score && s.order.indexOf(k) < s.order.indexOf(id)))) r++;
  }
  return r;
}
/** Notes everyone's current place as a possible lowest place. */
function noteRanks(s: ProjectorState): Record<string, number> {
  const worst = { ...s.worstRank };
  for (const id of s.order) worst[id] = Math.max(worst[id] ?? 0, rankOf(s, id));
  return worst;
}

/** The pupil who climbed the most places over the round (at least 2), worked out from the places seen so far. */
export function bestComeback(s: Pick<ProjectorState, 'roster' | 'order' | 'worstRank'>): { pupil: string; places: number } | null {
  let best: { pupil: string; places: number } | null = null;
  for (const id of s.order) {
    const places = (s.worstRank[id] ?? 0) - rankOf(s, id);
    if (places >= 2 && (!best || places > best.places)) best = { pupil: id, places };
  }
  return best;
}

/** The same room and pupils, ready for the next boss: scores and the round's drawing state are cleared. */
function afterAgain(s: ProjectorState): ProjectorState {
  const fresh = initialState();
  const roster = Object.fromEntries(Object.entries(s.roster).map(([k, r]) => [k, { ...r, score: 0 }]));
  return { ...fresh, view: s.view, names: s.names, roster, order: s.order, startSeq: s.startSeq, againSeq: s.againSeq + 1 };
}

export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** A name for an id: the feed's own names first, then everyone we have met. */
export function nameOf(s: ProjectorState, id: string | null | undefined, e?: FeedEvent): string {
  if (!id) return 'Someone';
  return e?.names?.[id] ?? s.names[id] ?? s.roster[id]?.name ?? 'Someone';
}

export function projectorReduce(s: ProjectorState, event: FeedEvent): ProjectorState {
  const names = event.names ? { ...s.names, ...event.names } : s.names;
  let n: ProjectorState = { ...s, names, t: Math.max(s.t, event.t) };
  const nm = (id: string | null | undefined) => nameOf(n, id, event);
  const banner = (text: string, kind: Banner['kind'], ms = BANNER_MS): ProjectorState => ({ ...n, banner: { text, kind, until: event.t + ms } });
  const W = arenaWords(n.view?.arena);
  const rosterWith = (id: string, patch: Partial<RosterEntry>): ProjectorState => {
    const old = n.roster[id] ?? { id, name: nm(id), team: null, role: 'striker' as Role, score: 0 };
    return { ...n, roster: { ...n.roster, [id]: { ...old, ...patch } }, order: n.order.includes(id) ? n.order : [...n.order, id] };
  };

  switch (event.type) {
    case 'join':
      return rosterWith(event.pupil, { name: nm(event.pupil), team: event.team });
    case 'team_move':
      return rosterWith(event.pupil, { team: event.team });
    case 'role':
      return rosterWith(event.pupil, { role: event.role });
    case 'start':
      return { ...n, startSeq: n.startSeq + 1, ended: false };
    case 'hit': {
      const burst: HitBurst = { id: n.seq + 1, pupil: event.pupil, name: nm(event.pupil), points: event.points, times: event.times, weakSpot: event.weakSpot, golden: event.golden, team: event.team, t: event.t, seam: event.seam };
      const old = n.roster[event.pupil];
      const worstBefore = noteRanks(n);
      const before = rankOf(n, event.pupil);
      const withScore = rosterWith(event.pupil, { score: (old?.score ?? 0) + event.points, role: event.role, team: event.team ?? old?.team ?? null });
      const after = rankOf(withScore, event.pupil);
      const worstRank = noteRanks({ ...withScore, worstRank: worstBefore });
      const climbed = n.view?.mode === 'solo' && before > 0 && before - after >= 3 && after <= 10;
      const best = n.bestStreak;
      return {
        ...withScore, seq: n.seq + 1, worstRank,
        moves: climbed ? [...n.moves, { id: n.seq + 1, pupil: event.pupil, name: nm(event.pupil), from: before, to: after, t: event.t }].slice(-4) : n.moves,
        damage: { ...n.damage, [event.pupil]: (n.damage[event.pupil] ?? 0) + event.damage },
        lastHitter: event.pupil,
        bestStreak: !best || event.streak > best.streak ? { pupil: event.pupil, streak: event.streak } : best, bursts: [...n.bursts, burst].slice(-MAX_BURSTS), hitSeq: n.hitSeq + 1, bigHitSeq: n.bigHitSeq + (event.times >= 2 ? 1 : 0),
      };
    }
    case 'streak':
      return event.streak >= 5 ? banner(`${nm(event.pupil)}: ${event.streak} in a row!`, 'good', 2200) : n;
    case 'lucky_chest':
      return rosterWith(event.pupil, { score: (n.roster[event.pupil]?.score ?? 0) + event.points });
    case 'revive': {
      const dazed = { ...n.dazed };
      delete dazed[event.woke];
      const text = `${nm(event.pupil)} woke up ${nm(event.woke)}!`;
      return { ...n, dazed, seq: n.seq + 1, heals: [...n.heals, { id: n.seq + 1, text, t: event.t }].slice(-4) };
    }
    case 'wind_up': {
      const groups = Object.fromEntries(event.groups.map((g) => [g.group, { needed: g.needed, got: 0 }]));
      const shield: Shield = { needed: sum(event.groups.map((g) => g.needed)), got: 0, state: null, endsAt: event.endsAt, resolvedAt: 0, enraged: event.enraged, groups };
      return { ...n, shield, banner: { text: W.windBanner, kind: 'wind', until: event.endsAt } };
    }
    case 'shield_progress': {
      if (!n.shield) return n;
      const groups = { ...n.shield.groups, [event.group]: { ...n.shield.groups[event.group], needed: event.needed, got: event.got } };
      return { ...n, shield: { ...n.shield, groups, needed: sum(Object.values(groups).map((g) => g.needed)), got: sum(Object.values(groups).map((g) => g.got)) } };
    }
    case 'shield_held': {
      const sh = n.shield ?? { needed: 0, got: 0, endsAt: event.t, enraged: false, groups: {}, state: null, resolvedAt: 0 };
      const helped = event.guards.length ? ` ${event.guards.length === 1 ? nm(event.guards[0]) : 'The Guards'} led the way!` : '';
      const tm = teamName(event.group);
      const g = sh.groups[event.group] ?? { needed: 0, got: 0 };
      const groups = { ...sh.groups, [event.group]: { ...g, got: Math.max(g.got, g.needed), state: 'held' as const, resolvedAt: event.t } };
      return { ...n, shield: { ...sh, groups, got: Math.max(sh.got, sh.needed), state: 'held', resolvedAt: event.t }, banner: { text: `${W.heldBanner(tm)}${helped}`, kind: 'good', until: event.t + BANNER_MS } };
    }
    case 'shield_broke': {
      const sh = n.shield ?? { needed: 0, got: 0, endsAt: event.t, enraged: false, groups: {}, state: null, resolvedAt: 0 };
      const dazed = { ...n.dazed };
      for (const id of event.dazed) dazed[id] = event.dazedUntil;
      const tm = teamName(event.group);
      const g = sh.groups[event.group] ?? { needed: 0, got: 0 };
      const groups = { ...sh.groups, [event.group]: { ...g, state: 'broke' as const, resolvedAt: event.t } };
      return { ...n, dazed, shield: { ...sh, groups, state: 'broke', resolvedAt: event.t }, banner: { text: W.brokeBanner(tm), kind: 'bad', until: event.t + BANNER_MS } };
    }
    case 'boss_heals':
      return { ...n, healAt: event.t };
    case 'weak_spot':
      return { ...banner(W.weakBanner, 'good', 2600), weakUntil: event.endsAt };
    case 'weak_spot_end':
      return { ...n, weakUntil: 0 };
    case 'phase':
      return { ...n, phase: event.phase, phaseAt: event.t, banner: { text: W.phaseBanner(event.phase === 3 ? 3 : 2), kind: 'phase', until: event.t + 3600 } };
    case 'golden':
      return { ...n, goldenUntil: event.endsAt, goldenSeq: n.goldenSeq + 1, banner: { text: 'GOLDEN QUESTION! Triple points!', kind: 'golden', until: event.t + 3600 } };
    case 'golden_end':
      return { ...n, goldenUntil: 0 };
    case 'final':
      return { ...n, final: true, finalUntil: event.endsAt, banner: { text: 'THIRTY SECONDS!', kind: 'final', until: event.t + 3000 } };
    case 'enrage':
      return { ...banner(W.enrageBanner, 'wind', 2800), enrageUntil: event.endsAt };
    case 'enrage_end':
      return { ...n, enrageUntil: 0 };
    case 'tug':
      return { ...n, tugSeq: n.tugSeq + 1, tugAt: event.t };
    case 'boss_turns':
      return { ...n, turn: { team: event.team, at: event.t }, turnSeq: n.turnSeq + 1, banner: { text: `The boss turns on ${TEAM_NAME[event.team]}!`, kind: 'turn', until: event.t + 2600 } };
    case 'boss_beaten':
      return { ...n, beaten: true, shield: null, banner: { text: W.beatenBanner, kind: 'good', until: event.t + 6000 } };
    case 'time_up':
      return { ...n, timeUp: true, shield: null, banner: { text: "TIME'S UP!", kind: 'bad', until: event.t + 6000 } };
    case 'recap':
      return { ...n, recap: event.recap, ended: true, beaten: event.recap.result === 'beaten', timeUp: event.recap.result === 'time' };
    case 'seam_new':
      return { ...n, seamInfo: { ...n.seamInfo, [event.seam]: { id: event.seam, kind: event.kind, x: event.x, y: event.y, size: event.size } } };
    case 'seam_dry': {
      const info = n.seamInfo[event.seam];
      return info ? { ...n, dry: [...n.dry, { ...info, t: event.t }].slice(-6) } : n;
    }
    case 'jump':
      return { ...n, seq: n.seq + 1, jumps: [...n.jumps, { id: n.seq + 1, pupil: event.pupil, t: event.t }].slice(-12) };
    case 'blown_back': {
      const damage = { ...n.damage };
      for (const id of event.pupils) damage[id] = Math.max(0, (damage[id] ?? 0) - event.amount);
      return { ...n, damage, blown: { pupils: event.pupils, t: event.t }, banner: { text: `WHOOSH! ${event.pupils.length === 1 ? 'A climber was' : `${event.pupils.length} climbers were`} blown back down!`, kind: 'bad', until: event.t + BANNER_MS } };
    }
    case 'washed_up':
      return {
        ...n, seq: n.seq + event.pupils.length, splashes: [...n.splashes, ...event.pupils.map((pupil, i) => ({ id: n.seq + 1 + i, pupil, t: event.t }))].slice(-16),
        banner: { text: `SPLASH! ${event.pupils.length === 1 ? 'Someone is' : `${event.pupils.length} are`} on the rocks. Answer to swim back!`, kind: 'info', until: event.t + BANNER_MS },
      };
    case 'swam_back':
      return { ...n, seq: n.seq + 1, swims: [...n.swims, { id: n.seq + 1, pupil: event.pupil, t: event.t }].slice(-8) };
    case 'wave':
      return { ...n, waveAt: event.t };
    case 'again':
      return afterAgain(n);
    case 'pause':
      return { ...n, paused: true };
    case 'resume':
      return { ...n, paused: false };
    case 'ended':
      return { ...n, ended: true };
    default:
      return n;
  }
}

/** The reducer the screen uses: feed events, the room row as it changes, and a full reset from a `view` reply. */
export function projectorAct(s: ProjectorState, a: ProjectorAction): ProjectorState {
  if (a.kind === 'feed') return projectorReduce(s, a.event);
  if (a.kind === 'reset') return initialState(a.reply);
  const v = a.view;
  // A second screen that sees the room go back to a lobby after a recap starts over too.
  if (s.ended && v.state === 'lobby') return { ...afterAgain(s), view: v };
  return {
    ...s, view: v, seamInfo: seamsOf(v, s.seamInfo), phase: v.boss.phase, weakUntil: v.weakSpotUntil, goldenUntil: v.goldenUntil, enrageUntil: v.enrageUntil,
    final: s.final || v.finalStarted, paused: v.pausedAt != null, ended: s.ended || v.state === 'over',
    beaten: s.beaten || v.result === 'beaten', timeUp: s.timeUp || v.result === 'time',
  };
}

/** What the announcer and sound do for an event (the screen throttles hit sounds). */
export function soundFor(e: FeedEvent, arena: Arena | null | undefined = 'boss'): { play?: Parameters<ShowdownSound['play']>[0]; say?: string } {
  if (arena && arena !== 'boss') {
    const L = arenaWords(arena).lines;
    switch (e.type) {
      case 'wind_up': return { play: 'drum', say: L.windUp };
      case 'shield_held': return { play: 'clang', say: L.held };
      case 'shield_broke': return { play: 'crack', say: L.broke };
      case 'weak_spot': return { play: 'whoosh', say: L.weak };
      case 'phase': return { play: 'roar', say: L.phase };
      case 'boss_beaten': return { play: 'cheer', say: L.done };
      case 'again': return { play: 'roar', say: L.start ?? undefined };
      case 'hit': return { play: e.times >= 2 || e.golden ? 'bighit' : 'hit' };
      case 'jump': return { play: 'whoosh' };
      case 'blown_back': return { play: 'whoosh' };
      case 'washed_up': return { play: 'whoosh' };
      case 'swam_back': return { play: 'chime' };
      case 'wave': return { play: 'crack' };
      default: break;
    }
  }
  switch (e.type) {
    case 'start': return { play: 'countdown', say: ANNOUNCER.fight };
    case 'hit': return { play: e.times >= 2 || e.golden ? 'bighit' : 'hit' };
    case 'wind_up': return { play: 'drum', say: ANNOUNCER.windUp };
    case 'seam_dry': return { play: 'crack' };
    case 'seam_new': return { play: 'chime' };
    case 'shield_held': return { play: 'clang', say: ANNOUNCER.held };
    case 'shield_broke': return { play: 'crack', say: ANNOUNCER.broke };
    case 'revive': return { play: 'chime' };
    case 'weak_spot': return { play: 'whoosh', say: ANNOUNCER.weakSpot };
    case 'golden': return { play: 'chime', say: ANNOUNCER.golden };
    case 'phase': return { play: 'roar', say: ANNOUNCER.phase };
    case 'boss_turns': return { play: 'roar' };
    case 'enrage': return { play: 'roar' };
    case 'final': return { play: 'drum', say: ANNOUNCER.thirty };
    case 'boss_beaten': return { play: 'cheer', say: ANNOUNCER.beaten };
    case 'time_up': return { say: ANNOUNCER.timeUp };
    case 'again': return { play: 'roar', say: bossInfo(e.boss).roar };
    case 'recap': return e.recap.result === 'beaten' ? { play: 'fanfare' } : { say: ANNOUNCER.soClose };
    default: return {};
  }
}

/** Kid words for each award kind. */
export const AWARD_WORDS: Record<string, string> = {
  top_score: 'Top scorer', last_hit: 'Last hit', longest_streak: 'Longest streak', most_damage: 'Biggest hitter', best_comeback: 'Best comeback',
  shield_wall: 'Shield wall', best_healer: 'Best healer', golden_moment: 'Golden moment', most_careful: 'Most careful', hard_worker: 'Hard worker',
};
export const TEAM_WORDS: Record<TeamId, string> = { red: 'Red team', blue: 'Blue team', gold: 'Gold team', green: 'Green team' };
