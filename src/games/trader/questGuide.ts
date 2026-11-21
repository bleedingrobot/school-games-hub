/**
 * Star Trader quests on the screens (docs/plans/trader-quests/PLAN.md, section 4: "making it clear where to go"). Only
 * words and choices for showing: every rule comes from shared/trader/quests.ts, and the server checks every move.
 */
import { coordText, distance, type Galaxy } from '../../../shared/trader/galaxy';
import { nearestSellers, openQuestView, QUESTS, type QuestConfig, type QuestState, type StepView } from '../../../shared/trader/quests';
import { applyBatch, type Action, type Game, type Settings } from '../../../shared/trader/server';
import type { Trader } from '../../../shared/trader/state';

const FILES = import.meta.glob(['./art/quests/giver-*.webp', './art/quests/quest-board*.webp'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** A quest giver's painted face (160 px, and the 512 px painting), or undefined until it exists. */
export function giverArt(id: string): { small: string; big?: string } | undefined {
  const small = FILES[`./art/quests/giver-${id}-small.webp`];
  return small ? { small, big: FILES[`./art/quests/giver-${id}.webp`] } : undefined;
}

/** The quest board painting, the Quests tab's header picture (1600 px and its 800 px copy for phones). */
export function boardArt(): { wide: string; small: string } | undefined {
  const wide = FILES['./art/quests/quest-board.webp'];
  return wide ? { wide, small: FILES['./art/quests/quest-board-800.webp'] ?? wide } : undefined;
}

/** Problems that mean "not yet" rather than "go there": these steps wait for others. */
const WAITING = new Set(['Do the other steps first.', 'Do the steps in order.']);
export const isWaiting = (s: StepView): boolean => !s.done && s.problem !== null && WAITING.has(s.problem);

const the = (what: string): string => (/^(a|an) /i.test(what) ? what : `the ${what}`);

const DELIVER: Record<string, { line: string; button: string }> = {
  zuzu: { line: 'Take the party things to Grandma Zuzu', button: 'Hand them over' },
  sprocket: { line: 'Bring the robots back to Professor Sprocket', button: 'Hand them over' },
  nettle: { line: 'Give Dr Nettle the medicine and water', button: 'Hand it over' },
  vex: { line: 'Report to Commander Vex', button: 'Report' },
  kai: { line: "Bring Lumi home to her family", button: 'Bring Lumi home' },
};

/** What a step asks, in a few words, and its button. */
export function stepWords(quest: QuestConfig, s: Pick<StepView, 'kind' | 'what' | 'index' | 'qty'>): { line: string; button: string } {
  switch (s.kind) {
    case 'pickup':
      return quest.id === 'sprocket' ? { line: `Find ${s.what}`, button: `Collect ${s.what}` } : { line: `Pick up ${the(s.what)}`, button: 'Pick up' };
    case 'buy-deliver':
      return { line: `Bring ${s.qty ?? ''} ${s.what}`.replace('  ', ' '), button: `Hand over the ${s.what}` };
    case 'pirate':
      return { line: 'Chase off a pirate ship', button: 'Chase them off' };
    case 'clue':
      return { line: `Follow clue ${s.index + 1} of Lumi's trail`, button: 'Look for Lumi' };
    case 'deliver':
      return DELIVER[quest.id] ?? { line: `Go to ${quest.giver}`, button: 'Hand over' };
  }
}

/** The landing card's words: "Pick up the Star-berries for Grandma Zuzu". */
export function landingLine(quest: QuestConfig, s: StepView): string {
  const { line } = stepWords(quest, s);
  return s.kind === 'pickup' || s.kind === 'pirate' ? `${line} for ${quest.giver}` : line;
}

/** The gentle line for leaving a quest planet without picking up. */
export function leftBehind(quest: QuestConfig, s: StepView, planet: string): string {
  if (s.kind === 'pickup') return `You left ${the(s.what)} behind on ${planet}. You can go back for ${quest.id === 'sprocket' ? 'them' : 'it'} any time.`;
  return `You flew past ${quest.giver}'s stop on ${planet}. You can go back any time.`;
}

export interface NextStop {
  planet: number;
  name: string;
  coords: string;
  fuel: number;
  fuelOk: boolean;
  /** What to do there: "Pick up the Sparkle Candles", "Buy 5 Medicine". */
  doing: string;
  /** The step it is for (a step's own planet, or for Dr Nettle's goods a market that sells them). */
  step: StepView;
}

/**
 * The quest's next stop: the nearest place with something to do, whether it is the step's own planet or (for Dr Nettle's
 * goods not yet in the hold) the nearest market selling them today. Null when no quest is open.
 */
export function nextStop(galaxy: Galaxy, t: Trader, q: QuestState | undefined): NextStop | null {
  const view = openQuestView(galaxy, t, q);
  if (!view) return null;
  const options: NextStop[] = [];
  for (const s of view.steps) {
    if (s.done || isWaiting(s)) continue;
    if (s.kind === 'buy-deliver' && (s.have ?? 0) < (s.qty ?? 0)) {
      const good = view.quest.steps[s.index].good ?? 0;
      const seller = nearestSellers(galaxy, t, good, 1)[0];
      if (!seller) continue;
      const p = galaxy.planets[seller.planet];
      options.push({ planet: p.id, name: p.name, coords: coordText(p), fuel: seller.fuel, fuelOk: seller.fuel <= t.fuel, doing: `Buy ${(s.qty ?? 0) - (s.have ?? 0)} ${s.what} (${seller.price} cr each)`, step: s });
      continue;
    }
    options.push({ planet: s.planet, name: s.name, coords: s.coords, fuel: s.fuel, fuelOk: s.fuelOk, doing: stepWords(view.quest, s).line, step: s });
  }
  options.sort((a, b) => a.fuel - b.fuel || a.step.index - b.step.index);
  return options[0] ?? null;
}

/**
 * Every step that can be done here and now, in one go (Dr Nettle's two goods and then his thank-you all at once), checked
 * with the very same rules the server runs. The actions to send and the steps they are for.
 */
export function doableHere(galaxy: Galaxy, seed: string, game: Game, settings: Settings): { actions: Action[]; steps: StepView[] } {
  const view = openQuestView(galaxy, game.t, game.quests);
  if (!view) return { actions: [], steps: [] };
  const actions: Action[] = [];
  const steps: StepView[] = [];
  // Twice round, so the last step (which waits for the rest) can join once the others are in.
  for (let round = 0; round < 2; round++) {
    for (const s of view.steps) {
      if (s.done || steps.includes(s) || s.planet !== game.t.location) continue;
      const delivering = s.kind === 'buy-deliver' || s.kind === 'deliver';
      const action: Action = delivering ? { type: 'quest-deliver', step: s.index } : { type: 'quest-pickup', step: s.index };
      if (applyBatch(galaxy, seed, game, [...actions, action], settings, () => null).ok) {
        actions.push(action);
        steps.push(s);
      }
    }
  }
  return { actions, steps };
}

/** Quest planets for the star chart: planet id → the step numbers (1-based) still to do there, and their words. */
export function questPlanetMarks(galaxy: Galaxy, t: Trader, q: QuestState | undefined): Map<number, { n: number[]; lines: string[] }> {
  const marks = new Map<number, { n: number[]; lines: string[] }>();
  const view = openQuestView(galaxy, t, q);
  if (!view) return marks;
  for (const s of view.steps) {
    if (s.done) continue;
    const m = marks.get(s.planet) ?? { n: [], lines: [] };
    m.n.push(s.index + 1);
    m.lines.push(`Step ${s.index + 1}: ${stepWords(view.quest, s).line}${isWaiting(s) ? ' (after the other steps)' : ''}`);
    marks.set(s.planet, m);
  }
  return marks;
}

/** How far a planet is from the ship, for lines like "5 fuel from here". */
export const fuelFrom = (galaxy: Galaxy, t: Trader, planet: number): number => distance(galaxy.planets[t.location], galaxy.planets[planet]);

/** The quest things on board now (picked up and not yet handed over), for the hold's gold boxes. */
export function questCargoNames(q: QuestState | undefined, t: Trader): string[] {
  const quest = q?.open ? QUESTS.find((c) => c.id === q.open) : undefined;
  if (!quest || !t.questCargo) return [];
  return quest.steps.filter((s, i) => s.kind === 'pickup' && q?.done.includes(i)).map((s) => s.what).slice(0, t.questCargo);
}
