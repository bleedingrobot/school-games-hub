/**
 * A student's place on the ladder (docs/MATHS-FOCUS-PLAN.md section 5). Two things set the floor under it:
 *  - the placement check (about 10 questions that jump up while they answer right and quickly and step back when they don't);
 *  - the furthest place they have ever reached, kept on the server so it only ever moves forward.
 * Without either, a student starts at the first skill. A class's year level plays no part (it is only a label for the teacher).
 * Skills before the floor count as passed. Forgetting ×7 gives more ×7 review, but never drops the place.
 *
 * The server keeps the furthest place and the placement; the database cannot see the ladder, so the server functions that save
 * answers work the place out with this file (`placeToStore`) and the database only checks that it never goes back.
 */
import { PLACEMENT_JUMP, PLACEMENT_QUESTIONS, quickMsForPack } from "./config";
import type { FactStats } from "./leitner";
import {
  LADDER,
  ladderProgress,
  packIdOfKey,
  questionForKey,
  type LadderOptions,
  type LadderProgress,
  type LadderSkill,
} from "./ladder";
import type { Question } from "./skillPack";

/** What the database tells a game about a student's ladder. Anything odd counts as "auto is off". */
export interface LadderInfo {
  /** The class has "Games pick the maths (auto)" switched on. */
  on: boolean;
  /** Placement: 'done' (with `placement` saying where to start), 'skipped', or not yet. */
  placed: "done" | "skipped" | null;
  placement: string | null;
  /** The furthest skill they have reached. */
  furthest: string | null;
}

export const NO_LADDER: LadderInfo = {
  on: false,
  placed: null,
  placement: null,
  furthest: null,
};

const ID = /^[a-z0-9-]{1,40}$/;
const skillId = (v: unknown) =>
  typeof v === "string" &&
  ID.test(v) &&
  LADDER.some((s) => s.id === v && s.built)
    ? v
    : null;

export function parseLadderInfo(raw: unknown): LadderInfo {
  if (!raw || typeof raw !== "object") return NO_LADDER;
  const r = raw as Record<string, unknown>;
  const placement = skillId(r.placement);
  const placed =
    r.placed === "skipped"
      ? "skipped"
      : r.placed === "done" && placement
        ? "done"
        : null;
  return {
    on: r.on === true,
    placed,
    placement: placed === "done" ? placement : null,
    furthest: skillId(r.furthest),
  };
}

const builtSkills = () => LADDER.filter((s) => s.built);
const indexOfSkill = (id: string | null) =>
  id ? LADDER.findIndex((s) => s.id === id) : -1;

/** The floor under a student's place: an index into `LADDER`. */
export function floorRank(info: LadderInfo): number {
  const start = info.placed === "done" ? indexOfSkill(info.placement) : -1;
  return Math.max(0, start, indexOfSkill(info.furthest));
}

/** The student's place on the ladder, with the floor applied. */
export function placeProgress(
  stats: Iterable<FactStats>,
  info: LadderInfo,
  opts: LadderOptions = {},
): LadderProgress {
  return ladderProgress(stats, { ...opts, floor: floorRank(info) });
}

/** The furthest place to keep: where they are now, or the last built skill once all of them are secure. */
export function placeToStore(
  stats: Iterable<FactStats>,
  info: LadderInfo,
  opts: LadderOptions = {},
): { skill: string; rank: number } | null {
  const progress = placeProgress(stats, info, opts);
  const skill = progress.current ?? builtSkills().at(-1) ?? null;
  return skill ? { skill: skill.id, rank: LADDER.indexOf(skill) } : null;
}

// ---------------------------------------------------------------- the placement check

/** One answer in the placement check. `skill` is the ladder skill the question was asked from. */
export interface PlacementStep {
  skill: string;
  correct: boolean;
  /** Right and within the quick time. */
  quick: boolean;
}

/**
 * Where the check goes next, given the answers so far: the skill to ask about, or null when it is finished.
 * It starts at the first skill and moves up three skills (`PLACEMENT_JUMP`) after a right, quick answer (one after it has missed
 * once) and back one when the answer is wrong or slow. All steps are over the built skills only.
 */
export function placementNext(
  steps: readonly PlacementStep[],
): LadderSkill | null {
  const built = builtSkills();
  const top = built.length - 1;
  let level = 0;
  let jump = PLACEMENT_JUMP;
  for (const step of steps) {
    if (step.correct && step.quick) level = Math.min(top, level + jump);
    else {
      level = Math.max(0, level - 1);
      jump = 1;
    }
  }
  return steps.length >= PLACEMENT_QUESTIONS ? null : built[level];
}

/** Where to start: just below the highest skill they answered right and quickly. A student who got nothing right starts at the first skill. */
export function placementResult(steps: readonly PlacementStep[]): LadderSkill {
  const built = builtSkills();
  let best = -1;
  for (const step of steps) {
    const at = built.findIndex((s) => s.id === step.skill);
    if (step.correct && step.quick && at > best) best = at;
  }
  return built[Math.max(0, best - 1)];
}

/** A question for the placement check about a ladder skill (a random fact from it; division is left out). */
export function placementQuestion(
  skill: LadderSkill,
  id: number,
  random: () => number = Math.random,
  avoid: readonly string[] = [],
): Question | null {
  const keys = skill.keys.filter((k) => !k.startsWith("div:"));
  const fresh = keys.filter((k) => !avoid.includes(k));
  const pool = fresh.length ? fresh : keys;
  if (pool.length === 0) return null;
  return questionForKey(pool[Math.floor(random() * pool.length)], id, random);
}

/** Quick enough for the skill: its records' own quick time (a rounding or order-of-operations question gets longer than a fact). */
export const isQuick = (ms: number, skill?: LadderSkill | null) => ms <= quickMsForPack(skill?.keys[0] ? packIdOfKey(skill.keys[0]) : null);
