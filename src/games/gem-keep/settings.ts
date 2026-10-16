/**
 * The teacher's Gem Keep settings. Phase 5 loads them from the database (app_settings);
 * until then the defaults below are used.
 */
import { MATHS } from '../../../shared/gem-keep/config';
import { TABLES } from '../../../shared/maths/config';

export interface GemKeepSettings {
  /** Calm: the game pauses while a question is up. Challenge: it keeps going at half speed. */
  mode: 'calm' | 'challenge';
  /** Tables left on. The campaign picks tables; this can only switch some off. */
  enabledTables: number[];
  division: boolean;
  /** Undefined: on from campaign level 4. */
  missingFactor?: boolean;
  multipleChoice: boolean;
  /** Right answers out of 10 needed to pass a Level Key. */
  keyPassMark: number;
}

export const DEFAULT_SETTINGS: GemKeepSettings = {
  mode: 'calm',
  enabledTables: [...TABLES],
  division: false,
  multipleChoice: false,
  keyPassMark: MATHS.key.passMark,
};
