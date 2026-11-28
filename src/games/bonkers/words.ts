import { CLASS_INFO, INNKEEPER, LEVEL_TITLES, trainerFor, zoneById, type HeroClass } from '../../../shared/bonkers/content';
import { questTarget, trainerReady, type Progress, type Quest } from '../../../shared/bonkers/engine';
import { MAX_LEVEL } from '../../../shared/bonkers/config';

/** "Win 4 of 5 fights in Laundry Swamp" and its short title. */
export function questWords(q: Quest): { title: string; what: string } {
  const zone = zoneById(q.zone);
  const where = zone?.name ?? 'the wilds';
  if (q.kind === 'big') return { title: `Smash the big one`, what: `${q.fights} fights in ${where}, and ${zone?.big.name ?? 'a big monster'} waits at the end!` };
  if (q.kind === 'hunt') {
    const mon = zone?.monsters[q.monster];
    return { title: `${mon?.name ?? 'Monster'} hunt`, what: `Smash ${questTarget(q)} ${mon?.name ?? 'monsters'} in ${where} (${q.fights} fights).` };
  }
  return { title: `Wild wander`, what: `Win ${questTarget(q)} of ${q.fights} fights in ${where}.` };
}

export const levelTitle = (level: number) => LEVEL_TITLES[level] ?? '';

/**
 * Experience (XP) on screen (James, 28 Nov 2026: "dont like the stars - just use experience"): the rules still count
 * `stars`, and the screens show each one as this much XP.
 */
export const XP_PER_STAR = 10;
export const xp = (stars: number) => stars * XP_PER_STAR;

/**
 * Everything Granny Jetpack says, word for word, so Bella can read each line from its own clip (voiceLines.ts). No line
 * has a number that changes, so the clips stay a short list.
 */
export const GRANNY = {
  welcome: `Welcome home, dearie! I’m ${INNKEEPER.name}. Pick your hero!`,
  pick: `Welcome home! I’m ${INNKEEPER.name}. Pick your hero, dearie. You keep them all season!`,
  newLook: 'A new look? Lovely! Your class stays the same all season.',
  legend: 'Level 10! You’re a Smash Legend. The mega boss is coming soon…',
  doneToday: 'That’s today’s adventure done. Have a cuppa and come back next school day!',
  firstQuest: 'Pick a quest, dearie. Your hero smashes away, and every right answer is a MEGA smash!',
  trainerReady: (trainer: string) => `Your XP bar is full! ${trainer} is waiting after your next adventure’s fights.`,
  fillBar: (trainer: string) => `Fill your XP bar and ${trainer} will see you. Pick a quest!`,
  trainerHere: 'Your XP bar is full, so your trainer wants a fight! Beat them to go up a level.',
  // The first adventure explains each step as it comes (plan, guide for new players).
  tipSmash: 'Your hero smashes all by themselves! Now answer the question for a giant boosted smash.',
  tipSpecial: 'See your special move? Use it once a fight for an extra big smash!',
  tipWon: 'You won! Every win gives you XP. Fill the bar and a trainer comes to test you.',
  tipLost: 'Oof! A wrong answer lets the monster smash back. Never mind, on to the next one!',
  tipChest: 'Adventure over! Open the chest to see what you got.',
  tipResults: 'Spend your stickers on hats and pets in the shop. See you next school day!',
};

/** Granny Jetpack's one-line next step at home. */
export function grannySays(p: Progress, waiting: number | null): string {
  if (!p.hero) return GRANNY.welcome;
  if (p.level >= MAX_LEVEL) return GRANNY.legend;
  const t = trainerFor(p.level);
  if (trainerReady(p)) return GRANNY.trainerReady(t?.name ?? 'Your trainer');
  if (waiting === 0) return GRANNY.doneToday;
  if (p.stats.adventures === 0) return GRANNY.firstQuest;
  return GRANNY.fillBar(t?.name ?? 'your trainer');
}

export const moveName = (cls: HeroClass) => CLASS_INFO[cls].move.name;
