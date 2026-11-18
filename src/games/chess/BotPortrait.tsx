import type { BotLevel } from '../types';
import chick from './art/bot/very-easy.webp';
import robot from './art/bot/easy.webp';
import wizard from './art/bot/medium.webp';

/** The painted bots (docs/CHESS-LOOK-PLAN.md stage 5): a chick, a robot and a wizard, each holding a chess piece. */
const PORTRAITS: Record<BotLevel, string> = { 'very-easy': chick, easy: robot, medium: wizard };

/**
 * A bot's painted portrait. `big` is the start screen's one, which pops in each time the level changes and then
 * bounces gently; the small one sits in the player card, and bobs with thought bubbles while the bot is thinking.
 */
export function BotPortrait({ level, big = false, thinking = false }: { level: BotLevel; big?: boolean; thinking?: boolean }) {
  return (
    <span className={`bot-pic bot-pic--${level}${big ? ' bot-pic--big' : ''}${thinking ? ' is-thinking' : ''}`} aria-hidden="true">
      <img src={PORTRAITS[level]} alt="" draggable={false} />
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
