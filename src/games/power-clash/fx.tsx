/**
 * What the screens show for the engine's `events`: which animation each square gets, the shout,
 * the sound, the message line and the banners. Shared by the bot / one-screen game and the
 * classmates game, so they can't drift apart. Nothing here decides anything: the engine has
 * already produced the new state and the events say what happened.
 */
import type { CSSProperties } from 'react';
import { CHAOS_EVERY } from '../../../shared/power-clash/engine';
import type { Cell, GameEvent, PowerClashState } from '../../../shared/power-clash/types';
import type { GameSound } from '../sounds';
import { CHAOS_ICONS, CHAOS_NAMES, WILD_ICONS, WILD_NAMES, chaosLine, type ShoutKind } from './text';

export interface Fx {
  key: number;
  events: GameEvent[];
  /** What stood on the wiped square before the blast, so it can fly off. */
  wiped: Cell;
  /** Squares whose symbol changed in a Time Heist, so they can rewind. */
  rewound: number[];
}

/** How the screen remembers what has just happened. `prev` and `after` are the states before and after. */
export function makeFx(key: number, prev: PowerClashState, after: PowerClashState, events: GameEvent[]): Fx {
  const wipe = events.find((e) => e.kind === 'wipe');
  const heist = events.some((e) => e.kind === 'time-heist');
  return {
    key,
    events,
    wiped: wipe && wipe.kind === 'wipe' ? prev.board[wipe.square] : null,
    rewound: heist ? prev.board.flatMap((c, i) => (c !== after.board[i] ? [i] : [])) : [],
  };
}

export const SOUNDS: Partial<Record<GameEvent['kind'], GameSound>> = {
  place: 'tap',
  'double-trouble': 'zap',
  'body-swap': 'swap',
  freeze: 'freeze',
  wipe: 'boom',
  'force-field': 'shield',
  'portal-chaos': 'portal',
  'wild-card': 'wheel',
  'time-heist': 'rewind',
  chaos: 'chaos',
  skip: 'end',
  win: 'win',
  draw: 'draw',
};

/** The one sound for a move: the biggest thing that happened. */
export function soundFor(events: GameEvent[]): GameSound | null {
  const kinds = events.map((e) => e.kind);
  const order: GameEvent['kind'][] = [
    'win', 'draw', 'time-heist', 'wild-card', 'portal-chaos', 'force-field', 'wipe', 'freeze', 'body-swap', 'double-trouble', 'chaos', 'skip', 'place',
  ];
  const first = order.find((k) => kinds.includes(k));
  return first ? SOUNDS[first]! : null;
}

/** Which shout to put above the board. */
export function shoutKindFor(events: GameEvent[], matchWon: boolean): ShoutKind | null {
  const kinds = events.map((e) => e.kind);
  if (matchWon) return 'match';
  if (kinds.includes('win')) return 'win';
  if (kinds.includes('draw')) return 'draw';
  const power: [GameEvent['kind'], ShoutKind][] = [
    ['time-heist', 'time-heist'], ['wild-card', 'wild-card'], ['portal-chaos', 'portal-chaos'], ['force-field', 'force-field'],
    ['body-swap', 'body-swap'], ['freeze', 'freeze-ray'], ['wipe', 'board-wipe'], ['double-trouble', 'double-trouble'],
  ];
  const hit = power.find(([k]) => kinds.includes(k));
  if (hit) return hit[1];
  if (kinds.includes('chaos')) return 'chaos';
  return kinds.includes('skip') ? 'skip' : null;
}

/** Which animation class a square gets, read from the engine's events. */
export function cellFx(fx: Fx | null, i: number): string {
  if (!fx) return '';
  const out: string[] = [];
  for (const e of fx.events) {
    if (e.kind === 'place' && e.square === i) out.push('pc__cell--pop');
    if (e.kind === 'body-swap' && e.squares.includes(i)) out.push('pc__cell--swap');
    if (e.kind === 'freeze' && e.square === i) out.push('pc__cell--frosting');
    if (e.kind === 'wipe' && e.square === i) out.push('pc__cell--blast');
    if (e.kind === 'force-field' && e.square === i) out.push('pc__cell--shielding');
    if (e.kind === 'portal-chaos' && (e.from.includes(i) || e.to.includes(i))) out.push('pc__cell--portal');
    if (e.kind === 'win' && e.line.includes(i)) out.push('pc__cell--cheer');
    if (e.kind === 'chaos' && e.squares.includes(i)) out.push(e.event === 'earthquake' ? 'pc__cell--swap' : `pc__cell--chaos-${e.event}`);
  }
  if (fx.rewound.includes(i)) out.push('pc__cell--rewind');
  return out.join(' ');
}

/** Classes for the whole board: flash, shake, rewind. */
export function boardClasses(fx: Fx | null): string {
  const kinds = fx?.events.map((e) => e.kind) ?? [];
  const chaos = fx?.events.find((e) => e.kind === 'chaos');
  const quake = chaos && chaos.kind === 'chaos' && (chaos.event === 'earthquake' || chaos.event === 'meteor');
  return [
    kinds.includes('double-trouble') ? 'pc__board--zap' : '',
    kinds.includes('wipe') || kinds.includes('win') || quake ? 'pc__board--shake' : '',
    kinds.includes('win') ? 'pc__board--win' : '',
    kinds.includes('draw') ? 'pc__board--draw' : '',
    kinds.includes('time-heist') ? 'pc__board--rewind' : '',
  ].join(' ');
}

/** For a swap, a portal or an earthquake: how far (in squares) each symbol slides to reach where it now sits. */
export function swapVars(fx: Fx | null, i: number): CSSProperties | undefined {
  if (!fx) return undefined;
  const away = (from: number): CSSProperties =>
    ({ '--dx': (from % 3) - (i % 3), '--dy': Math.floor(from / 3) - Math.floor(i / 3) }) as CSSProperties;
  for (const e of fx.events) {
    if (e.kind === 'body-swap' && e.squares.includes(i)) return away(e.squares[0] === i ? e.squares[1] : e.squares[0]);
    if (e.kind === 'chaos' && e.event === 'earthquake' && e.squares.includes(i)) return away(e.squares[0] === i ? e.squares[1] : e.squares[0]);
    if (e.kind === 'portal-chaos') {
      const k = e.to.indexOf(i);
      if (k >= 0) return away(e.from[k]);
    }
  }
  return undefined;
}

/** A few short-lived sparks on the square where something big happened. */
export function particles(fx: Fx | null, i: number) {
  if (!fx) return null;
  const hit = fx.events.some(
    (e) =>
      (e.kind === 'wipe' && e.square === i) || (e.kind === 'freeze' && e.square === i) || (e.kind === 'win' && e.line.includes(i)) ||
      (e.kind === 'force-field' && e.square === i) || (e.kind === 'chaos' && e.event === 'meteor' && e.squares.includes(i)),
  );
  if (!hit) return null;
  return Array.from({ length: 6 }, (_, n) => (
    <span key={n} className="pc__particle" aria-hidden="true" style={{ '--a': `${n * 60 + 20}deg` } as CSSProperties} />
  ));
}

export function cellLabel(i: number, cell: Cell, frozen: boolean, shielded = false) {
  const where = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
  return `${where}: ${cell ? `${cell}${shielded ? ', protected' : ''}` : frozen ? 'frozen, empty' : 'empty'}`;
}

/** The message line: what the last move did, in plain words (also read out). */
export function describe(events: GameEvent[], names?: { X: string; O: string }): string {
  const parts: string[] = [];
  const has = (kind: GameEvent['kind']) => events.some((e) => e.kind === kind);
  const wild = events.find((e) => e.kind === 'wild-card');
  if (has('time-heist')) parts.push('Time Heist! The last go never happened.');
  else if (wild && wild.kind === 'wild-card') {
    const result: Record<string, string> = {
      bonus: 'a bonus placement: two symbols this turn.',
      freeze: 'a freeze: one square is frozen for one turn.',
      swap: 'a swap: two symbols traded places.',
      remove: 'a blast: one symbol is gone.',
    };
    parts.push(`Wild Card! The wheel landed on ${WILD_NAMES[wild.effect]}, ${result[wild.effect]}`);
  } else if (has('portal-chaos')) parts.push('Portal Chaos! Two symbols were thrown to new squares.');
  else if (has('force-field')) parts.push('Force Field! That symbol is protected for one go.');
  else if (has('double-trouble')) parts.push('Double Trouble! Two symbols this turn.');
  else if (has('body-swap')) parts.push('Body Swap! They traded places.');
  else if (has('freeze')) parts.push('Freeze Ray! That square is frozen for one turn.');
  else if (has('wipe')) parts.push('Board Wipe! Gone.');
  else if (has('skip')) parts.push('Missed a go.');
  for (const e of events) if (e.kind === 'chaos') parts.push(chaosLine(e, names));
  return parts.join(' ');
}

/** The Chaos Mode banner: the surprise that just happened. The message line says the same in words, so this is hidden from screen readers. */
export function ChaosBanner({ fx, show }: { fx: Fx | null; show: boolean }) {
  const e = fx?.events.find((ev) => ev.kind === 'chaos');
  if (!show || !fx || !e || e.kind !== 'chaos') return null;
  return (
    <div className="pc__chaos" key={fx.key} aria-hidden="true">
      <span className="pc__chaos-icon">{CHAOS_ICONS[e.event]}</span>
      <span>{CHAOS_NAMES[e.event]}</span>
    </div>
  );
}

/** The Wild Card wheel: spins, then shows what it landed on. */
export function WildWheel({ fx, show }: { fx: Fx | null; show: boolean }) {
  const e = fx?.events.find((ev) => ev.kind === 'wild-card');
  if (!show || !fx || !e || e.kind !== 'wild-card') return null;
  return (
    <div className="pc__wheel" key={fx.key} aria-hidden="true">
      <span className="pc__wheel-spin">{(['bonus', 'freeze', 'swap', 'remove'] as const).map((k) => <span key={k}>{WILD_ICONS[k]}</span>)}</span>
      <span className="pc__wheel-result">{WILD_ICONS[e.effect]} {WILD_NAMES[e.effect]}!</span>
    </div>
  );
}

/** "Chaos Mode · surprise in 2 goes": so nobody is caught out by the rule. */
export function chaosCountdown(state: PowerClashState): string {
  const left = CHAOS_EVERY - (state.turns % CHAOS_EVERY);
  return left === 1 ? 'a surprise after this go' : `a surprise in ${left} goes`;
}
