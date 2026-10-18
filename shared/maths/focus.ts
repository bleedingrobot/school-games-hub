/**
 * The maths focus as the games see it (docs/MATHS-FOCUS-PLAN.md, sections 4 and 8).
 *
 * The server works out each student's focus (`my_maths_focus()`, `maths_focus_of()`); a game only
 * reads the answer and never decides it. This file turns that answer into a safe shape, says it
 * in words, builds the pack a game asks its questions from, and marks answers for every skill
 * the ladder has built (the server uses `solveParts` to check answers it didn't see being asked).
 */
import { parseFactKey } from './facts';
import type { FactStats } from './leitner';
import { AutoPack, FOCUS_PACKS, focusSkills, ladderKeyPacks, LADDER, packIdOfKey, type FocusPackId, type FocusSpec } from './ladder';
import { floorRank, NO_LADDER, parseLadderInfo, type LadderInfo } from './place';
import type { SkillPack } from './skillPack';
import { TimesTables } from './skillPacks/timesTables';

/** Where the current focus came from. */
export type FocusSource = 'teacher-student' | 'teacher-group' | 'teacher-class' | 'student' | 'auto';

export interface MathsFocus {
  source: FocusSource;
  /** Ladder skill ids. Empty for auto. */
  skills: string[];
  onlyThese: boolean;
  /** When a teacher's focus ends (ISO time), else null. */
  endsAt: string | null;
  /** The class lets students choose their own focus (when no teacher focus is running). */
  canChoose: boolean;
  /** The student's own choice, kept underneath a teacher's focus. Null when they have none. */
  own: { skills: string[]; onlyThese: boolean } | null;
  /** The ladder: whether the class has auto on, and where the student starts. Present whatever the source, so a teacher's focus doesn't hide the student's place. */
  ladder?: LadderInfo;
}

export const AUTO_FOCUS: MathsFocus = { source: 'auto', skills: [], onlyThese: false, endsAt: null, canChoose: true, own: null, ladder: NO_LADDER };

const SOURCES: readonly FocusSource[] = ['teacher-student', 'teacher-group', 'teacher-class', 'student', 'auto'];
const SKILL_ID = /^[a-z0-9-]{1,40}$/;

const cleanSkills = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter((s): s is string => typeof s === 'string' && SKILL_ID.test(s)))].slice(0, 12) : [];

/** Reads what the server sent. Anything odd counts as auto: nobody gets a strange focus by accident. */
export function parseFocus(raw: unknown): MathsFocus {
  if (!raw || typeof raw !== 'object') return AUTO_FOCUS;
  const r = raw as Record<string, unknown>;
  const source = SOURCES.find((s) => s === r.source) ?? 'auto';
  const skills = cleanSkills(r.skills);
  const own = r.own && typeof r.own === 'object' ? (r.own as Record<string, unknown>) : null;
  const ownSkills = own ? cleanSkills(own.skills) : [];
  const ends = typeof r.endsAt === 'string' && !Number.isNaN(Date.parse(r.endsAt)) ? r.endsAt : null;
  return {
    source: source !== 'auto' && skills.length === 0 ? 'auto' : source,
    skills: source === 'auto' ? [] : skills,
    onlyThese: r.onlyThese === true,
    endsAt: source.startsWith('teacher') ? ends : null,
    canChoose: r.canChoose !== false,
    own: ownSkills.length ? { skills: ownSkills, onlyThese: own!.onlyThese === true } : null,
    ladder: parseLadderInfo(r.ladder),
  };
}

/** True when the focus names at least one skill the games can ask today. */
export function hasFocus(focus: MathsFocus | null | undefined): focus is MathsFocus {
  return !!focus && focus.source !== 'auto' && focusSkills(focus).length > 0;
}

export const isTeacherFocus = (focus: MathsFocus) => focus.source.startsWith('teacher');

/** The class has auto switched on and the student has no focus: the games ask from the whole ladder. */
export const usesLadder = (focus: MathsFocus | null | undefined): boolean => !hasFocus(focus) && !!(focus as MathsFocus | null | undefined)?.ladder?.on;

/** The ladder facts of a focus (auto off, nothing known, when it has none). */
export const ladderOf = (focus: MathsFocus | null | undefined): LadderInfo => focus?.ladder ?? NO_LADDER;

/** The same focus, so a game can tell whether it changed. */
export const focusKey = (focus: MathsFocus | null | undefined) =>
  hasFocus(focus)
    ? `${focus.source}|${focus.onlyThese ? 'only' : 'mix'}|${[...focus.skills].sort().join(',')}`
    : usesLadder(focus)
      ? `ladder|${floorRank(ladderOf(focus))}`
      : 'auto';

/** What the student and teacher see for a skill. */
export const skillLabel = (id: string) => LADDER.find((s) => s.id === id)?.label ?? id;

/** Short names for notes: "×6, ×9" rather than "Times tables: ×6, ×9". */
export function skillShortLabel(id: string): string {
  const label = skillLabel(id);
  return label.replace(/^Times tables: /, '');
}

/** "×6 and ×9", "Number facts to 10, ×3 and ×4". */
export function skillList(ids: readonly string[]): string {
  const names = focusSkills({ skills: ids, onlyThese: false }).map((s) => skillShortLabel(s.id));
  if (names.length === 0) return 'your skills';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const NZ = 'Pacific/Auckland';
const nzParts = (date: Date) => {
  const f = new Intl.DateTimeFormat('en-NZ', { timeZone: NZ, weekday: 'long', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric' });
  const get = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return { weekday: get.weekday, hour: Number(get.hour), minute: Number(get.minute), key: `${get.year}-${get.month}-${get.day}` };
};

/**
 * When a teacher's focus ends, in words: "for another 40 minutes", "until Friday", "until 3:30 pm".
 * Focuses end at midnight (the end of a day) or an exact time, in New Zealand time.
 */
export function describeEnd(endsAt: string, now: Date = new Date()): string {
  const end = new Date(endsAt);
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return 'has ended';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 90) return `for another ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const e = nzParts(end);
  if (e.hour === 0 && e.minute === 0) {
    // Midnight ends the day before: "until Friday" means the end of Friday.
    const last = nzParts(new Date(end.getTime() - 60_000));
    const today = nzParts(now);
    if (last.key === today.key) return 'until tonight';
    return `until ${last.weekday}`;
  }
  const time = new Intl.DateTimeFormat('en-NZ', { timeZone: NZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(end).toLowerCase();
  return nzParts(now).key === e.key ? `until ${time}` : `until ${e.weekday} ${time}`;
}

/** How long is left, for a teacher's list: "ends in 2 days". */
export function timeLeft(endsAt: string, now: Date = new Date()): string {
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (ms <= 0) return 'ended';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 90) return `ends in ${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `ends in ${hours} hours`;
  const days = Math.round(hours / 24);
  return `ends in ${days} days`;
}

/**
 * What a game should follow right now. A teacher focus that has run out while the page was open (or in a copy kept for offline
 * play) no longer counts: the student goes back to their own choice, else to auto. The server decides this too, for real.
 */
export function currentFocus(focus: MathsFocus | null | undefined, now: Date = new Date()): MathsFocus {
  if (!focus) return AUTO_FOCUS;
  if (isTeacherFocus(focus) && focus.endsAt && Date.parse(focus.endsAt) <= now.getTime()) {
    if (focus.canChoose && focus.own) {
      return { source: 'student', skills: focus.own.skills, onlyThese: focus.own.onlyThese, endsAt: null, canChoose: true, own: focus.own, ladder: focus.ladder };
    }
    return { ...AUTO_FOCUS, canChoose: focus.canChoose, own: focus.own, ladder: focus.ladder };
  }
  return focus;
}

/** 'YYYY-MM-DDTHH:mm' as the clock in New Zealand shows it at this moment. */
export function nzWallClock(date: Date): string {
  const f = new Intl.DateTimeFormat('en-NZ', { timeZone: NZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const get = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return `${get.year}-${get.month}-${get.day}T${get.hour}:${get.minute}`;
}

/**
 * A time typed as New Zealand wall-clock time ('2026-10-23T15:30', what a date-time box gives) as the real moment, in ISO.
 * Null if it is not a time (or falls in the hour the clocks skip). Times are NZ time whatever the device clock says.
 */
export function nzLocalToIso(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  for (const offsetHours of [13, 12]) {
    const guess = new Date(asUtc - offsetHours * 3_600_000);
    if (nzWallClock(guess) === local) return guess.toISOString();
  }
  return null;
}

/** The note a student sees: why their questions are what they are. */
export function focusNote(focus: MathsFocus | null | undefined, now: Date = new Date()): string | null {
  if (!hasFocus(focus)) return null;
  const what = skillList(focus.skills);
  if (isTeacherFocus(focus)) return `Your teacher picked ${what} ${focus.endsAt ? describeEnd(focus.endsAt, now) : ''}`.trim();
  return `You picked ${what}`;
}

// ---------------------------------------------------------------- the pack a game asks from

export interface FocusOptions {
  enabledTables?: readonly number[];
  division?: boolean;
}

/**
 * The pack a game asks its questions from. With no focus it is the times-table pack, exactly
 * as before (the campaign or the student's ready step decides), unless the class has auto switched on:
 * then it is the whole ladder from the student's place. With a focus it is the ladder
 * pack, asking only that focus. `stats` is every record the student has, whatever pack kept it.
 */
export function makeFocusPack(stats: FactStats[], focus: MathsFocus | null | undefined, opts: FocusOptions = {}, random?: () => number, now?: () => number): SkillPack {
  if (usesLadder(focus)) return new AutoPack(stats, random, now, { enabledTables: opts.enabledTables, division: opts.division, floor: floorRank(ladderOf(focus)) });
  if (!hasFocus(focus)) return new TimesTables(stats.filter((s) => parseFactKey(s.key)), random, now);
  const spec: FocusSpec = { skills: focus.skills, onlyThese: focus.onlyThese };
  return new AutoPack(stats, random, now, { enabledTables: opts.enabledTables, division: opts.division, focus: spec });
}

/** Every record a pack holds. */
export const packStats = (pack: SkillPack): FactStats[] => pack.stats();

/** Splits answers by the pack that keeps their record (times tables, early facts, adding, division). */
export function groupByPack<T extends { key: string }>(answers: readonly T[]): Map<FocusPackId, T[]> {
  const out = new Map<FocusPackId, T[]>();
  for (const answer of answers) {
    const pack = packIdOfKey(answer.key);
    if (!pack) continue;
    out.set(pack, [...(out.get(pack) ?? []), answer]);
  }
  return out;
}

// ---------------------------------------------------------------- marking an answer from the screen

const ladderKeys = ladderKeyPacks();
for (let a = 1; a <= 12; a++) for (let b = a; b <= 12; b++) ladderKeys.set(`mul:${a}x${b}`, 'times-tables');

/** True for a mastery key the games record under a focus. */
export const isFocusKey = (key: string) => ladderKeys.has(key);

export interface Solved {
  answer: number;
  /** Every record this question could count towards. A question like "10 − 3 = ?" fits an adding fact and a pair that makes 10. */
  keys: string[];
}

const NUMBER = /^\d{1,4}$/;
const num = (text: string) => (NUMBER.test(text) ? Number(text) : NaN);
const whole = (n: number) => Number.isInteger(n) && n >= 0;

/** The adding and pairs-that-make-N records for two numbers that add to `total`. */
function sumKeys(p: number, q: number, total: number): string[] {
  const keys: string[] = [];
  const lo = Math.min(p, q);
  const hi = Math.max(p, q);
  keys.push(`add:${lo}+${hi}`);
  if (total === 10) keys.push(`bond10:${lo}+${hi}`);
  if (total === 20) keys.push(`bond20:${lo}+${hi}`);
  if (p === q) keys.push(`dbl:${p}`);
  return keys;
}

/** The times-table and division-fact records for n ÷ d = q. */
function divKeys(n: number, d: number, q: number): string[] {
  // The times-table record comes first: that is where a division question has always counted.
  const keys: string[] = [];
  if (d >= 1 && d <= 12 && q >= 1 && q <= 12) keys.push(`mul:${Math.min(d, q)}x${Math.max(d, q)}`);
  keys.push(`div:${n}/${d}`);
  if (d === 2) keys.push(`half:${n}`);
  return keys;
}

/**
 * Works a question out from how it was shown (['7', '+', '?', '=', '10']): its answer, and the
 * records it could count towards. Null if no ladder skill asks that shape. The server uses this
 * to check answers from a solo game it didn't see being asked. It knows nothing the generators
 * don't: the tests make thousands of questions and check this agrees with every one.
 */
export function solveParts(parts: unknown): Solved | null {
  if (!Array.isArray(parts) || !parts.every((p) => typeof p === 'string')) return null;
  const p = parts as string[];
  const blanks = p.filter((x) => x === '?').length;
  let answer = NaN;
  let keys: string[] = [];

  if (p.length === 4 && p[0] === 'Double' && p[2] === '=' && p[3] === '?') {
    const n = num(p[1]);
    answer = 2 * n;
    keys = [`dbl:${n}`];
  } else if (p.length === 5 && p[0] === 'Half' && p[1] === 'of' && p[3] === '=' && p[4] === '?') {
    const n = num(p[2]);
    answer = n / 2;
    keys = [`half:${n}`];
  } else if (p.length === 5 && p[3] === '=' && blanks === 1) {
    const [x, op, y, , z] = p;
    const [a, b, c] = [num(x), num(y), num(z)];
    if (op === '+') {
      // x + y = z with one blank.
      const [addendA, addendB, total] = z === '?' ? [a, b, a + b] : x === '?' ? [c - b, b, c] : [a, c - a, c];
      answer = z === '?' ? total : x === '?' ? addendA : addendB;
      if (whole(addendA) && whole(addendB)) keys = sumKeys(addendA, addendB, total);
    } else if (op === '−') {
      // x − y = z: the pair is (y, x − y) with total x.
      if (z === '?') {
        answer = a - b;
        if (whole(answer)) keys = sumKeys(b, answer, a);
      } else if (y === '?') {
        answer = a - c;
        if (whole(answer)) keys = sumKeys(c, answer, a);
      }
    } else if (op === '×') {
      const [f, g, product] = z === '?' ? [a, b, a * b] : x === '?' ? [c / b, b, c] : [a, c / a, c];
      answer = z === '?' ? product : x === '?' ? f : g;
      if (Number.isInteger(f) && Number.isInteger(g) && f * g === product && f >= 1 && f <= 12 && g >= 1 && g <= 12) {
        keys = [`mul:${Math.min(f, g)}x${Math.max(f, g)}`];
      }
    } else if (op === '÷') {
      // x ÷ y = z. A blank at the end is the quotient; a blank in the middle is the divisor.
      if (z === '?') {
        answer = a / b;
        if (whole(answer) && b > 0) keys = divKeys(a, b, answer);
      } else if (y === '?') {
        answer = a / c;
        if (whole(answer) && c > 0) keys = divKeys(a, answer, c);
      }
    }
  }

  if (!whole(answer) || answer > 1000) return null;
  keys = keys.filter(isFocusKey);
  return keys.length ? { answer, keys } : null;
}

/**
 * The record a solo-game answer counts towards: the one the browser says (it knows which fact it
 * asked) if the question could really be that fact, else the first one the question fits.
 */
export function keyForAnswer(solved: Solved, claimed: unknown): string {
  return typeof claimed === 'string' && solved.keys.includes(claimed) ? claimed : solved.keys[0];
}

export { FOCUS_PACKS, packIdOfKey };
export type { FocusPackId };
