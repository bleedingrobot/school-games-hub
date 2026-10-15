/**
 * Words and pictures for Wormholes & Black Holes: seat shapes and colours, item names,
 * what each square does, and the mission log line for every engine event.
 */
import type { Square, StarKind, GravityKind } from '../../../shared/space/board';
import type { CosmicEvent, Pending, SpaceEvent, SpaceState } from '../../../shared/space/engine';
import { ITEMS, type ItemKind } from '../../../shared/space/items';

/** Every seat has a shape as well as a colour, so rockets are never told apart by colour alone. */
export type SeatShape = 'circle' | 'triangle' | 'square' | 'diamond';
export const SEAT_SHAPES: readonly SeatShape[] = ['circle', 'triangle', 'square', 'diamond'];
export const SEAT_COLOURS: readonly string[] = ['#ff6b6b', '#ffc93c', '#3ddc97', '#5cc8ff'];
export const SHAPE_NAMES: Record<SeatShape, string> = {
  circle: 'circle',
  triangle: 'triangle',
  square: 'square',
  diamond: 'diamond',
};

export const ITEM_EMOJI: Record<ItemKind, string> = {
  booster: '⏩',
  hyperdrive: '⚡',
  navigator: '🧭',
  'force-field': '🛡️',
  'escape-pod': '🪂',
  'repair-kit': '🔧',
  'warp-key': '🗝️',
  'rescue-beacon': '🆘',
  'tractor-beam': '🧲',
  'gravity-anchor': '⚓',
  'space-mine': '💣',
  'quantum-swap': '🔀',
};

export const ITEM_HELP: Record<ItemKind, string> = {
  booster: '+2 on this roll.',
  hyperdrive: 'Doubles this roll.',
  navigator: 'Pick your roll, 1 to 6.',
  'force-field': 'Works by itself: blocks the next black hole you land on.',
  'escape-pod': 'Works by itself: a black hole only drops you half as far.',
  'repair-kit': 'Clears heavy gravity or a Gravity Anchor.',
  'warp-key': 'Jump to the next wormhole ahead and ride it.',
  'rescue-beacon': 'Jump forward 10 squares.',
  'tractor-beam': 'Pull another rocket back 3.',
  'gravity-anchor': 'Halve another rocket’s next roll.',
  'space-mine': 'Leave it here. The next rocket to land on it goes back 3.',
  'quantum-swap': 'Swap places with a rocket up to 15 squares ahead.',
};

/** A few words for the item tiles (the full help is in ITEM_HELP). */
export const ITEM_SHORT: Record<ItemKind, string> = {
  booster: '+2 on this roll',
  hyperdrive: 'Double this roll',
  navigator: 'Pick your roll',
  'force-field': 'Blocks a black hole',
  'escape-pod': 'Halves a black hole',
  'repair-kit': 'Fixes gravity',
  'warp-key': 'To the next wormhole',
  'rescue-beacon': 'Jump forward 10',
  'tractor-beam': 'Pull a rocket back 3',
  'gravity-anchor': 'Halve a rocket’s roll',
  'space-mine': 'Leave a trap here',
  'quantum-swap': 'Swap with a rocket ahead',
};

export const itemName = (item: ItemKind) => ITEMS[item].name;

/** "a Booster" or "an Escape Pod". */
function withA(name: string) {
  return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`;
}

export const STAR_NAMES: Record<StarKind, string> = {
  'red-dwarf': 'Red dwarf',
  'yellow-star': 'Yellow star',
  'blue-giant': 'Blue giant',
  'white-dwarf': 'White dwarf',
  'binary-star': 'Binary star',
  'neutron-star': 'Neutron star',
  pulsar: 'Pulsar',
  supernova: 'Supernova',
  matariki: 'Matariki',
};

const STAR_HELP: Record<StarKind, string> = {
  'red-dwarf': 'Gain an item.',
  'yellow-star': 'Gain a random item.',
  'blue-giant': 'Gain a rare item.',
  'white-dwarf': 'Gain a Force Field.',
  'binary-star': 'Next turn, roll two dice and pick one.',
  'neutron-star': 'Heavy gravity: your next 2 rolls are halved.',
  pulsar: 'Every other rocket within 5 squares goes back 2.',
  supernova: 'Blast forward 5, and rockets within 10 go back 2. Only once!',
  // Wording approved by James (plan section 2).
  matariki:
    'Matariki is a cluster of stars that rises in midwinter. For many people in Aotearoa it marks the Māori New Year, a time to remember, celebrate and share. Everyone gets a gift!',
};

const GRAVITY_NAMES: Record<GravityKind, string> = { heavy: 'Heavy gravity', low: 'Low gravity', slingshot: 'Slingshot' };
const GRAVITY_HELP: Record<GravityKind, string> = {
  heavy: 'Your next 2 rolls are halved.',
  low: '+2 on your next 2 rolls.',
  slingshot: 'Your next roll is doubled.',
};
export const GRAVITY_BADGE: Record<GravityKind, string> = { heavy: '🐢', low: '🎈', slingshot: '🪃' };

/** What a square does, in one line, for the "tap a square" box. */
export function squareInfo(state: SpaceState, n: number, names: readonly string[]): { title: string; text: string } {
  const size = state.board.size;
  if (n === 1) return { title: 'Square 1: Earth', text: 'Every rocket launches from here.' };
  if (n === size) return { title: `Square ${size}: the space station`, text: 'Dock here first to win!' };
  const mine = state.mines.find((m) => m.square === n);
  if (mine) return { title: `Square ${n}: Space Mine`, text: `${names[mine.owner]}’s mine. Any other rocket that lands here goes back 3.` };
  if (state.asteroids.includes(n)) return { title: `Square ${n}: asteroid`, text: 'Landing here costs an item (or 1 square if you have none). Gone next round.' };
  if (state.comet) {
    if (state.comet.head === n) return { title: `Square ${n}: the comet’s head`, text: 'Land on the comet’s tail to ride up here. It moves every round.' };
    const tail = state.comet.head - n;
    if (tail > 0 && tail < state.comet.length) {
      return { title: `Square ${n}: comet tail`, text: `Land here to ride the comet up to square ${state.comet.head}.` };
    }
  }
  const square: Square | undefined = state.board.squares[n];
  if (!square) return { title: `Square ${n}`, text: 'Empty space.' };
  return { title: `Square ${n}: ${squareName(square)}`, text: squareHelp(square) };
}

export function squareName(square: Square): string {
  switch (square.kind) {
    case 'wormhole': return 'Wormhole';
    case 'black-hole': return 'Black hole';
    case 'star': return STAR_NAMES[square.star];
    case 'gravity': return GRAVITY_NAMES[square.gravity];
    case 'gate': return 'Gate';
    case 'mystery': return 'Mystery coordinates';
    case 'nebula': return 'Nebula';
  }
}

function squareHelp(square: Square): string {
  switch (square.kind) {
    case 'wormhole': return `Zooms you up to square ${square.to}.`;
    case 'black-hole': return `Pulls you down to square ${square.to}. A Force Field blocks it.`;
    case 'star': return STAR_HELP[square.star];
    case 'gravity': return GRAVITY_HELP[square.gravity];
    case 'gate': return `You can jump through to its twin gate on square ${square.twin}, or stay.`;
    case 'mystery': return 'Pick one of three cards to be sent somewhere new.';
    case 'nebula': return 'What’s left of a supernova. Nothing happens here.';
  }
}

const ROLL_CHANGES: Record<string, string> = {
  hyperdrive: 'Hyperdrive ×2',
  slingshot: 'slingshot ×2',
  'heavy-gravity': 'heavy gravity ½',
  'gravity-anchor': 'Gravity Anchor ½',
  booster: 'Booster +2',
  'low-gravity': 'low gravity +2',
  'solar-wind': 'solar wind +1',
};

const COSMIC_TITLES: Record<CosmicEvent, string> = {
  'solar-wind': 'Solar wind!',
  'meteor-shower': 'Meteor shower!',
  'wormhole-shift': 'Wormhole shift!',
};

/** The big banner for a cosmic event or the fuel warning, or null. */
export function bannerFor(event: SpaceEvent): string | null {
  if (event.kind === 'cosmic') return COSMIC_TITLES[event.event];
  if (event.kind === 'fuel-warning') return `⏱ ${event.roundsLeft} rounds of fuel left!`;
  return null;
}

/** The question a choice asks, in plain words. */
export function choiceQuestion(pending: Pending): string {
  switch (pending.kind) {
    case 'gate': return `Jump through the gate to square ${pending.twin}, or stay on ${pending.square}?`;
    case 'mystery': return 'Pick a card. Where will it send you?';
    case 'inventory': return `Your pockets are full! Swap something for ${withA(itemName(pending.item))}?`;
    case 'binary': return 'Binary star: pick which die to use.';
    case 'question': return 'Answer the question to power up the wormhole.';
  }
}

/**
 * The mission log line for an event, or null if it doesn't need one (the screen shows it).
 * `names` is every seat's name, with the student's as "You" where that reads better.
 */
export function describe(event: SpaceEvent, names: readonly string[]): string | null {
  const who = (seat: number) => names[seat];
  switch (event.kind) {
    case 'round-start': return `— Round ${event.round} —`;
    case 'turn-start': return null;
    case 'item-gained':
      if (event.from === 'rescue') return `${who(event.seat)} got a Rescue Beacon to help catch up.`;
      if (event.from === 'matariki') return `${who(event.seat)} got ${withA(itemName(event.item))}.`;
      return `${who(event.seat)} got ${withA(itemName(event.item))}!`;
    case 'pockets-full': return `${who(event.seat)}’s pockets were full, so ${withA(itemName(event.item))} floated away.`;
    case 'item-swapped': return `${who(event.seat)} dropped ${withA(itemName(event.dropped))} to take ${withA(itemName(event.item))}.`;
    case 'item-declined': return `${who(event.seat)} kept their items and let ${withA(itemName(event.item))} float away.`;
    case 'item-used':
      if (event.item === 'navigator') return `${who(event.seat)} used the Navigator and picked ${event.value}.`;
      if (event.target !== undefined) return `${who(event.seat)} aimed ${withA(itemName(event.item))} at ${who(event.target)}!`;
      return `${who(event.seat)} used ${withA(itemName(event.item))}.`;
    case 'item-lost': return `The asteroid knocked away ${who(event.seat)}’s ${itemName(event.item)}.`;
    case 'dice':
      return event.dice.length === 2
        ? `${who(event.seat)} rolled ${event.dice[0]} and ${event.dice[1]}.`
        : `${who(event.seat)} rolled ${event.dice[0]}.`;
    case 'roll':
      return event.changes.length === 0
        ? null
        : `${event.die} became ${event.steps} (${event.changes.map((c) => ROLL_CHANGES[c] ?? c).join(', ')}).`;
    case 'move':
      switch (event.cause) {
        case 'roll': return `${who(event.seat)} flew from ${event.from} to ${event.to}.`;
        case 'bounce':
          return event.bounced
            ? `${who(event.seat)} overshot and bounced back to ${event.to}.`
            : `${who(event.seat)} was knocked back to ${event.to}.`;
        case 'warp-key': return `${who(event.seat)} warped from ${event.from} to the wormhole on ${event.to}.`;
        case 'rescue-beacon': return `${who(event.seat)} was beamed forward from ${event.from} to ${event.to}.`;
        case 'supernova': return `${who(event.seat)} blasted forward to ${event.to}!`;
      }
      return null;
    case 'wormhole': return `${who(event.seat)} rode a wormhole from ${event.from} up to ${event.to}!`;
    case 'black-hole':
      return event.escapePod
        ? `${who(event.seat)} hit a black hole, but the Escape Pod stopped the fall at ${event.to}.`
        : `${who(event.seat)} hit a black hole and fell from ${event.from} to ${event.to}.`;
    case 'force-field': return `${who(event.seat)}’s Force Field blocked the black hole on ${event.square}!`;
    case 'star':
      return event.star === 'matariki'
        ? `${who(event.seat)} landed on Matariki: gifts for everyone!`
        : `${who(event.seat)} landed on a ${STAR_NAMES[event.star].toLowerCase()}.`;
    case 'pushed':
      switch (event.by) {
        case 'pulsar': return `The pulsar pushed ${who(event.seat)} back to ${event.to}.`;
        case 'supernova': return `The supernova blew ${who(event.seat)} back to ${event.to}.`;
        case 'tractor-beam': return `${who(event.seat)} was pulled back from ${event.from} to ${event.to}.`;
        case 'space-mine': return `${who(event.seat)} hit ${who(event.source)}’s Space Mine and went back to ${event.to}.`;
      }
      return null;
    case 'swapped': return `${who(event.seat)} swapped places with ${who(event.target)}: now on ${event.to}!`;
    case 'gravity':
      if (event.gravity === 'heavy') return `Heavy gravity! ${who(event.seat)}’s next 2 rolls are halved.`;
      if (event.gravity === 'low') return `Low gravity: ${who(event.seat)} gets +2 on the next 2 rolls.`;
      return `Slingshot! ${who(event.seat)}’s next roll is doubled.`;
    case 'anchored': return `${who(event.seat)}’s next roll will be halved.`;
    case 'repaired': return `${who(event.seat)} is all fixed up.`;
    case 'binary-ready': return `Next turn ${who(event.seat)} rolls two dice and picks one.`;
    case 'gate': return `${who(event.seat)} jumped through the gate from ${event.from} to ${event.to}.`;
    case 'gate-stay': return `${who(event.seat)} stayed by the gate on ${event.square}.`;
    case 'mystery': return `${who(event.seat)} picked card ${event.card + 1}: off to square ${event.to}!`;
    case 'comet': return `${who(event.seat)} caught the comet and rode it to ${event.to}!`;
    case 'comet-moved': return null;
    case 'mine-placed': return `${who(event.seat)} left a Space Mine on ${event.square}.`;
    case 'mine-fizzled': return `${who(event.owner)}’s Space Mine on ${event.square} fizzled out.`;
    case 'asteroid': return `${who(event.seat)} hit an asteroid on ${event.square}!`;
    case 'supernova-spent': return `The supernova on ${event.square} burned out into a nebula.`;
    case 'question': return event.correct ? `${who(event.seat)} powered up the wormhole!` : null;
    case 'chain-cap': return `That’s enough for one turn: square ${event.square} will have to wait.`;
    case 'choice': return null;
    case 'timeout': return null;
    case 'roll-again': return `${who(event.seat)} rolled a 6: roll again!`;
    case 'cosmic':
      if (event.event === 'solar-wind') return 'Solar wind! Everyone gets +1 on their next roll.';
      if (event.event === 'meteor-shower') return `Meteor shower! Asteroids on ${event.squares?.join(', ') || 'no squares'} this round.`;
      return event.from === event.to
        ? 'Wormhole shift! But the wormholes held steady.'
        : `Wormhole shift! The wormhole on ${event.wormhole} now goes to ${event.to}.`;
    case 'fuel-warning': return `⏱ Only ${event.roundsLeft} rounds of fuel left!`;
    case 'docked': return `🚀 ${who(event.seat)} docked at the space station!`;
    case 'game-over': return event.ending === 'mission-clock' ? 'The fuel ran out! Places go by how far everyone got.' : null;
  }
}

export { ORDINAL } from '../../../shared/space/names';
