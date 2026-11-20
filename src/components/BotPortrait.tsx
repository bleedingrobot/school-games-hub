import type { BotLevel } from '../games/types';
import './botPortrait.css';

/** One painted picture per bot level: chess's chick, robot and wizard, or checkers' pirate crew. */
export type BotPictures = Record<BotLevel, string>;

/**
 * A bot's painted portrait. `big` is the start screen's one, which pops in each time the level changes and then
 * bounces gently; the small one sits in the player card, and bobs with thought bubbles while the bot is thinking.
 */
export function BotPortrait({
  pictures,
  level,
  big = false,
  thinking = false,
}: {
  pictures: BotPictures;
  level: BotLevel;
  big?: boolean;
  thinking?: boolean;
}) {
  return (
    <span className={`bot-pic bot-pic--${level}${big ? ' bot-pic--big' : ''}${thinking ? ' is-thinking' : ''}`} aria-hidden="true">
      <img src={pictures[level]} alt="" draggable={false} />
      {thinking && (
        <span className="bot-pic__dots">
          <i />
          <i />
          <i />
        </span>
      )}
    </span>
  );
}
