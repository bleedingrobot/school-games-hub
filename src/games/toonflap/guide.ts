/**
 * Toon Flap's guide for new players and its read-aloud lines (docs/TOON-FLAP-PLAN.md, sections 7 and 8).
 *
 * - **Guided first go:** level 1 with a dotted ghost path and Pī's bubbles, for a pupil who has never finished a level (or
 *   who taps "Replay the guide" on the map). Bumps never end a run, so it can't fail. It can be skipped.
 * - **First-time tips:** each level's new thing, said as the level starts. Help fades: Lots (the first 3 finishes of a
 *   level), Some (only the first), Off. The pupil picks on the map; it is kept on this device.
 * - **Bella** (scripts/voice-clips.py toonflap) says only the fixed lines in `allVoiceLines()`. Maths questions and lines
 *   with changing numbers are never read aloud: `voiceLine()` gives null for anything not on the list.
 */
import { LEVELS } from '../../../shared/toonflap/levels';
import type { Medal } from '../../../shared/toonflap/engine';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/toonflap/';

export type HelpSetting = 'lots' | 'some' | 'off';
export const HELP_SETTINGS: { id: HelpSetting; name: string }[] = [
  { id: 'lots', name: 'Lots' },
  { id: 'some', name: 'Some' },
  { id: 'off', name: 'Off' },
];

/** How many finishes of a level still show its tip. */
export const TIP_FINISHES: Record<HelpSetting, number> = { lots: 3, some: 1, off: 0 };

/** Is the tip for this level still shown, after `finishes` finishes of it? */
export const showTip = (help: HelpSetting, finishes: number): boolean => finishes < TIP_FINISHES[help];

/** Pī's lines in the guided first go and the first-time bubbles. */
export const GUIDE = {
  start: 'Tap to flap. Each tap lifts me up.',
  path: 'Follow the dotted path through the gaps.',
  bump: 'Bump! Just 3 seconds. Keep going.',
  check: 'A check! The clock stops. Get it right to take 3 seconds off.',
  rest: 'A rest. Tap to fly on.',
  sign: 'Fly through the right answer for a tailwind.',
  nest: 'You made it to the nest!',
  skipped: 'Guide skipped. You can replay it from the map.',
} as const;

/** Short lines said without a bubble once the guide is done. */
export const SHORT = {
  check: 'Check!',
  bump: 'Bump!',
  nest: 'Nest!',
} as const;

export const MEDAL_LINE: Record<Medal, string> = { gold: 'Gold medal!', silver: 'Silver medal!', bronze: 'Bronze medal!' };

export const RESULT_LINES = {
  newGold: 'A new gold! That flyer is shiny now.',
  newBest: 'New best time!',
  potion: 'You earned a revive potion!',
  flyer: 'You unlocked a new flyer!',
  trail: 'You got a new trail!',
  notChecked: 'That run couldn’t be checked, so it wasn’t saved.',
} as const;

/** Every next-step line the map can show (collection.ts nextStep). */
function nextStepLines(): string[] {
  return [
    `Tap ${LEVELS[0].name} to start.`,
    ...LEVELS.slice(1).map((l) => `Fly ${l.name} next (level ${l.n}).`),
    ...LEVELS.map((l) => `Try for gold on ${l.name}.`),
    'Every level done with gold! Try Sky Dash.',
  ];
}

/** Every line Bella says. A clip each: public/voice/toonflap/<slug>.mp3. */
export function allVoiceLines(): string[] {
  const lines = [
    ...Object.values(GUIDE),
    ...Object.values(SHORT),
    ...LEVELS.map((l) => l.name),
    ...LEVELS.map((l) => l.newThing),
    ...Object.values(MEDAL_LINE),
    ...Object.values(RESULT_LINES),
    ...nextStepLines(),
  ];
  return [...new Set(lines)];
}

let said: Set<string> | null = null;

/** The line itself if Bella has a clip for it, otherwise null (so changing numbers and questions are never read). */
export function voiceLine(text: string): string | null {
  said ??= new Set(allVoiceLines());
  return said.has(text) ? text : null;
}

const HELP_KEY = 'toonflap-help';
const GUIDE_KEY = 'toonflap-guide-skipped';

export function readHelp(): HelpSetting {
  try {
    const v = localStorage.getItem(HELP_KEY);
    return v === 'some' || v === 'off' ? v : 'lots';
  } catch {
    return 'lots';
  }
}

export function saveHelp(help: HelpSetting): void {
  try {
    localStorage.setItem(HELP_KEY, help);
  } catch {
    // Not remembered on this computer; that's fine.
  }
}

/** Was the guide skipped on this device? Then it isn't offered again until "Replay the guide". */
export function guideSkipped(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setGuideSkipped(on: boolean): void {
  try {
    if (on) localStorage.setItem(GUIDE_KEY, '1');
    else localStorage.removeItem(GUIDE_KEY);
  } catch {
    // Not remembered; the guide may show again next time.
  }
}
