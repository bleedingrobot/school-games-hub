import type { BotPictures } from '../../components/BotPortrait';
import chick from './art/bot/very-easy.webp';
import robot from './art/bot/easy.webp';
import kea from './art/bot/medium.webp';

/** The checkers bots (docs/CHECKERS-LOOK-PLAN.md): a pirate crew of a chick, a robot and a kea captain, each holding a counter. */
export const CHECKERS_BOTS: BotPictures = { 'very-easy': chick, easy: robot, medium: kea };
