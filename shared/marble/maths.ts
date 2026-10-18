/**
 * Maths in Marble Rush (docs/MARBLE-PLAN.md, section 7). Every question comes from the shared focus system
 * (`makeFocusPack`, shared/maths/focus.ts); this file only decides where in a run each question goes and how an
 * answer gate looks. It is plain functions of the run's seed and the question list, so the server, the browser's
 * picture and a ghost's replay all agree.
 *
 * The question list for a run has `QUESTION_TARGET` questions, used in this order ("slots"):
 *   the course's answer gates, then its pit stops, then rescue questions.
 *
 * An answer gate has two or three tunnels. The tunnel that holds the right answer has its shortcut door OPEN; the
 * other doors are shut (dead ends). The doors never change during a run. With maths off the gate shows an arrow and
 * the same kind of door is open (chosen from the seed), so a run without maths is just as quick.
 */
import type { Question } from '../maths/skillPack';
import type { Course } from './course';

/** About this many questions per run. */
export const QUESTION_TARGET = 10;

export interface SlotPlan {
  gates: number;
  pits: number;
  /** Rescue questions (stage M.7): the rest of the list. */
  rescues: number;
  /** Where each kind starts in the list. */
  pitStart: number;
  rescueStart: number;
  total: number;
}

export function slotPlan(course: Course): SlotPlan {
  const gates = course.gates.length;
  const pits = course.pitCount;
  const rescues = Math.max(2, QUESTION_TARGET - gates - pits);
  return { gates, pits, rescues, pitStart: gates, rescueStart: gates + pits, total: gates + pits + rescues };
}

/** What the browser is told about a question: never its answer. */
export interface PublicQuestion {
  slot: number;
  parts: string[];
  spoken: string;
  choices?: number[];
  choiceLabels?: string[];
  input?: 'whole' | 'decimal';
  maxLength?: number;
}

export function publicQuestion(q: Question, slot: number): PublicQuestion {
  return {
    slot,
    parts: q.parts,
    spoken: q.spoken,
    ...(q.choices ? { choices: q.choices } : {}),
    ...(q.choiceLabels ? { choiceLabels: q.choiceLabels } : {}),
    ...(q.input ? { input: q.input } : {}),
    ...(q.maxLength ? { maxLength: q.maxLength } : {}),
  };
}

// ---------------------------------------------------------------- a seeded random number (whole-number maths only)

function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A small seeded random number generator. The same text always gives the same numbers. */
export function seededRandom(text: string): () => number {
  let a = hashSeed(text);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------- the choices on a gate

const DELTAS = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 20, -20, 100, -100];

/** How many digits a number has after the point (a decimal question's answer, like 0.45). */
function decimalPlaces(n: number): number {
  const text = String(n);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** Wrong answers a student could believe: the right answer nudged by a little, never below zero, never the same. */
function nearMisses(answer: number, random: () => number): number[] {
  const places = decimalPlaces(answer);
  const step = places > 0 ? 10 ** -places : 1;
  const out: number[] = [];
  for (const d of shuffled(DELTAS.slice(0, 6), random).concat(DELTAS.slice(6))) {
    const v = Number((answer + d * step).toFixed(places));
    if (v >= 0 && v !== answer && !out.includes(v)) out.push(v);
  }
  return out;
}

export interface GateLayout {
  gate: number;
  /** The question slot (the same as the gate number). */
  slot: number;
  /** The tunnel that holds the right answer (or, with maths off, the one the arrow points to). */
  right: number;
  /** What each tunnel's sign shows, or null with maths off. */
  labels: string[] | null;
  /** The number each tunnel stands for (compared with the answer), or null with maths off. */
  values: number[] | null;
}

/**
 * How each gate of a course looks for a run. `questions` is the run's question list, or null with maths off (arrows).
 * Everything comes from the seed and the list, so it can be made again whenever it is needed.
 */
export function gateLayout(course: Course, seed: string, questions: readonly Question[] | null): GateLayout[] {
  return course.gates.map((gate, g) => {
    const k = gate.tunnels.length;
    const random = seededRandom(`${seed}:gate:${g}`);
    const right = Math.floor(random() * k);
    const q = questions?.[g];
    if (!q) return { gate: g, slot: g, right, labels: null, values: null };
    const labelOf = new Map<number, string>();
    const options = q.choices && q.choices.length >= k ? q.choices : null;
    options?.forEach((value, i) => labelOf.set(value, q.choiceLabels?.[i] ?? String(value)));
    const wrongs = options ? shuffled(options.filter((v) => v !== q.answer), random) : nearMisses(q.answer, random);
    const values: number[] = [];
    let w = 0;
    for (let t = 0; t < k; t++) values.push(t === right ? q.answer : wrongs[w++]);
    return { gate: g, slot: g, right, labels: values.map((v) => labelOf.get(v) ?? String(v)), values };
  });
}

/** The shortcut doors (0 = A) that are open for a run. */
export function openDoors(course: Course, layout: readonly GateLayout[]): number[] {
  return layout.map((l) => course.gates[l.gate].tunnels[l.right].door).sort((a, b) => a - b);
}

/** Doors as a number, to keep with a saved run (bit 0 = door A). */
export function doorMask(doors: readonly number[]): number {
  return doors.reduce((mask, d) => mask | (1 << d), 0);
}

export function doorsFromMask(mask: number): number[] {
  const out: number[] = [];
  for (let d = 0; d < 8; d++) if (mask & (1 << d)) out.push(d);
  return out;
}

/** The open doors for a course with no gates working yet (a course without gates has none). */
export function doorsForSeed(course: Course, seed: string, questions: readonly Question[] | null): number[] {
  return openDoors(course, gateLayout(course, seed, questions));
}
