/**
 * Which bond the picker suggests (docs/BOND-MATCH-PLAN.md section 7, stage M.5). Read only: it looks at the student's maths focus
 * and ladder place, as `my_ladder()` already gives them, and never writes anything maths-related. Bond Match is never evidence for
 * the ladder (James, 19 and 20 Oct 2026).
 *
 * - A focus (a teacher's, or the student's own) on a skill with a bond set: the picker opens on that bond.
 * - No focus, and the class has auto on: the bond for the student's place on the ladder is marked "Good for you now".
 * - Otherwise nothing: the picker is exactly as before.
 */
import { LADDER } from '../../../shared/maths/ladder';
import { currentFocus, hasFocus, isTeacherFocus } from '../../../shared/maths/focus';
import { placeProgress } from '../../../shared/maths/place';
import type { FactStats } from '../../../shared/maths/leitner';
import type { MyLadder } from '../../data/ladder';

/** A bond set, and (for all but the last in a skill's list) the question type that says it's known well enough to move on. */
interface Step {
  bond: string;
  /** When this record is in box 2 or higher, the next bond in the list is suggested instead. */
  movesOnAt?: string;
}

/** Ladder skill → the bond sets that practise it, easiest first. Skills not listed have no bond set. */
export const SKILL_BONDS: Readonly<Record<string, readonly Step[]>> = {
  'facts-10': [{ bond: 'whole-10' }],
  'facts-20': [{ bond: 'whole-20' }],
  'bonds-100': [{ bond: 'whole-100-tens', movesOnAt: 'bond100:tens' }, { bond: 'whole-100-any' }],
  'bonds-1000': [{ bond: 'whole-1000-hundreds', movesOnAt: 'bond1000:hundreds' }, { bond: 'whole-1000-tens' }],
  // Tenths to make 1 is one of this skill's question types (addten:to-one).
  'add-tenths': [{ bond: 'decimal-1-tenths' }],
};

export type SuggestWhy = 'teacher' | 'own' | 'auto';

export interface BondSuggestion {
  bondId: string;
  why: SuggestWhy;
}

const SECURE_BOX = 2;

function bondFor(skillId: string, facts: readonly FactStats[]): string | null {
  const steps = SKILL_BONDS[skillId];
  if (!steps) return null;
  const box = (key: string) => facts.find((f) => f.key === key)?.box ?? 0;
  return (steps.find((s) => !s.movesOnAt || box(s.movesOnAt) < SECURE_BOX) ?? steps[steps.length - 1]).bond;
}

/** The bond to open on, or null for none. `ladder` is what `my_ladder()` said (null when it couldn't be read). */
export function suggestBond(ladder: MyLadder | null, now: Date = new Date()): BondSuggestion | null {
  if (!ladder) return null;
  const focus = currentFocus(ladder.focus, now);
  const info = focus.ladder;
  if (hasFocus(focus)) {
    // The first focus skill, in ladder order, that has a bond set. A focus with none (times tables) suggests nothing: auto is off while a focus runs.
    const wanted = new Set(focus.skills);
    for (const skill of LADDER) {
      const bondId = wanted.has(skill.id) ? bondFor(skill.id, ladder.facts) : null;
      if (bondId) return { bondId, why: isTeacherFocus(focus) ? 'teacher' : 'own' };
    }
    return null;
  }
  if (!info?.on) return null;
  // The bond skill at the student's place, or the last one below it (the hardest bonds they've reached).
  const current = placeProgress(ladder.facts, info, ladder.settings).current;
  const at = current ? LADDER.findIndex((s) => s.id === current.id) : LADDER.length - 1;
  for (let i = at; i >= 0; i--) {
    const bondId = bondFor(LADDER[i].id, ladder.facts);
    if (bondId) return { bondId, why: 'auto' };
  }
  return null;
}
