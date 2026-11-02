/**
 * The next-step line (docs/DIAMOND-PLAN.md, section 8): one short sentence with real names and numbers, and the button
 * it means, worked out fresh from the pupil's progress. Words a 9-year-old reads easily. Never about the maths itself.
 */
import { GEMS, LAST_LEVEL, levelSpec } from './config';
import { levelsOpen, nzDate, type Player } from './progress';
import { BUYABLE, priceOf, weekNumber, weeklySpecial } from './workshop';

export type StepButton = 'play' | 'replay' | 'workshop';

export interface NextStep {
  text: string;
  button: StepButton;
  /** The level the button starts, for Play and Replay. */
  level?: number;
}

function passLine(level: number): string {
  const spec = levelSpec(level);
  return level === LAST_LEVEL
    ? `Level ${level}: catch the Heart Diamond in ${spec.seconds} seconds`
    : `Pass level ${level}: bank ${spec.target} gem coins in ${spec.seconds} seconds`;
}

/** The first gem kind on a passed level that isn't in the Gem Book yet, and the level it's new on. */
function missingGem(p: Player): { name: string; level: number } | null {
  for (let i = 0; i < Math.min(p.deepest, GEMS.length); i++) {
    if (!p.gemBook[GEMS[i].id]) return { name: GEMS[i].name, level: i + 1 };
  }
  return null;
}

export function nextStep(p: Player, now: Date): NextStep {
  const open = levelsOpen(p, now);
  if (open.next !== null && open.nextOpen) {
    if (open.next === 1 && p.lifetime.plays === 0) return { text: `Press Play to start! ${passLine(1)}.`, button: 'play', level: 1 };
    return { text: `${passLine(open.next)}.`, button: 'play', level: open.next };
  }
  const first = open.next !== null ? `Level ${open.next} opens tomorrow. ` : '';
  const gap = missingGem(p);
  if (gap) return { text: `${first}Replay level ${gap.level} to find the ${gap.name} you're missing.`, button: 'replay', level: gap.level };
  const week = weekNumber(nzDate(now));
  const special = weeklySpecial(week);
  if (!p.owned.includes(special.id) && p.coins >= priceOf(special, week)) {
    return { text: `You have ${p.coins} coins, and ${special.name} is on special this week!`, button: 'workshop' };
  }
  const cheapest = BUYABLE.filter((it) => !p.owned.includes(it.id)).sort((a, b) => priceOf(a, week) - priceOf(b, week))[0];
  if (cheapest && p.coins >= priceOf(cheapest, week)) {
    return { text: `You have ${p.coins} coins: enough for ${cheapest.name} in the Workshop.`, button: 'workshop' };
  }
  // The shallowest passed level without 3 stars.
  const starless = p.stars.findIndex((s, i) => i < p.deepest && s < 3);
  if (starless >= 0) {
    const has = p.stars[starless];
    const tip = has < 2 ? 'pass it with 15 seconds to spare' : 'catch every kind of gem and pass with 15 seconds to spare';
    return { text: `${first}Replay level ${starless + 1} for star ${has + 1}: ${tip}.`, button: 'replay', level: starless + 1 };
  }
  if (cheapest) {
    const need = priceOf(cheapest, week) - p.coins;
    return { text: `${first}Replay a level for coins: you need ${need} more for ${cheapest.name}.`, button: 'replay', level: p.deepest };
  }
  return { text: `${first}You have every upgrade! Replay any level to dig for more gems.`, button: 'replay', level: p.deepest };
}
