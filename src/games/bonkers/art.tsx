/**
 * Smash Quest's painted pictures (docs/BONKERS-ART-PLAN.md, scripts/game_art.py, tidied into ./art/paint/). Any picture
 * not painted yet falls back to its emoji, so the game works either way. Only the addresses are bundled.
 */
import type { HeroClass, Look } from '../../../shared/bonkers/content';

const FILES = import.meta.glob('./art/paint/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export const paint = (path: string): string | undefined => FILES[`./art/paint/${path}.webp`];

const CLASS_FILE: Record<HeroClass, string> = { knight: 'kitchen-knight', dazzler: 'disco-dazzler', granny: 'pirate-granny', ninja: 'bin-ninja' };

/** The hero's look grows with the level: 1-2, 3-5, 6-8, 9-10. */
export const heroBand = (level: number) => (level >= 9 ? 4 : level >= 6 ? 3 : level >= 3 ? 2 : 1);
export const heroArt = (cls: HeroClass, look: Look, level: number) => paint(`heroes/${CLASS_FILE[cls]}-${look}-${heroBand(level)}`);

/** Trainers in level order (content.ts TRAINERS). */
const TRAINER_FILES = ['coach-crumpet', 'sir-reginald', 'madame-moustache', 'captain-custard', 'professor-pickle', 'great-gazebo', 'lady-lasagne', 'baron-bubblewrap', 'king-kevin'];
export const trainerArt = (toLevel: number) => paint(`trainers/${TRAINER_FILES[toLevel - 2] ?? ''}`);

export const monsterArt = (id: string) => paint(`monsters/${id}`);
/** The small copy, for the quest cards. */
export const zoneArt = (id: string) => paint(`zones/${id}-800`) ?? paint(`zones/${id}`);
/** The full-size painting, for a fight filling the window. */
export const zoneBigArt = (id: string) => paint(`zones/${id}`) ?? paint(`zones/${id}-800`);
export const gearArt = (id: string) => paint(`gear/${id}`);

const BOSS_FILES: Record<string, string> = {
  'Captain Lost Property': 'captain-lost-property', 'The Lunchbox Lurker': 'lunchbox-lurker', 'Sir Squeaks-a-Lot': 'sir-squeaks-a-lot',
  'The Glitter Gremlin': 'glitter-gremlin', 'The Mega Mess Monster': 'mega-mess-monster', 'Queen Puddle-Splash': 'queen-puddle-splash',
  'The Infinite Homework Hydra': 'homework-hydra',
};
export const bossArt = (name: string) => paint(`bosses/${BOSS_FILES[name] ?? ''}`);
export const grannyArt = () => paint('people/granny-jetpack');
export const chestArt = (open: boolean) => paint(`ui/chest-${open ? 'open' : 'closed'}`);
export const homeArt = () => paint('scenes/home') ?? paint('scenes/home-800');
/** The stage the heroes are picked on (Home's painting until it's painted). */
export const heroPickArt = () => paint('scenes/heropick') ?? homeArt();

/** A painted picture sized by the font size around it (like the emoji it replaces), or the emoji if not painted yet. */
export function Pic({ src, emoji, className }: { src: string | undefined; emoji: string; className?: string }) {
  return src
    ? <img className={`bq-pic${className ? ` ${className}` : ''}`} src={src} alt="" draggable={false} />
    : <>{emoji}</>;
}

/** The sticker shop's hats and pets (ids like 'hat-viking', 'pet-hamster'). */
export const shopArt = (id: string) => paint(`${id.startsWith('hat-') ? 'hats' : 'pets'}/${id.slice(4)}`);
