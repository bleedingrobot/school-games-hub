/**
 * Maths in Circuit Racer (docs/CIRCUIT-PLAN.md, section 7; way A of docs/game-guide/4-maths.md): recharge ports and data
 * gates. The server makes one question per port and gate when a go starts (`makeRunQuestions`, from the pupil's focus),
 * keeps them where pupils can't read them, and marks every answer. This file only decides which question goes where and
 * how a gate's signs look. It is plain functions of the road, the seed and the question list, so the server's replay, the
 * screen and the tests all agree.
 *
 * Slots: the road's ports first (port p is slot p), then its gates (gate g is slot ports + g).
 *
 * A port pauses the race for its question: right = full battery and signal, wrong or unanswered = half (`refillsFor`),
 * and that share is part of the replay. A gate's lanes are signed with answers; the right lane is an overclock shortcut,
 * the others the normal road. The lane taken is read from the replay (the lane at the split row) and marked at the finish.
 * With maths off there are no questions: ports refill fully and every gate lane is overclock.
 *
 * The screen is told each gate's right lane (it has to drive the same physics as the server's replay), as Marble Rush tells
 * it the open doors. Nothing else about the answers leaves the server.
 */
import { seededRandom, type PublicQuestion, publicQuestion } from '../maths/serverQuestions';
import type { Question } from '../maths/skillPack';
import { HALF_REFILL } from './config';
import type { Road } from './road';

/** How long a gate answer is said to have taken. The server can't time a lane change, so it never counts as quick (Marble: 8 s). */
export const GATE_MS = 8000;

export interface SlotPlan {
  ports: number;
  gates: number;
  /** The first gate's slot. */
  gateStart: number;
  total: number;
}

export function slotPlan(road: Road): SlotPlan {
  return { ports: road.ports.length, gates: road.gates.length, gateStart: road.ports.length, total: road.ports.length + road.gates.length };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const DELTAS = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5, 20, -20, 100, -100];

function decimalPlaces(n: number): number {
  const text = String(n);
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/** Wrong answers a pupil could believe: the right answer nudged a little, never below zero, never the same (as Marble). */
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
  slot: number;
  /** The signed lane (road column) that holds the right answer. */
  rightLane: number;
  /** What each of the gate's lanes shows (left to right, as `road.gates[gate].lanes`); null for a lane with no sign. */
  labels: (string | null)[];
  /** The number each lane stands for, compared with the answer; null for a lane with no sign. */
  values: (number | null)[];
}

/**
 * How each gate looks for a go: from the seed and the question list only, so it can be made again at the finish.
 * A question that can only be picked (`choiceLabels`) with fewer choices than lanes leaves the extra lanes unsigned
 * (the normal road); any other question fills every lane, with near misses if it has no choices of its own.
 */
export function gateLayout(road: Road, seed: string, questions: readonly Question[]): GateLayout[] {
  const plan = slotPlan(road);
  return road.gates.map((gate, g) => {
    const slot = plan.gateStart + g;
    const q = questions[slot];
    const random = seededRandom(`${seed}:gate:${g}`);
    const lanes = gate.lanes.length;
    const pickOnly = !!(q?.choiceLabels && q.choices);
    const signed = pickOnly ? Math.min(lanes, q.choices!.length) : lanes;
    const right = Math.floor(random() * signed);
    const labelOf = new Map<number, string>();
    q?.choices?.forEach((v, i) => labelOf.set(v, q.choiceLabels?.[i] ?? String(v)));
    const options = q?.choices && q.choices.length >= 2 ? q.choices : null;
    const wrongs = q ? (options ? shuffled(options.filter((v) => v !== q.answer), random) : []).concat(pickOnly ? [] : nearMisses(q.answer, random)) : [];
    const values: (number | null)[] = [];
    let w = 0;
    for (let i = 0; i < lanes; i++) {
      if (!q || i >= signed) values.push(null);
      else if (i === right) values.push(q.answer);
      else {
        while (w < wrongs.length && (wrongs[w] === q.answer || values.includes(wrongs[w]))) w++;
        values.push(w < wrongs.length ? wrongs[w++] : null);
      }
    }
    return { gate: g, slot, rightLane: gate.lanes[right], labels: values.map((v) => (v === null ? null : (labelOf.get(v) ?? String(v)))), values };
  });
}

/** The value a pupil gave at a gate by being in `lane` at the split, or null if that lane had no sign (no answer). */
export function gateValue(road: Road, layout: GateLayout, lane: number): number | null {
  const i = road.gates[layout.gate].lanes.indexOf(lane);
  return i < 0 ? null : layout.values[i];
}

/** What each port refills to (a share of FULL), from the answers marked so far: right = all of it, anything else half. */
export function refillsFor(road: Road, answered: Record<string, { right: boolean }> | null | undefined): number[] {
  return road.ports.map((_, p) => (answered?.[String(p)]?.right === true ? 1 : HALF_REFILL));
}

/** One gate as the screen sees it. */
export interface GateSetup {
  slot: number;
  question: PublicQuestion;
  /** What each signed lane shows, left to right (null: no sign). */
  labels: (string | null)[];
  /** The right lane (the screen drives the same physics as the replay). */
  rightLane: number;
}

/** What a go's maths looks like to the screen (null with maths off). Never an answer, apart from each gate's right lane. */
export interface RunMaths {
  ports: PublicQuestion[];
  gates: GateSetup[];
}

export function runMaths(road: Road, seed: string, questions: readonly Question[]): RunMaths {
  return {
    ports: road.ports.map((_, p) => publicQuestion(questions[p], p)),
    gates: gateLayout(road, seed, questions).map((l) => ({ slot: l.slot, question: publicQuestion(questions[l.slot], l.slot), labels: l.labels, rightLane: l.rightLane })),
  };
}

/** A sign's text in pieces to draw: a fraction ("3/4", "1 3/4") stacked, anything else on one line. */
export type SignText = { kind: 'text'; text: string } | { kind: 'fraction'; whole: string | null; top: string; bottom: string };

const FRACTION = /^(?:(\d+) )?(\d+)\/(\d+)$/;

export function signText(label: string): SignText {
  const f = FRACTION.exec(label.trim());
  return f ? { kind: 'fraction', whole: f[1] ?? null, top: f[2], bottom: f[3] } : { kind: 'text', text: label.trim() };
}
