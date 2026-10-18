/**
 * Maths in Marble Rush (docs/MARBLE-PLAN.md, section 7). Every question comes from the shared focus system
 * (`makeFocusPack`, shared/maths/focus.ts); this file only decides where in a run each question goes and how an
 * answer gate looks. It is plain functions of the run's seed and the question list, so the server, the browser's
 * picture and a ghost's replay all agree.
 *
 * The question list for a run has `QUESTION_TARGET` questions, used in this order ("slots"):
 *   the course's answer gates, then its pit stops, then its number-gem trails, then rescue questions.
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
  /** Number-gem trails: each is one question, never recorded. */
  trails: number;
  /** Rescue questions: the rest of the list. */
  rescues: number;
  /** Where each kind starts in the list. */
  pitStart: number;
  gemStart: number;
  rescueStart: number;
  total: number;
}

export function slotPlan(course: Course): SlotPlan {
  const gates = course.gates.length;
  const pits = course.pitCount;
  const trails = course.gems.length;
  const rescues = Math.max(2, QUESTION_TARGET - gates - pits - trails);
  return { gates, pits, trails, rescues, pitStart: gates, gemStart: gates + pits, rescueStart: gates + pits + trails, total: gates + pits + trails + rescues };
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

/** What each of `k` signs (tunnels or gems) shows: the right answer in place `right`, the others wrong. */
function choicesFor(q: Question, k: number, right: number, random: () => number): { labels: string[]; values: number[] } {
  const labelOf = new Map<number, string>();
  const options = q.choices && q.choices.length >= k ? q.choices : null;
  options?.forEach((value, i) => labelOf.set(value, q.choiceLabels?.[i] ?? String(value)));
  const wrongs = options ? shuffled(options.filter((v) => v !== q.answer), random) : nearMisses(q.answer, random);
  const values: number[] = [];
  let w = 0;
  for (let t = 0; t < k; t++) values.push(t === right ? q.answer : wrongs[w++]);
  return { labels: values.map((v) => labelOf.get(v) ?? String(v)), values };
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
    const { labels, values } = choicesFor(q, k, right, random);
    return { gate: g, slot: g, right, labels, values };
  });
}

export interface GemTrailLayout {
  trail: number;
  /** The question slot of the trail. */
  slot: number;
  /** For each group of gems: which place is the right gem, and what every gem shows. */
  groups: Array<{ right: number; labels: string[] }>;
}

/** How each number-gem trail looks for a run. With maths off there are no gems. */
export function gemLayout(course: Course, seed: string, questions: readonly Question[] | null): GemTrailLayout[] {
  if (!questions) return [];
  const plan = slotPlan(course);
  return course.gems.map((trail, t) => {
    const q = questions[plan.gemStart + t];
    return {
      trail: t,
      slot: plan.gemStart + t,
      groups: trail.groups.map((group, g) => {
        const random = seededRandom(`${seed}:gem:${t}:${g}`);
        const right = Math.floor(random() * group.spots.length);
        return { right, labels: q ? choicesFor(q, group.spots.length, right, random).labels : [] };
      }),
    };
  });
}

/** The numbers (in `course.gemList`) of the right gems. */
export function rightGems(course: Course, layout: readonly GemTrailLayout[]): number[] {
  const out: number[] = [];
  for (const t of layout) {
    t.groups.forEach((g, gi) => {
      const id = course.gemList.findIndex((s) => s.trail === t.trail && s.group === gi && s.spot === g.right);
      if (id >= 0) out.push(id);
    });
  }
  return out.sort((a, b) => a - b);
}

/** The shortcut doors (0 = A) that are open for a run. */
export function openDoors(course: Course, layout: readonly GateLayout[]): number[] {
  return layout.map((l) => course.gates[l.gate].tunnels[l.right].door).sort((a, b) => a - b);
}

/** Doors (0 = A) or gems (by number) as a number, to keep with a saved run: bit 0 is the first. */
export function doorMask(doors: readonly number[]): number {
  return doors.reduce((mask, d) => mask | (1 << d), 0);
}

/** Reads a mask back as a list of numbers. Doors use 8 bits, gems 16. */
export function doorsFromMask(mask: number, bits = 8): number[] {
  const out: number[] = [];
  for (let d = 0; d < bits; d++) if (mask & (1 << d)) out.push(d);
  return out;
}

/** The open doors of a run (none for a course without gates). */
export function doorsForSeed(course: Course, seed: string, questions: readonly Question[] | null): number[] {
  return openDoors(course, gateLayout(course, seed, questions));
}

// ---------------------------------------------------------------- what the browser needs to play a run

/** One answer gate as the browser sees it. */
export interface GateSetup {
  slot: number;
  /** What each tunnel's sign shows (maths on), else null. */
  labels: string[] | null;
  /** With maths off: the tunnel the arrow points to. */
  arrow: number | null;
  /** With maths on: the question over the gate. */
  question: PublicQuestion | null;
}

/** One number-gem trail as the browser sees it. */
export interface GemTrailSetup {
  slot: number;
  question: PublicQuestion;
  /** For each group of gems, what each gem shows. */
  groups: Array<{ labels: string[] }>;
}

/** Everything the screen needs to play one run: the open doors, the gates and the questions for pit stops and rescues (never an answer). */
export interface RunSetup {
  maths: boolean;
  rescue: boolean;
  /** The shortcut doors that are open this run (0 = A). */
  doors: number[];
  gates: GateSetup[];
  pits: PublicQuestion[];
  rescues: PublicQuestion[];
  /** Number-gem trails (maths on, harder courses). */
  gems: GemTrailSetup[];
  /** Which gems (by number) are right: the browser needs them to take the second off. */
  rightGems: number[];
}

/** What a start gives the browser: the seed with its stamp, and the setup. */
export interface StartReply extends RunSetup {
  seed: string;
  stamp: string;
}

/** The setup for a run. `questions` is the run's list (maths on) or null (maths off: arrows). */
export function runSetup(course: Course, seed: string, questions: readonly Question[] | null, rescue: boolean): RunSetup {
  const layout = gateLayout(course, seed, questions);
  const gems = gemLayout(course, seed, questions);
  const plan = slotPlan(course);
  const pub = (slot: number) => publicQuestion((questions as readonly Question[])[slot], slot);
  return {
    maths: questions !== null,
    rescue: questions !== null && rescue,
    doors: openDoors(course, layout),
    gates: layout.map((l) => ({ slot: l.slot, labels: l.labels, arrow: questions ? null : l.right, question: questions ? pub(l.slot) : null })),
    pits: questions ? Array.from({ length: plan.pits }, (_, i) => pub(plan.pitStart + i)) : [],
    rescues: questions && rescue ? Array.from({ length: plan.rescues }, (_, i) => pub(plan.rescueStart + i)) : [],
    gems: gems.map((t) => ({ slot: t.slot, question: pub(t.slot), groups: t.groups.map((g) => ({ labels: g.labels })) })),
    rightGems: rightGems(course, gems),
  };
}

/** A run with no maths and no server (offline, or two players on one keyboard): arrows, with the open doors chosen from a local seed. */
export function plainSetup(course: Course, random: () => number = Math.random): RunSetup {
  return runSetup(course, `local-${Math.floor(random() * 1e9)}`, null, false);
}

/** The right gems of a run (none with maths off, or on a course without gems). */
export function rightGemsForSeed(course: Course, seed: string, questions: readonly Question[] | null): number[] {
  return rightGems(course, gemLayout(course, seed, questions));
}
