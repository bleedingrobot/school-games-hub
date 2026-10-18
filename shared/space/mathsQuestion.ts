/**
 * Which question Mission Control asks next: the same choice in the bot game (the browser) and
 * with classmates (the server), from a student's records.
 *
 * With no maths focus it is the times-table step the student is ready for, as it has always been.
 * With a focus (a teacher's, or the student's own: shared/maths/focus.ts) it is that focus.
 */
import { hasFocus, makeFocusPack, type MathsFocus } from '../maths/focus';
import type { FactStats } from '../maths/leitner';
import { readyLevel } from '../maths/selector';
import type { Question, SkillPack } from '../maths/skillPack';
import { TimesTables } from '../maths/skillPacks/timesTables';

/** The teacher's question settings (the Gem Keep settings, shared with Wormholes & Black Holes). */
export interface MathsQuestionSettings {
  enabledTables?: number[];
  division?: boolean;
  missingFactor?: boolean;
  multipleChoice?: boolean;
}

/** The pack a game keeps for a visit: all the student's records, asking the focus if there is one. */
export function makeSpacePack(
  facts: FactStats[],
  focus: MathsFocus | null | undefined,
  settings: MathsQuestionSettings = {},
  random?: () => number,
  now?: () => number,
): SkillPack {
  return makeFocusPack(facts, focus, { enabledTables: settings.enabledTables, division: settings.division }, random, now);
}

export function pickSpaceQuestion(pack: SkillPack, settings: MathsQuestionSettings = {}): Question | null {
  const ctx = {
    enabledTables: settings.enabledTables,
    division: settings.division,
    missingFactor: settings.missingFactor,
    multipleChoice: settings.multipleChoice,
  };
  if (pack instanceof TimesTables) {
    return pack.nextQuestion({ level: readyLevel(pack.stats(), settings.enabledTables), ...ctx }) ?? pack.nextQuestion({ level: 1 });
  }
  // A focus. If it names nothing the teacher's tables allow, fall back to the times-table step, so a question always comes.
  // (The answer is recorded in the focus pack, which keeps every times-table record too.)
  return pack.nextQuestion(ctx) ?? new TimesTables().nextQuestion({ level: 1 });
}

/** True when this pack is following a focus (so a game can tell the student why). */
export const followsFocus = (focus: MathsFocus | null | undefined) => hasFocus(focus);
