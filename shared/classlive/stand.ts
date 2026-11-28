/**
 * Stand Up If (Class Live `stand`, docs/STAND-PLAN.md): a real-life game for a class set of iPads. Each round the big
 * screen shows one sign, like "Stand up if your answer > your number". Every pupil gets their own ladder question and
 * their own number on their iPad, works out the answer, then taps Stand or Sit. On "3, 2, 1" everyone stands or sits
 * for real, all at once; then each iPad shows whether they were right and their streak (right in a row).
 *
 * The number is made from the pupil's own right answer (close to it, sometimes equal), so the sign is what they must
 * think about, at any ladder level. Pure rules: the server (standServer.ts) loads the room, calls these and saves.
 */

export const STAND_LEVELS = ['junior', 'senior'] as const;
export type StandLevel = (typeof STAND_LEVELS)[number];
export const DEFAULT_STAND_LEVEL: StandLevel = 'senior';

export const SIGNS = ['>', '<', '≥', '≤'] as const;
export type Sign = (typeof SIGNS)[number];
/** Junior: greater than and less than only. Senior adds "or equal to". */
export const LEVEL_SIGNS: Record<StandLevel, readonly Sign[]> = { junior: ['>', '<'], senior: SIGNS };

export const SIGN_WORDS: Record<Sign, { words: string; tip: string }> = {
  '>': { words: 'greater than', tip: 'The open mouth eats the bigger number. Your answer must be bigger.' },
  '<': { words: 'less than', tip: 'The open mouth faces your number. Your answer must be smaller.' },
  '≥': { words: 'greater than or equal to', tip: 'Bigger, or exactly the same, both count.' },
  '≤': { words: 'less than or equal to', tip: 'Smaller, or exactly the same, both count.' },
};

/** Seconds to think each round (the teacher's choice). */
export const THINK_SECONDS = [20, 30, 45, 60] as const;
export const DEFAULT_THINK = 30;
/** The first round starts this long after Start (the How to play sheet is up first). */
export const FIRST_MS = 3000;
/** "3, 2, 1, stand up or sit down!" */
export const STAND_MS = 4000;
/** Results on the iPads and the big screen, then the next round. */
export const REVEAL_MS = 9000;
/** Once everyone has tapped Stand or Sit, the countdown starts this soon. */
export const ALL_IN_MS = 1500;
/** One answer at a time per pupil. */
export const ANSWER_GAP_MS = 600;

export interface StandRound {
  n: number;
  sign: Sign;
  from: number;
  /** The countdown starts (no more answers or taps). */
  standAt: number;
  /** Results show. */
  revealAt: number;
  /** The next round starts. */
  endAt: number;
  revealed: boolean;
  /** At the reveal: pupils right, and pupils who took part. */
  spot: number;
  took: number;
}

/** A pupil's go this round (kept on the server; the pupil's own row shows it). */
export interface StandGo {
  n: number;
  slot: number;
  /** The right answer, their number, and whether they typed the answer right. */
  answer: number;
  target: number;
  right: boolean;
  /** Stand (true) or Sit (false); null until they tap. */
  stand: boolean | null;
}

export interface StandResult {
  n: number;
  sign: Sign;
  answer: number;
  target: number;
  /** Took part (answered in time). */
  took: boolean;
  right: boolean;
  stand: boolean | null;
  /** Should have stood. */
  truth: boolean;
  /** Answer right and the right choice. */
  spot: boolean;
}

export interface StandMine {
  answered: number;
  rightAll: number;
  wrong: number;
  lastAt: number;
  /** The round they joined in: a round before that never breaks their streak. */
  since: number;
  streak: number;
  best: number;
  /** Rounds right. */
  spots: number;
  go: StandGo | null;
  last: StandResult | null;
}

export interface StandGame {
  kind: 'stand';
  level: StandLevel;
  think: number;
  round: StandRound | null;
  mine: Record<string, StandMine>;
}

export type StandEvent =
  | { type: 'stand_round'; t: number; n: number; sign: Sign }
  | { type: 'stand_go'; t: number; n: number; all: boolean }
  | { type: 'stand_reveal'; t: number; n: number; spot: number; took: number; best: number };

export const standLevelOf = (v: unknown): StandLevel => STAND_LEVELS.find((l) => l === v) ?? DEFAULT_STAND_LEVEL;
export const thinkOf = (v: unknown): number => ((THINK_SECONDS as readonly number[]).includes(v as number) ? (v as number) : DEFAULT_THINK);

export const newStand = (level: StandLevel, think: number): StandGame => ({ kind: 'stand', level, think, round: null, mine: {} });

export const freshStandMine = (since: number): StandMine => ({ answered: 0, rightAll: 0, wrong: 0, lastAt: -Infinity, since, streak: 0, best: 0, spots: 0, go: null, last: null });

export function joinStand(g: StandGame, id: string) {
  g.mine[id] ??= freshStandMine(g.round?.n ?? 0);
}

export type StandPhase = 'think' | 'stand' | 'reveal';
export const standPhase = (r: StandRound, t: number): StandPhase => (t < r.standAt ? 'think' : !r.revealed && t < r.revealAt ? 'stand' : 'reveal');

/** Decimal places of a number (at most 3). */
function placesOf(x: number): number {
  for (let p = 0; p < 3; p++) if (Math.abs(Math.round(x * 10 ** p) - x * 10 ** p) < 1e-6) return p;
  return 3;
}
const roundTo = (x: number, p: number) => Math.round(x * 10 ** p) / 10 ** p;

/**
 * A pupil's number for this round, made from their right answer: close to it (within about a quarter, in the answer's
 * own steps: 1, 0.1 or 0.01), and sometimes exactly it, so "or equal to" matters and > with an equal number is a sit.
 * Juniors never get an equal number or one below zero.
 */
export function targetFor(answer: number, sign: Sign, level: StandLevel, rand: () => number): number {
  const p = placesOf(answer);
  const unit = 10 ** -p;
  const equal = level === 'junior' ? 0 : sign === '≥' || sign === '≤' ? 0.3 : 0.15;
  if (rand() < equal) return answer;
  const span = Math.max(3, Math.min(30, Math.round((Math.abs(answer) * 0.25) / unit)));
  const k = 1 + (Math.floor(rand() * span) % span);
  const up = rand() < 0.5;
  let target = roundTo(answer + (up ? k : -k) * unit, p);
  if (target < 0 && answer >= 0) target = roundTo(answer + k * unit, p);
  return target;
}

/** Is "answer (sign) target" true? */
export function holds(answer: number, sign: Sign, target: number): boolean {
  const a = Math.round(answer * 1000), b = Math.round(target * 1000);
  return sign === '>' ? a > b : sign === '<' ? a < b : sign === '≥' ? a >= b : a <= b;
}

/** The next round's sign: never the same twice running. */
export function pickSign(level: StandLevel, last: Sign | null, random: () => number): Sign {
  const pool = LEVEL_SIGNS[level].filter((s) => s !== last);
  return pool[Math.floor(random() * pool.length) % pool.length];
}

function newRound(g: StandGame, t: number, random: () => number): StandEvent {
  const n = (g.round?.n ?? 0) + 1;
  const sign = pickSign(g.level, g.round?.sign ?? null, random);
  const standAt = t + g.think * 1000;
  g.round = { n, sign, from: t, standAt, revealAt: standAt + STAND_MS, endAt: standAt + STAND_MS + REVEAL_MS, revealed: false, spot: 0, took: 0 };
  return { type: 'stand_round', t, n, sign };
}

/** Start the countdown now (everyone is in, or the teacher tapped Go). */
function goNow(r: StandRound, at: number, all: boolean): StandEvent[] {
  if (at >= r.standAt) return [];
  r.standAt = at;
  r.revealAt = at + STAND_MS;
  r.endAt = r.revealAt + REVEAL_MS;
  return [{ type: 'stand_go', t: at, n: r.n, all }];
}

function reveal(g: StandGame, r: StandRound, t: number, order: string[]): StandEvent {
  r.revealed = true;
  let spot = 0, took = 0, best = 0;
  for (const id of order) {
    const m = (g.mine[id] ??= freshStandMine(r.n));
    const go = m.go && m.go.n === r.n ? m.go : null;
    const truth = go ? holds(go.answer, r.sign, go.target) : false;
    const isSpot = !!go && go.right && go.stand === truth;
    if (go) took += 1;
    if (isSpot) {
      spot += 1;
      m.spots += 1;
      m.streak += 1;
      m.best = Math.max(m.best, m.streak);
    } else if (go || m.since < r.n) m.streak = 0;
    best = Math.max(best, m.streak);
    m.last = { n: r.n, sign: r.sign, answer: go?.answer ?? 0, target: go?.target ?? 0, took: !!go, right: go?.right ?? false, stand: go?.stand ?? null, truth, spot: isSpot };
  }
  r.spot = spot;
  r.took = took;
  return { type: 'stand_reveal', t, n: r.n, spot, took, best };
}

/** Moves the game on by the clock: the first round, the reveal, the next round (none once `last`). */
export function advanceStand(g: StandGame, t: number, order: string[], random: () => number, last: boolean): StandEvent[] {
  const events: StandEvent[] = [];
  if (!g.round) {
    if (t >= FIRST_MS && !last) events.push(newRound(g, t, random));
    return events;
  }
  const r = g.round;
  if (!r.revealed && t >= r.revealAt) events.push(reveal(g, r, t, order));
  if (r.revealed && t >= r.endAt && !last) events.push(newRound(g, t, random));
  return events;
}

/** The last round is over (or none started): the game can end. */
export const standDone = (g: StandGame, t: number) => !g.round || (g.round.revealed && t >= g.round.endAt);

/** The next time the server must act, or null. */
export function standDeadline(g: StandGame, startedAt: number | null): number | null {
  if (startedAt === null) return null;
  const r = g.round;
  if (!r) return FIRST_MS;
  return r.revealed ? r.endAt : r.revealAt;
}

export type StandRefusal = 'not_now' | 'answered' | 'no_go' | 'too_soon';

/** A marked answer this round. */
export function standAnswer(g: StandGame, id: string, go: Omit<StandGo, 'n' | 'stand'>, t: number): { ok: true } | { ok: false; reason: StandRefusal } {
  const r = g.round;
  if (!r || standPhase(r, t) !== 'think') return { ok: false, reason: 'not_now' };
  const m = (g.mine[id] ??= freshStandMine(r.n));
  if (m.go?.n === r.n) return { ok: false, reason: 'answered' };
  if (t - m.lastAt < ANSWER_GAP_MS) return { ok: false, reason: 'too_soon' };
  m.lastAt = t;
  m.answered += 1;
  if (go.right) m.rightAll += 1;
  else m.wrong += 1;
  m.go = { ...go, n: r.n, stand: null };
  return { ok: true };
}

/** Stand or Sit (changeable until the countdown). Once every pupil has tapped, the countdown starts. */
export function standChoose(g: StandGame, id: string, stand: boolean, t: number, order: string[]): { ok: true; events: StandEvent[] } | { ok: false; reason: StandRefusal } {
  const r = g.round;
  if (!r || standPhase(r, t) !== 'think') return { ok: false, reason: 'not_now' };
  const m = g.mine[id];
  if (!m?.go || m.go.n !== r.n) return { ok: false, reason: 'no_go' };
  m.go.stand = stand;
  const allIn = order.length > 0 && order.every((x) => { const go = g.mine[x]?.go; return go?.n === r.n && go.stand !== null; });
  return { ok: true, events: allIn ? goNow(r, Math.min(r.standAt, t + ALL_IN_MS), true) : [] };
}

/** The teacher's Go: the countdown now (thinking), or the next round now (results showing). */
export function standGo(g: StandGame, t: number, random: () => number): StandEvent[] {
  const r = g.round;
  if (!r) return [newRound(g, t, random)];
  if (standPhase(r, t) === 'think') return goNow(r, t, false);
  if (r.revealed) return [newRound(g, t, random)];
  return [];
}

/** Pupils who tapped Stand or Sit this round. */
export const readyCount = (g: StandGame) => (g.round ? Object.values(g.mine).filter((m) => m.go?.n === g.round!.n && m.go.stand !== null).length : 0);

/** The best streaks in the room (for the end screen and the +2 bonus): the class's longest run, if 3 or more. */
export function topStreak(g: StandGame, order: string[]): number {
  const best = Math.max(0, ...order.map((id) => g.mine[id]?.best ?? 0));
  return best >= 3 ? best : 0;
}
