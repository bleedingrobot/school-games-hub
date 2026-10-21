/** Words the Archery Challenge screens show (docs/ARCHERY-PLAN.md, section 3). Numbers come from the config. */
import { WORLD_WIND_MAX } from '../../../shared/archery/config';
import type { BotLevel } from '../../../shared/archery/bot';
import type { WorldId } from '../../../shared/archery/types';

export const WORLD_NAMES: Record<WorldId, string> = { forest: 'Forest', desert: 'Desert', snow: 'Snow', city: 'City' };

/** Each world's twist, in one line (shown on its button and when a fight starts). */
export const WORLD_HINTS: Record<WorldId, string> = {
  forest: `Trees stop arrows until you blast them away. Gentle wind (up to ${WORLD_WIND_MAX.forest}).`,
  desert: `Sand slides after a blast. Strong wind (up to ${WORLD_WIND_MAX.desert}).`,
  snow: 'Slippery! Land on a slope and you slide. Ice blocks bounce arrows once.',
  city: 'Buildings are tough: blasts only chip them, so you can hide behind them.',
};

/** The bot's name ("Bolt" is a placeholder until James and the pupil choose). */
export const BOT_NAME = 'Bolt';

export const LEVEL_NAMES: Record<BotLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** The wind in words, for screen readers: "Wind 6 to the right", "No wind". */
export function windWords(wind: number): string {
  if (wind === 0) return 'No wind';
  return `Wind ${Math.abs(wind)} to the ${wind > 0 ? 'right' : 'left'}`;
}
