/**
 * Checking a placement check on the server (docs/MATHS-FOCUS-PLAN.md section 5). The website sends the ten questions it showed
 * and what the student answered. The server asks the same walk where each question should have come from, works each question
 * out from how it was shown (`solveParts`), and only then says where the student starts. The result only says where to start.
 */
import { sameAnswer } from "./banded";
import { PLACEMENT_QUESTIONS } from "./config";
import { cleanParams, solveClaim } from "./claim";
import { LADDER } from "./ladder";
import {
  isQuick,
  placementNext,
  placementResult,
  type PlacementStep,
} from "./place";

/** The most parts a question can have (order of operations is the longest). */
const MAX_QUESTION_PARTS = 12;

export interface PlacementAnswer {
  skill: string;
  parts: string[];
  /** The record the question counts towards and the numbers it was made from, so the server can make it again (claim.ts). */
  key?: string;
  params?: number[];
  answer: number;
  /** How long it took, in milliseconds. */
  ms: number;
}

/** True if this looks like a placement answer; anything else is thrown away. */
export function parsePlacementAnswers(raw: unknown): PlacementAnswer[] | null {
  if (!Array.isArray(raw) || raw.length !== PLACEMENT_QUESTIONS) return null;
  const out: PlacementAnswer[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return null;
    const { skill, parts, answer, ms, key, params } = r as Record<string, unknown>;
    if (key !== undefined && (typeof key !== "string" || key.length > 51)) return null;
    if (params !== undefined && !cleanParams(params)) return null;
    if (
      typeof skill !== "string" ||
      !Array.isArray(parts) ||
      !parts.every((p) => typeof p === "string") ||
      parts.length > MAX_QUESTION_PARTS
    )
      return null;
    if (
      typeof answer !== "number" ||
      !Number.isFinite(answer) ||
      typeof ms !== "number" ||
      !Number.isFinite(ms)
    )
      return null;
    out.push({
      skill,
      parts: parts as string[],
      answer,
      ms: Math.max(0, ms),
      ...(typeof key === "string" ? { key } : {}),
      ...(params ? { params: params as number[] } : {}),
    });
  }
  return out;
}

/** The skill to start at, or null if the answers can't be a placement check for this year level. */
export function checkPlacement(
  yearLevel: number | null,
  answers: readonly PlacementAnswer[],
): string | null {
  const steps: PlacementStep[] = [];
  for (const a of answers) {
    const expected = placementNext(yearLevel, steps);
    if (!expected || expected.id !== a.skill) return null;
    const solved = solveClaim(a);
    if (!solved || !solved.keys.some((k) => expected.keys.includes(k)))
      return null;
    const correct = sameAnswer(a.answer, solved.answer);
    steps.push({ skill: a.skill, correct, quick: correct && isQuick(a.ms, expected) });
  }
  if (placementNext(yearLevel, steps) !== null) return null;
  return placementResult(steps).id;
}

/** True for a skill the placement can start a student at. */
export const isStartSkill = (id: string) =>
  LADDER.some((s) => s.id === id && s.built);
