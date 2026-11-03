/**
 * How much Pip helps (docs/ISLES-PLAN.md, section 6.7): Lots on the first day, then Some, and the pupil can choose
 * Lots, Some or Off in How to play. And Pip's first-time tips: a closable bubble the first time something new happens.
 * Both are kept in this browser only: they're conveniences, and losing them just brings the help back.
 *
 *   Lots  Pip's next step with "Show me", and the first-time tips.
 *   Some  Pip's next step only.
 *   Off   Pip only says when the island is resting.
 */
import { TURNS_PER_DAY } from '../../../shared/isles/config';
import { hasGarden, type Island, type TurnReport } from '../../../shared/isles/engine';

export type Help = 'lots' | 'some' | 'off';
export const HELP_NAMES: Record<Help, string> = { lots: 'Lots', some: 'Some', off: 'Off' };
const HELP_KEY = 'isles-help';
const TIPS_KEY = 'isles-tips-seen';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A private window can refuse: the help just comes back next time.
  }
}

/** The pupil's choice, or Lots for their first day's turns and Some after that. */
export function helpFor(island: Island | null): Help {
  const chosen = read(HELP_KEY);
  if (chosen === 'lots' || chosen === 'some' || chosen === 'off') return chosen;
  return !island || island.turn < TURNS_PER_DAY ? 'lots' : 'some';
}
export const saveHelp = (help: Help) => write(HELP_KEY, help);

/** Pip's first-time tips, each shown once. */
export const TIPS = {
  rainbow: 'A rainbow! Rainbows bring sky crystals. Crystals raise buildings to level 3 and build the Sky Lighthouse.',
  geese: 'Golden geese drop coins as they fly over. The weather in the sky is only ever good.',
  traveller: 'Lost travellers move in when there is room. More Houses make more room.',
  breeze: 'A warm breeze gives your boat extra speed in your next Sky Race. It lasts until you race.',
  gift: 'Classmates can leave you gifts. You can leave them one too: open the Class sky and visit an island.',
  race: 'Win or lose, nobody loses anything in a Sky Race. Each right answer is a gust of wind for your boat.',
  lighthouse: 'Each stage makes the Sky Lighthouse taller. Build all 4 stages to light it!',
  garden: 'Your Lighthouse is lit, and a sky garden floated by! It has more places for decorations.',
} as const;
export type Tip = keyof typeof TIPS;

export function seenTips(): Tip[] {
  try {
    const list = JSON.parse(read(TIPS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((t): t is Tip => typeof t === 'string' && t in TIPS) : [];
  } catch {
    return [];
  }
}
export const markTipSeen = (tip: Tip) => write(TIPS_KEY, JSON.stringify([...new Set([...seenTips(), tip])]));

/** The first tip that fits what just happened and hasn't been seen yet (null: none). */
export function tipNow(island: Island, report: TurnReport | undefined, gotPost: boolean, seen: Tip[]): Tip | null {
  const fits: Tip[] = [];
  if (gotPost) fits.push('gift');
  if (report?.weather) fits.push(report.weather);
  if (island.racesToday > 0 || island.racesWon > 0) fits.push('race');
  if (hasGarden(island)) fits.push('garden');
  if (island.lighthouse > 0) fits.push('lighthouse');
  return fits.find((t) => !seen.includes(t)) ?? null;
}
