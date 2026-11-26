/**
 * Help me on the teacher's Progress tab (docs/plans/help-me/PLAN.md H9): pupils who opened Help me on a maths question in the
 * last few days. Those answers never count towards the ladder; this only shows who is leaning on help, and where.
 */
import { LADDER } from '../../shared/maths/ladder';
import { supabase } from '../lib/supabase';

export interface HelpPupil {
  id: string;
  name: string;
  realName: string;
  /** Answers given after opening Help me. */
  helped: number;
  /** How many of those were right. */
  right: number;
  /** School days with help used. */
  days: number;
  /** The question records they asked help on most (up to 3). */
  topKeys: string[];
  lastAt: string | null;
}

export async function fetchHelpUses(classId: string, days = 7): Promise<HelpPupil[]> {
  const { data, error } = await supabase.rpc('teacher_help_uses', { target_class: classId, days });
  if (error || !Array.isArray(data)) throw new Error(error?.message ?? 'We couldn’t load Help me.');
  return data as HelpPupil[];
}

let skillOf: Map<string, string> | null = null;

/** The ladder skill a question record belongs to ("Times tables: 7s"), or the record itself if it isn't on the ladder. */
export function skillName(key: string): string {
  if (!skillOf) {
    skillOf = new Map();
    for (const skill of LADDER) for (const k of skill.keys) if (!skillOf.has(k)) skillOf.set(k, skill.label);
  }
  return skillOf.get(key) ?? key;
}
