/**
 * Reads what the database sends about a student's ladder (`space_maths_context`: records, question settings and focus) into the
 * pieces the ladder code wants.
 */
import { parseFocus, ladderOf } from './focus';
import type { LadderOptions } from './ladder';
import type { FactStats } from './leitner';
import { placeToStore, type LadderInfo } from './place';

export interface LadderContext {
  facts: FactStats[];
  settings?: { enabledTables?: number[]; division?: boolean } | null;
  focus?: unknown;
}

export function ladderOfContext(context: LadderContext): { facts: FactStats[]; info: LadderInfo; opts: LadderOptions } {
  return {
    facts: Array.isArray(context.facts) ? context.facts : [],
    info: ladderOf(parseFocus(context.focus)),
    opts: { enabledTables: context.settings?.enabledTables, division: context.settings?.division },
  };
}

export { placeToStore };
