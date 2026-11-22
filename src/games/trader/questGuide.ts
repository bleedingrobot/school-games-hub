/**
 * Star Trader quests on the screens (docs/plans/trader-quests/PLAN.md, section 4: "making it clear where to go"). Only
 * words and choices for showing: every rule comes from shared/trader/quests.ts, and the server checks every move.
 */
import { coordText, distance, type Galaxy } from '../../../shared/trader/galaxy';
import { SHIPS } from '../../../shared/trader/config';
import { jobIndex, nearestSellers, openQuestOf, openQuestView, questFightHere, trailClue, type QuestConfig, type QuestState, type StepView } from '../../../shared/trader/quests';
import { applyBatch, type Action, type Game, type Settings } from '../../../shared/trader/server';
import type { Trader } from '../../../shared/trader/state';

const FILES = import.meta.glob(['./art/quests/giver-*.webp', './art/quests/quest-board*.webp'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** A quest giver's painted face (160 px, and the 512 px painting), or undefined until it exists. */
export function giverArt(id: string): { small: string; big?: string } | undefined {
  const small = FILES[`./art/quests/giver-${id}-small.webp`];
  return small ? { small, big: FILES[`./art/quests/giver-${id}.webp`] } : undefined;
}

/** The quest board painting, the Quests tab's header picture (1600 px and its 800 px copy for phones). */
/**
 * The Quest Log's keepsakes (PLAN rule 10): one per giver, kept through a New Season. The picture is the giver's last
 * story page, cut to a round badge.
 */
export const KEEPSAKES: Record<string, { name: string; emoji: string; focus?: string }> = {
  zuzu: { name: 'Party balloon', emoji: '🎈' },
  sprocket: { name: 'Lucky gear', emoji: '⚙️' },
  nettle: { name: 'Healing leaf', emoji: '🍃' },
  vex: { name: 'Navy badge', emoji: '🎖️' },
  kai: { name: 'Star-scale', emoji: '✨' },
  // Quests 6 to 10 (R.4). `focus` is where the keepsake sits in the wide painting, so the round badge shows it.
  puddle: { name: 'Rain-drop', emoji: '💧', focus: '60% 50%' },
  gorbo: { name: 'Golden spoon', emoji: '🥄', focus: '78% 50%' },
  zip: { name: 'Comet Cup', emoji: '🏆', focus: '50% 50%' },
  pippop: { name: 'Pet collar', emoji: '🐾', focus: '42% 50%' },
  sable: { name: 'Treasure coin', emoji: '🪙', focus: '58% 50%' },
};

/** Story paintings used for the quest moments (the race lamps, the finish ring, Rust-Beard's ship), wide and phone sizes. */
const MOMENTS = import.meta.glob(['./art/quests/zip-3*.webp', './art/quests/zip-4*.webp', './art/quests/sable-2*.webp'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function momentArt(name: 'zip-3' | 'zip-4' | 'sable-2'): { wide: string; small: string } | undefined {
  const wide = MOMENTS[`./art/quests/${name}.webp`];
  return wide ? { wide, small: MOMENTS[`./art/quests/${name}-800.webp`] ?? wide } : undefined;
}

/** The Star Quest Master trophy painting (also on the profile as trader-quest-master). */
const MASTER = import.meta.glob('./art/quests/trophy-quest-master-small.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const MASTER_ART: string | undefined = Object.values(MASTER)[0];

/** The Star Quest Legend trophy painting, gold and purple (also on the profile as trader-quest-legend): small and 512 px. */
const LEGEND = import.meta.glob('./art/quests/trophy-quest-legend*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const LEGEND_ART: { small?: string; big?: string } = { small: LEGEND['./art/quests/trophy-quest-legend-small.webp'], big: LEGEND['./art/quests/trophy-quest-legend.webp'] };

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
  puddle: { line: 'Tell Mayor Puddle the water is shared out', button: 'Tell the Mayor' },
  gorbo: { line: 'Take the feast things to Chef Gorbo', button: 'Hand them over' },
  zip: { line: 'Cross the finish line for Zip Zoomer', button: '🏁 Cross the line!' },
  pippop: { line: 'Bring the pets home to Pip and Pop', button: 'Bring them home' },
  sable: { line: "Dig up Captain Sable's treasure", button: '💰 Dig it up' },
};

/** Who waits at a quest's last stop, for "X is here. First ..." (Lumi's family, not Ranger Kai; the race's finish line). */
const WHO_HERE: Record<string, string> = {
  kai: "Lumi's family is here.",
  zip: 'This is the finish line.',
  sable: "Captain Sable's treasure is here.",
};

/** The quest pirates' own words: Pip and Pop's Wiggles, and Rust-Beard (a Captain, not "a pirate ship"). */
const PIRATE: Record<string, { line: string; still: string; todo: string }> = {
  pippop: { line: 'Win Wiggles back from the pirate', still: 'The pirate with Wiggles is still here.', todo: 'win Wiggles back' },
  sable: { line: 'Beat Rust-Beard, the pirate Captain', still: "Rust-Beard's ship is still here.", todo: 'beat Rust-Beard' },
};
export const pirateWords = (quest: QuestConfig): { line: string; still: string; todo: string } =>
  PIRATE[quest.id] ?? { line: 'Chase off a pirate ship', still: 'A Rust Raider ship is still here.', todo: '' };

/** A quest fight's heading and line on the fight screen (Commander Vex's Rust Raiders, the pirate with Wiggles, Rust-Beard). */
export function questFightWords(quest: QuestConfig): { title: string; line: string } {
  if (quest.id === 'sable') return { title: 'Rust-Beard attacks! ☠️', line: `⭐ Rust-Beard, a pirate Captain! Captain Sable's ${NAVY_LASER_NAME} is fitted for this fight. If you lose, he takes nothing.` };
  if (quest.id === 'pippop') return { title: 'The pirate with Wiggles! ☠️', line: `⭐ Win Wiggles back for Pip and Pop! Their ${NAVY_LASER_NAME} is fitted for this fight. If you lose, the pirate takes nothing.` };
  return { title: '', line: `⭐ One of the Rust Raiders! ${quest.giver}'s ${NAVY_LASER_NAME} is fitted for this fight. If you lose, they take nothing.` };
}
const NAVY_LASER_NAME = 'Navy laser';

/** A clue trail (Lumi's, Captain Sable's map): its planets wait behind clues until Show me. The Comet Cup is in order but not hidden. */
export const isTrail = (quest: QuestConfig): boolean => quest.steps.some((s) => s.kind === 'clue');
/** Whose clue it is and what the trail is called: "Ranger Kai", "Lumi's trail". */
export const trailName = (quest: QuestConfig): { who: string; trail: string } =>
  quest.id === 'sable' ? { who: 'Captain Sable', trail: "Captain Sable's map" } : { who: quest.giver, trail: "Lumi's trail" };

/** The gentle note when fuel bought after the start line sends the Comet Cup back to it (the reply's `raceReset`). */
export const RACE_RESET_NOTE = "You refuelled, so it's back to the start line. The Comet Cup is flown on one tank: fill up at the start line, then no more fuel till the finish.";

/** What a step asks, in a few words, and its button. */
export function stepWords(quest: QuestConfig, s: Pick<StepView, 'kind' | 'what' | 'index' | 'qty'> & { have?: number }): { line: string; button: string } {
  switch (s.kind) {
    case 'pickup':
      if (quest.id === 'pippop') return { line: `Find ${s.what}`, button: `Scoop up ${s.what}` };
      return quest.id === 'sprocket' ? { line: `Find ${s.what}`, button: `Collect ${s.what}` } : { line: `Pick up ${the(s.what)}`, button: 'Pick up' };
    case 'buy-deliver':
      // Mayor Puddle's water is handed out at each dry planet: "4 Water here (you have 12)".
      if (quest.steps[s.index]?.hands) return { line: `${s.qty ?? ''} ${s.what} here (you have ${s.have ?? 0})`, button: `💧 Hand out ${s.qty ?? ''} ${s.what}`.replace('  ', ' ') };
      return { line: `Bring ${s.qty ?? ''} ${s.what}`.replace('  ', ' '), button: `Hand over the ${s.what}` };
    case 'pirate':
      return { line: pirateWords(quest).line, button: '⚔️ Fight them' };
    case 'clue':
      return quest.id === 'sable' ? { line: `Follow mark ${s.index + 1} of Captain Sable's map`, button: 'Find the mark' } : { line: `Follow clue ${s.index + 1} of Lumi's trail`, button: 'Look for Lumi' };
    case 'checkpoint':
      // The Comet Cup: the start line wants a full tank; the checkpoint is next.
      return s.index === 0 ? { line: 'Go to the start line with a full tank', button: '🚦 Start the race!' } : { line: `Fly through ${s.what}`, button: '💨 Through!' };
    // (pirate steps have no tap: arriving starts the fight, and the button fights again after a loss)
    case 'deliver':
      if (jobIndex(quest.id) !== null) return { line: `Take the crates to ${s.what}`, button: 'Deliver' };
      return DELIVER[quest.id] ?? { line: `Go to ${quest.giver}`, button: 'Hand over' };
  }
}

/** The landing card's words: "Pick up the Star-berries for Grandma Zuzu". */
export function landingLine(quest: QuestConfig, s: StepView): string {
  const { line } = stepWords(quest, s);
  if (s.kind === 'buy-deliver' && quest.steps[s.index]?.hands) return `Hand out ${s.qty} ${s.what} here for ${quest.giver} (you have ${s.have ?? 0})`;
  return s.kind === 'pickup' || s.kind === 'pirate' ? `${line} for ${quest.giver}` : line;
}

/** The gentle line for leaving a quest planet without picking up. */
export function leftBehind(quest: QuestConfig, s: StepView, planet: string): string {
  if (s.kind === 'pickup') return `You left ${the(s.what)} behind on ${planet}. You can go back for ${quest.id === 'sprocket' || quest.id === 'pippop' ? 'them' : 'it'} any time.`;
  return `You flew past ${quest.giver}'s stop on ${planet}. You can go back any time.`;
}

/**
 * Lumi's trail (Q.4): which steps the pupil has asked to see with **Show me**. 'all' shows every planet (Bolt Off hides
 * coordinates, so the planet is shown straight away). Kept in the browser only: the clue is never marked or recorded.
 */
export type Shown = readonly number[] | 'all';

/**
 * A trail step whose planet is kept back behind its clue until Show me. A step at the same planet as another (Captain
 * Sable's treasure, where Rust-Beard waits) is shown with that one, or once that one is done (you've been there).
 */
export function isHidden(quest: QuestConfig, s: Pick<StepView, 'index' | 'done'>, shown: Shown, done: readonly number[] = []): boolean {
  if (!isTrail(quest) || s.done || shown === 'all' || shown.includes(s.index)) return false;
  const same = quest.steps[s.index]?.same;
  if (same !== undefined) return !done.includes(same) && isHidden(quest, { index: same, done: false }, shown, done);
  return true;
}
/** The indexes of the steps done. */
export const doneOf = (steps: readonly StepView[]): number[] => steps.filter((s) => s.done).map((s) => s.index);

/**
 * The Comet Cup's fuel sum, so the adding up is in plain sight: the legs still to fly from here (to the next line, then on
 * to the finish) against the fuel in the tank; before the start, the whole race against the tank. Null for other quests.
 */
export function raceFuel(galaxy: Galaxy, t: Trader, quest: QuestConfig, steps: readonly StepView[]): { started: boolean; legs: number[]; toFly: number; left: number; tank: number; total: number } | null {
  if (!quest.race || !steps.length) return null;
  const tank = SHIPS[t.ship].fuelTank;
  const at = (s: StepView) => galaxy.planets[s.planet];
  const race = steps.slice(1).map((s, i) => distance(at(steps[i]), at(s)));
  const total = race.reduce((a, b) => a + b, 0);
  const started = steps[0].done;
  const left = steps.filter((s) => !s.done);
  if (!started || !left.length) return { started, legs: race, toFly: total, left: t.fuel, tank, total };
  const legs = left.map((s, i) => (i === 0 ? s.fuel : distance(at(left[i - 1]), at(s))));
  return { started, legs, toFly: legs.reduce((a, b) => a + b, 0), left: t.fuel, tank, total };
}

/** The clue for the trail's next stop, from where the ship is now ("From here, go 3 right and 2 down."), or null. */
export function clueNow(galaxy: Galaxy, t: Trader, q: QuestState | undefined): { step: StepView; text: string } | null {
  const view = openQuestView(galaxy, t, q);
  if (!view || !isTrail(view.quest)) return null;
  const step = view.steps.find((s) => !s.done);
  // Captain Sable's treasure is where Rust-Beard was: no clue needed once you're there.
  if (!step || (step.planet === t.location && view.quest.steps[step.index]?.same !== undefined)) return null;
  return { step, text: trailClue(galaxy, t.location, step.planet).text };
}

/** Commander Vex's pirate ship waiting right here (after a loss or getting away), to fight again. Null: none. */
export function pirateHere(galaxy: Galaxy, game: Game): StepView | null {
  if (game.pending) return null;
  const index = questFightHere(galaxy, game.t, game.quests);
  const view = index === null ? null : openQuestView(galaxy, game.t, game.quests);
  return view?.steps[index ?? -1] ?? null;
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
  /** Lumi's trail before Show me: the clue to follow instead of the planet (name and coordinates are not to be shown). */
  clue?: string;
}

/**
 * The quest's next stop: the nearest place with something to do, whether it is the step's own planet or (for Dr Nettle's
 * goods not yet in the hold) the nearest market selling them today. Null when no quest is open.
 */
export function nextStop(galaxy: Galaxy, t: Trader, q: QuestState | undefined, shown: Shown = 'all'): NextStop | null {
  const view = openQuestView(galaxy, t, q);
  if (!view) return null;
  const clue = clueNow(galaxy, t, q);
  const options: NextStop[] = [];
  for (const s of view.steps) {
    if (s.done || isWaiting(s)) continue;
    if (s.kind === 'buy-deliver' && (s.have ?? 0) < (s.qty ?? 0)) {
      const good = view.quest.steps[s.index].good ?? 0;
      const seller = nearestSellers(galaxy, t, good, 1)[0];
      if (!seller) continue;
      const p = galaxy.planets[seller.planet];
      options.push({ planet: p.id, name: p.name, coords: coordText(p), fuel: seller.fuel, fuelOk: seller.fuel <= t.fuel, doing: `Buy ${stillToBuy(view.quest, view.steps, s)} ${s.what} (${seller.price} cr each)`, step: s });
      continue;
    }
    const hidden = clue?.step.index === s.index && isHidden(view.quest, s, shown, doneOf(view.steps));
    options.push({ planet: s.planet, name: s.name, coords: s.coords, fuel: s.fuel, fuelOk: s.fuelOk, doing: stepWords(view.quest, s).line, step: s, ...(hidden ? { clue: clue.text } : {}) });
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

/**
 * How many of a step's goods are still to buy: every undone step wanting that good, less what is in the hold (Mayor
 * Puddle's three lots of 4 Water are one shop of 12).
 */
export function stillToBuy(quest: QuestConfig, steps: readonly StepView[], s: StepView): number {
  const good = quest.steps[s.index]?.good;
  const want = steps.filter((o) => !o.done && o.kind === 'buy-deliver' && quest.steps[o.index]?.good === good).reduce((n, o) => n + (o.qty ?? 0), 0);
  return Math.max(0, want - (s.have ?? 0));
}

/** The first undone goods step for each good (Mayor Puddle's three lots of Water are one shopping line). */
const firstOfEachGood = (quest: QuestConfig, steps: readonly StepView[]): StepView[] =>
  steps.filter((s, i, all) => !s.done && s.kind === 'buy-deliver' && all.findIndex((o) => !o.done && o.kind === 'buy-deliver' && quest.steps[o.index].good === quest.steps[s.index].good) === i);

/** "a, b and c". */
const andList = (items: string[]): string => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** What is still to do before a quest's last stop, in a few words: "get the Sparkle Candles and a Robot Band". */
function stillToDo(quest: QuestConfig, steps: readonly StepView[]): string {
  const left = steps.filter((s) => !s.done && s.index < quest.steps.length - 1);
  const pirates = left.filter((s) => s.kind === 'pirate').length;
  const things = left.flatMap((s): string[] => {
    if (s.kind === 'pickup') return [the(s.what)];
    // Mayor Puddle's water is handed out at the dry planets (said once, below).
    if (s.kind !== 'buy-deliver' || quest.steps[s.index].hands) return [];
    // Dr Nettle's goods already in the hold are handed over here, so only what is still to buy.
    return (s.have ?? 0) < (s.qty ?? 0) ? [`${(s.qty ?? 0) - (s.have ?? 0)} ${s.what}`] : [];
  });
  const words = things.length ? [`${quest.id === 'sprocket' || quest.id === 'pippop' ? 'find' : 'get'} ${andList(things)}`] : [];
  const handing = left.filter((s) => quest.steps[s.index].hands);
  if (handing.length) words.push(`hand out the ${handing[0].what} at ${handing.length === 1 ? 'the last dry planet' : `${handing.length} dry planets`}`);
  if (pirates) words.push(pirateWords(quest).todo || `chase off ${pirates} more pirate ship${pirates === 1 ? '' : 's'}`);
  if (left.some((s) => s.kind === 'clue')) words.push(`follow ${trailName(quest).trail}`);
  return andList(words);
}

/** Where to buy what Dr Nettle still needs: "Water is sold right here (4 cr each). The nearest Medicine is on Zorb (3 fuel)." */
function buyWhere(galaxy: Galaxy, t: Trader, quest: QuestConfig, steps: readonly StepView[]): string {
  return firstOfEachGood(quest, steps)
    .filter((s) => stillToBuy(quest, steps, s) > 0)
    .flatMap((s) => {
      const seller = nearestSellers(galaxy, t, quest.steps[s.index].good ?? 0, 1)[0];
      if (!seller) return [];
      return [seller.planet === t.location ? `${s.what} is sold right here (${seller.price} cr each).` : `The nearest ${s.what} is on ${seller.name} (${seller.fuel} fuel).`];
    })
    .join(' ');
}

export interface QuestHint {
  line: string;
  why: string;
  /** A hint at a market rather than at one of the quest's own stops (Dr Nettle's shopping). */
  shop?: boolean;
}

/**
 * Quest steps on this planet that can't be done yet, so a quest planet never looks empty: the last stop before the rest
 * are done ("Grandma Zuzu is here. First get the Sparkle Candles and a Robot Band, then come back here."), or a pick-up
 * with a full hold. Dr Nettle's quest also says where to buy his goods, and at a market selling them, to buy (or keep)
 * them here. Lumi's trail stops, her family's planet included, stay secret. Steps in `doable` are left out (they have the
 * landing card).
 */
export function waitingHere(galaxy: Galaxy, t: Trader, q: QuestState | undefined, doable: readonly StepView[], shown: Shown = 'all'): QuestHint[] {
  const view = openQuestView(galaxy, t, q);
  if (!view) return [];
  const { quest } = view;
  const last = quest.steps.length - 1;
  const lastStep = view.steps[last];
  const out: QuestHint[] = [];
  const lastWaitsHere = !!lastStep && !lastStep.done && lastStep.planet === t.location && lastStep.problem === 'Do the other steps first.';
  for (const s of view.steps) {
    if (s.done || s.planet !== t.location || s.kind === 'pirate' || doable.some((d) => d.index === s.index) || !s.problem) continue;
    if (quest.ordered && (s.problem === 'Do the steps in order.' || isHidden(quest, s, shown, doneOf(view.steps)))) continue;
    if (s.index === last && s.problem === 'Do the other steps first.') {
      const who = jobIndex(quest.id) !== null ? 'This is where the crates go.' : WHO_HERE[quest.id] ?? `${quest.giver} is here.`;
      const shop = buyWhere(galaxy, t, quest, view.steps);
      out.push({ line: who, why: `First ${stillToDo(quest, view.steps) || 'do the other steps'}, then come back here.${shop ? ` ${shop}` : ''}` });
    } else if (s.kind === 'buy-deliver') {
      // Said once, in the giver's line, when that is waiting here too.
      if (lastWaitsHere) continue;
      const shop = buyWhere(galaxy, t, quest, [s]);
      out.push({ line: `${landingLine(quest, s)}.`, why: `${s.problem}${shop ? ` ${shop}` : ''}` });
    } else {
      out.push({ line: `${landingLine(quest, s)}.`, why: s.problem.startsWith('Make room') ? `${s.problem} Sell something first, then pick it up.` : s.problem });
    }
  }
  // Dr Nettle's shopping at any other market: buy what he still needs here, and keep what is already in the hold.
  // One line per good (Mayor Puddle's three lots of Water are one shop), and not where the water is handed out now.
  const goods = firstOfEachGood(quest, view.steps);
  const handsHere = view.steps.some((s) => !s.done && quest.steps[s.index].hands && s.planet === t.location);
  if (goods.length && lastStep && lastStep.planet !== t.location && !handsHere) {
    const buy: string[] = [];
    const keep: string[] = [];
    for (const s of goods) {
      const line = t.market[quest.steps[s.index].good ?? 0];
      const need = stillToBuy(quest, view.steps, s);
      if (need > 0 && line && line.buy > 0 && line.stock > 0) buy.push(`${need} ${s.what} (${line.buy} cr each)`);
      else if (need <= 0 && line && line.sell > 0) keep.push(`${s.have ?? 0} ${s.what}`);
    }
    if (buy.length || keep.length) {
      const hands = goods.some((s) => quest.steps[s.index].hands);
      const parts = [buy.length ? `Buy ${andList(buy)} here.` : '', keep.length ? `Keep your ${andList(keep)}: don't sell them.` : '', hands ? 'Then hand them out at the dry planets (gold rings on the star chart).' : `Then take them to ${lastStep.name}.`];
      out.push({ line: `${quest.giver} needs these.`, why: parts.filter(Boolean).join(' '), shop: true });
    }
  }
  return out;
}

/** Quest planets for the star chart: planet id → the step numbers (1-based) still to do there, and their words. */
export function questPlanetMarks(galaxy: Galaxy, t: Trader, q: QuestState | undefined, shown: Shown = 'all'): Map<number, { n: number[]; lines: string[] }> {
  const marks = new Map<number, { n: number[]; lines: string[] }>();
  const view = openQuestView(galaxy, t, q);
  if (!view) return marks;
  for (const s of view.steps) {
    // Lumi's trail planets get their gold ring only once shown (Show me): finding them is the puzzle.
    if (s.done || isHidden(view.quest, s, shown, doneOf(view.steps))) continue;
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
export function questCargoNames(galaxy: Galaxy, q: QuestState | undefined, t: Trader): string[] {
  const quest = openQuestOf(galaxy, q)?.quest;
  if (!quest || !t.questCargo) return [];
  // A daily job's crates fill one hold each ("Games crate"); a story quest's things one each.
  return quest.steps
    .filter((s, i) => s.kind === 'pickup' && q?.done.includes(i))
    .flatMap((s) => Array.from({ length: s.holds ?? 1 }, () => s.cargo ?? s.what))
    .slice(0, t.questCargo);
}
