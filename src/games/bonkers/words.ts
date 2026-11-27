import { CLASS_INFO, INNKEEPER, LEVEL_TITLES, trainerFor, zoneById, type HeroClass } from '../../../shared/bonkers/content';
import { questTarget, starsToTrainer, trainerReady, type Progress, type Quest } from '../../../shared/bonkers/engine';
import { MAX_LEVEL } from '../../../shared/bonkers/config';

/** "Win 4 of 5 fights in Laundry Swamp" and its short title. */
export function questWords(q: Quest): { title: string; what: string } {
  const zone = zoneById(q.zone);
  const where = zone?.name ?? 'the wilds';
  if (q.kind === 'big') return { title: `Bonk the big one`, what: `${q.fights} fights in ${where}, and ${zone?.big.name ?? 'a big monster'} waits at the end!` };
  if (q.kind === 'hunt') {
    const mon = zone?.monsters[q.monster];
    return { title: `${mon?.name ?? 'Monster'} hunt`, what: `Bonk ${questTarget(q)} ${mon?.name ?? 'monsters'} in ${where} (${q.fights} fights).` };
  }
  return { title: `Wild wander`, what: `Win ${questTarget(q)} of ${q.fights} fights in ${where}.` };
}

export const levelTitle = (level: number) => LEVEL_TITLES[level] ?? '';

/** Granny Jetpack's one-line next step at the inn. */
export function grannySays(p: Progress, waiting: number | null): string {
  if (!p.hero) return `Welcome to the Wobbly Inn, dearie! I’m ${INNKEEPER.name}. Pick your hero!`;
  if (p.level >= MAX_LEVEL) return 'Level 10! You’re Totally Bonkers. The mega boss is coming soon…';
  const t = trainerFor(p.level);
  if (trainerReady(p)) return `Your star bar is full! ${t?.name ?? 'Your trainer'} is waiting after your next adventure’s fights.`;
  if (waiting === 0) return 'That’s today’s adventure done. Have a cuppa and come back next school day!';
  const left = starsToTrainer(p.level) - p.stars;
  if (p.stats.adventures === 0) return 'Pick a quest, dearie. Every right answer is a big bonk!';
  return `${left} more stars and ${t?.name ?? 'your trainer'} will see you. Pick a quest!`;
}

export const moveName = (cls: HeroClass) => CLASS_INFO[cls].move.name;
