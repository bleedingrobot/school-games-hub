/**
 * Class Showdown's projector state (docs/SHOWDOWN-PLAN.md section 3): a pure reducer that turns feed events into
 * what the big screen draws (roster, hit bursts, banner, shield, dazed names...). No clocks inside: every time is the
 * event's `t` (ms from the round's start), and the screen compares them with its own round clock.
 * It never holds a question or a wrong answer (the feed has none).
 */
import type { Recap } from '../../../shared/showdown/awards';
import type { FeedEvent, PlayerView, RoomView } from '../../../shared/showdown/server';
import type { Role, TeamId } from '../../../shared/showdown/types';

/** What the projector needs from the announcer and sound (src/games/showdown/audio.ts implements it). */
export interface ShowdownSound {
  play(name: 'roar' | 'hit' | 'bighit' | 'clang' | 'crack' | 'chime' | 'drum' | 'cheer' | 'fanfare' | 'countdown' | 'whoosh'): void;
  say(line: string): void;
  muted: boolean;
  setMuted(b: boolean): void;
}

export interface RosterEntry { id: string; name: string; team: TeamId | null; role: Role; score: number }
export interface HitBurst { id: number; pupil: string; name: string; points: number; times: number; weakSpot: boolean; golden: boolean; team: TeamId | null; t: number }
export interface Banner { text: string; kind: 'wind' | 'good' | 'bad' | 'info' | 'phase' | 'golden' | 'final'; until: number }
export interface Shield {
  needed: number;
  got: number;
  state: 'held' | 'broke' | null;
  /** Round time the wind-up ends (ms from the start). */
  endsAt: number;
  /** Round time it was held or broke. */
  resolvedAt: number;
  enraged: boolean;
  groups: Record<string, { needed: number; got: number }>;
}
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
      groups: Object.fromEntries(Object.entries(view.windUp.groups).map(([k, g]) => [k, { needed: g.needed, got: g.got }])),
    };
  }
  return {
    view, names, roster, order, bursts: [], banner: null, shield, dazed, heals: [],
    phase: view?.boss.phase ?? 1, phaseAt: 0,
    weakUntil: view?.weakSpotUntil ?? 0, goldenUntil: view?.goldenUntil ?? 0, goldenSeq: 0, enrageUntil: view?.enrageUntil ?? 0,
    final: view?.finalStarted ?? false, finalUntil: 0, startSeq: 0, hitSeq: 0, bigHitSeq: 0, healAt: 0,
    beaten: view?.result === 'beaten', timeUp: view?.result === 'time', paused: view?.pausedAt != null, ended: view?.state === 'over',
    recap: reply?.recap ?? null, t: view?.t ?? 0, seq: 0,
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

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
      const burst: HitBurst = { id: n.seq + 1, pupil: event.pupil, name: nm(event.pupil), points: event.points, times: event.times, weakSpot: event.weakSpot, golden: event.golden, team: event.team, t: event.t };
      const old = n.roster[event.pupil];
      const withScore = rosterWith(event.pupil, { score: (old?.score ?? 0) + event.points, role: event.role, team: event.team ?? old?.team ?? null });
      return {
        ...withScore, seq: n.seq + 1, bursts: [...n.bursts, burst].slice(-MAX_BURSTS), hitSeq: n.hitSeq + 1, bigHitSeq: n.bigHitSeq + (event.times >= 2 ? 1 : 0),
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
      return { ...n, shield, banner: { text: 'BOSS IS WINDING UP!', kind: 'wind', until: event.endsAt } };
    }
    case 'shield_progress': {
      if (!n.shield) return n;
      const groups = { ...n.shield.groups, [event.group]: { needed: event.needed, got: event.got } };
      return { ...n, shield: { ...n.shield, groups, needed: sum(Object.values(groups).map((g) => g.needed)), got: sum(Object.values(groups).map((g) => g.got)) } };
    }
    case 'shield_held': {
      const sh = n.shield ?? { needed: 0, got: 0, endsAt: event.t, enraged: false, groups: {}, state: null, resolvedAt: 0 };
      const helped = event.guards.length ? ` ${event.guards.length === 1 ? nm(event.guards[0]) : 'The Guards'} led the way!` : '';
      return { ...n, shield: { ...sh, got: Math.max(sh.got, sh.needed), state: 'held', resolvedAt: event.t }, banner: { text: `Shield held!${helped}`, kind: 'good', until: event.t + BANNER_MS } };
    }
    case 'shield_broke': {
      const sh = n.shield ?? { needed: 0, got: 0, endsAt: event.t, enraged: false, groups: {}, state: null, resolvedAt: 0 };
      const dazed = { ...n.dazed };
      for (const id of event.dazed) dazed[id] = event.dazedUntil;
      return { ...n, dazed, shield: { ...sh, state: 'broke', resolvedAt: event.t }, banner: { text: 'The shield broke!', kind: 'bad', until: event.t + BANNER_MS } };
    }
    case 'boss_heals':
      return { ...n, healAt: event.t };
    case 'weak_spot':
      return { ...banner('WEAK SPOT! Hit it now!', 'good', 2600), weakUntil: event.endsAt };
    case 'weak_spot_end':
      return { ...n, weakUntil: 0 };
    case 'phase':
      return { ...n, phase: event.phase, phaseAt: event.t, banner: { text: event.phase === 2 ? 'THE BOSS IS CHANGING!' : 'THE BOSS IS FURIOUS!', kind: 'phase', until: event.t + 3600 } };
    case 'golden':
      return { ...n, goldenUntil: event.endsAt, goldenSeq: n.goldenSeq + 1, banner: { text: 'GOLDEN QUESTION! Triple points!', kind: 'golden', until: event.t + 3600 } };
    case 'golden_end':
      return { ...n, goldenUntil: 0 };
    case 'final':
      return { ...n, final: true, finalUntil: event.endsAt, banner: { text: 'THIRTY SECONDS!', kind: 'final', until: event.t + 3000 } };
    case 'enrage':
      return { ...banner('The boss is ENRAGED!', 'wind', 2800), enrageUntil: event.endsAt };
    case 'enrage_end':
      return { ...n, enrageUntil: 0 };
    case 'boss_turns':
      return banner('The boss turns!', 'info', 2200);
    case 'boss_beaten':
      return { ...n, beaten: true, shield: null, banner: { text: 'THE BOSS IS BEATEN!', kind: 'good', until: event.t + 6000 } };
    case 'time_up':
      return { ...n, timeUp: true, shield: null, banner: { text: "TIME'S UP!", kind: 'bad', until: event.t + 6000 } };
    case 'recap':
      return { ...n, recap: event.recap, ended: true, beaten: event.recap.result === 'beaten', timeUp: event.recap.result === 'time' };
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
  return {
    ...s, view: v, phase: v.boss.phase, weakUntil: v.weakSpotUntil, goldenUntil: v.goldenUntil, enrageUntil: v.enrageUntil,
    final: s.final || v.finalStarted, paused: v.pausedAt != null, ended: s.ended || v.state === 'over',
    beaten: s.beaten || v.result === 'beaten', timeUp: s.timeUp || v.result === 'time',
  };
}

/** What the announcer and sound do for an event (the screen throttles hit sounds). */
export function soundFor(e: FeedEvent): { play?: Parameters<ShowdownSound['play']>[0]; say?: string } {
  switch (e.type) {
    case 'start': return { play: 'countdown', say: 'Three, two, one, fight!' };
    case 'hit': return { play: e.times >= 2 || e.golden ? 'bighit' : 'hit' };
    case 'wind_up': return { play: 'drum', say: 'The boss is winding up! Shield up!' };
    case 'shield_held': return { play: 'clang', say: 'Shield held!' };
    case 'shield_broke': return { play: 'crack', say: 'The shield broke!' };
    case 'revive': return { play: 'chime' };
    case 'weak_spot': return { play: 'whoosh', say: 'Weak spot!' };
    case 'golden': return { play: 'chime', say: 'Golden question!' };
    case 'phase': return { play: 'roar', say: 'The boss is changing!' };
    case 'enrage': return { play: 'roar' };
    case 'final': return { play: 'drum', say: 'Thirty seconds!' };
    case 'boss_beaten': return { play: 'cheer', say: 'The boss is beaten!' };
    case 'time_up': return { say: "Time's up!" };
    case 'recap': return e.recap.result === 'beaten' ? { play: 'fanfare' } : { say: 'So close!' };
    default: return {};
  }
}

/** Kid words for each award kind. */
export const AWARD_WORDS: Record<string, string> = {
  top_score: 'Top scorer', last_hit: 'Last hit', longest_streak: 'Longest streak', most_damage: 'Biggest hitter', best_comeback: 'Best comeback',
  shield_wall: 'Shield wall', best_healer: 'Best healer', golden_moment: 'Golden moment', most_careful: 'Most careful', hard_worker: 'Hard worker',
};
export const TEAM_WORDS: Record<TeamId, string> = { red: 'Red team', blue: 'Blue team', gold: 'Gold team', green: 'Green team' };
