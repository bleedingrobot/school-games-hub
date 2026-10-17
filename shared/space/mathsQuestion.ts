/**
 * Which question Mission Control asks next: the same choice in the bot game (the browser) and
 * with classmates (the server), from a student's records at the step they're ready for.
 */
import { readyLevel } from '../maths/selector';
import type { Question } from '../maths/skillPack';
import type { TimesTables } from '../maths/skillPacks/timesTables';

/** The teacher's question settings (the Gem Keep settings, shared with Wormholes & Black Holes). */
export interface MathsQuestionSettings {
  enabledTables?: number[];
  division?: boolean;
  missingFactor?: boolean;
  multipleChoice?: boolean;
}

export function pickSpaceQuestion(pack: TimesTables, settings: MathsQuestionSettings = {}): Question | null {
  return (
    pack.nextQuestion({
      level: readyLevel(pack.stats(), settings.enabledTables),
      enabledTables: settings.enabledTables,
      division: settings.division,
      missingFactor: settings.missingFactor,
      multipleChoice: settings.multipleChoice,
    }) ?? pack.nextQuestion({ level: 1 })
  );
}
