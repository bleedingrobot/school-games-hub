/**
 * What the game servers tell the database about answers given while a maths focus ran (docs/MATHS-FOCUS-PLAN.md, "Stage F.8
 * results"). The database matches each answer to the focuses that were running at its time; the server works out the two
 * things only the maths code knows: which ladder skills own the answer's key, and whether it was quick.
 */
import { quickMsForPack } from './config';
import type { FactAnswer } from './leitner';
import { LADDER } from './ladder';

/** One answer, as add_maths_focus_results takes it. */
export interface FocusResultAnswer {
  skills: string[];
  /** Milliseconds since 1970. */
  at: number;
  correct: boolean;
  /** Right, and within the pack's quick time. */
  quick: boolean;
}

let owners: Map<string, string[]> | null = null;

/** The ladder skills that own a mastery key (usually one). Empty if the key isn't on the ladder. */
export function skillsOfKey(key: string): string[] {
  if (!owners) {
    owners = new Map();
    for (const skill of LADDER) {
      for (const k of skill.keys) owners.set(k, [...(owners.get(k) ?? []), skill.id]);
    }
  }
  return owners.get(key) ?? [];
}

/** The answers worth sending: those on a ladder skill. */
export function focusResultAnswers(answers: readonly FactAnswer[], pack: string): FocusResultAnswer[] {
  const quickMs = quickMsForPack(pack);
  const out: FocusResultAnswer[] = [];
  for (const a of answers) {
    const skills = skillsOfKey(a.key);
    if (skills.length > 0) out.push({ skills, at: a.at, correct: a.correct, quick: a.correct && a.ms <= quickMs });
  }
  return out;
}
