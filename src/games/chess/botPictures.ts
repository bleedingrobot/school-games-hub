import type { BotPictures } from '../../components/BotPortrait';
import chick from './art/bot/very-easy.webp';
import robot from './art/bot/easy.webp';
import wizard from './art/bot/medium.webp';

/** The chess bots (docs/CHESS-LOOK-PLAN.md stage 5): a chick, a robot and a wizard, each holding a chess piece. */
export const CHESS_BOTS: BotPictures = { 'very-easy': chick, easy: robot, medium: wizard };
