/**
 * Quests: one short story a day, written by us. Each has one or two choices; some choices need a charming
 * clan, some lead to a puzzle. Puzzles are made and marked by code (never an AI) and rebuilt from their kind and numbers.
 * A wrong puzzle answer never blocks: the story carries on and the prize is just the smaller one.
 * Plain data and plain functions on plain JSON, like empire.ts. Every tuning number is in config.ts (CONFIG.quests).
 */
import { fmt, topicAvailable, type PracticalKind, type PracticalQuestion, type PracticalSettings, type YearBand } from '../maths/practical';
import { CONFIG } from './config';
import { ITEMS } from './gamedata';
import { roll, type HasRng } from './rng';
import type { Clan, ItemDef, Member } from './types';

const Q = CONFIG.quests;

// ---------------------------------------------------------------------------
// Puzzles
// ---------------------------------------------------------------------------

export const PUZZLE_KINDS = ['pattern', 'order', 'riddle', 'cold'] as const;
export type PuzzleKind = (typeof PUZZLE_KINDS)[number];

/** A puzzle's kind and numbers: all a server needs to keep to rebuild and mark it. */
export interface PuzzleSpec {
  kind: PuzzleKind;
  nums: number[];
}

const int = (h: HasRng, lo: number, hi: number) => lo + roll(h, hi - lo + 1);
const pick = <T>(h: HasRng, list: readonly T[]): T => list[roll(h, list.length)];

const ANIMALS = [
  { word: 'crows', where: 'on a fence', names: ['Ash', 'Bree', 'Cob', 'Dot'] },
  { word: 'frogs', where: 'on a log', names: ['Fern', 'Gus', 'Hob', 'Ivy'] },
  { word: 'owls', where: 'on a branch', names: ['Jem', 'Kit', 'Lark', 'Moss'] },
] as const;
const COUNT_WORDS = ['', '', 'Two', 'Three', 'Four'];
const ASKS = ['far left', 'far right', 'middle'] as const;

/** The pattern variants: 0 = count on by the same step, 1 = the step grows by one each time, 2 = doubling. */
const PATTERN_COUNT = 5;

function patternSequence(variant: number, start: number, step: number, count: number): number[] {
  const out = [start];
  let diff = step;
  for (let i = 1; i < count; i++) {
    const last = out[i - 1];
    if (variant === 0) out.push(last + step);
    else if (variant === 1) {
      out.push(last + diff);
      diff++;
    } else out.push(last * 2);
  }
  return out;
}

/** True if these numbers make a sensible puzzle of this kind. */
export function isValidPuzzle(spec: PuzzleSpec): boolean {
  const n = spec.nums;
  if (!n.every((x) => Number.isInteger(x))) return false;
  switch (spec.kind) {
    case 'pattern':
      return n.length === 4 && n[0] >= 0 && n[0] <= 2 && n[1] >= 1 && n[1] <= 50 && n[2] >= 1 && n[2] <= 20 && n[3] === PATTERN_COUNT;
    case 'order': {
      const [theme, count, ask] = n;
      return n.length === 3 + (count ?? 0) && theme >= 0 && theme < ANIMALS.length && (count === 3 || count === 4) && ask >= 0 && ask < ASKS.length && isPermutation(n.slice(3), count);
    }
    case 'riddle':
      return n.length === 4 && n[0] >= 1 && n[0] <= 30 && n[1] >= 2 && n[1] <= 9 && n[2] >= 1 && n[2] <= 30 && (n[3] === 0 || n[3] === 1);
    case 'cold':
      return n.length === 2 && n[0] >= -20 && n[0] <= 20 && n[1] !== 0 && Math.abs(n[1]) <= 40 && Math.abs(n[0] + n[1]) <= 40;
  }
}

function isPermutation(list: number[], count: number) {
  return list.length === count && [...list].sort((a, b) => a - b).every((x, i) => x === i);
}

/** Make the puzzle (as a question the question box can show and mark) from its kind and numbers. Throws if they make no sense. */
export function buildPuzzle(spec: PuzzleSpec): PracticalQuestion {
  if (!isValidPuzzle(spec)) throw new Error(`Bad numbers for a "${spec.kind}" puzzle: ${JSON.stringify(spec.nums)}`);
  const n = spec.nums;
  const base = { kind: `quest-${spec.kind}` as unknown as PracticalKind, nums: [...n] };
  if (spec.kind === 'pattern') {
    const [variant, start, step, count] = n;
    const seq = patternSequence(variant, start, step, count);
    const next = variant === 0 ? seq[count - 1] + step : variant === 1 ? seq[count - 1] + step + count - 1 : seq[count - 1] * 2;
    const rule = variant === 0 ? `Each number is ${step} more than the one before: ${seq[count - 1]} + ${step} = ${next}.` : variant === 1 ? `The jumps go up by one each time (${seq.slice(1).map((v, i) => v - seq[i]).join(', ')}), so the next jump is ${step + count - 1}: ${seq[count - 1]} + ${step + count - 1} = ${next}.` : `Each number is double the one before: ${seq[count - 1]} × 2 = ${next}.`;
    return {
      ...base, topic: 'times',
      text: `The glowing numbers go ${seq.map(fmt).join(', ')}, and then... What number comes next?`,
      answer: next,
      working: ['Look at how the numbers change from one to the next.', rule],
    };
  }
  if (spec.kind === 'order') {
    const [theme, count, ask] = n;
    const order = n.slice(3); // order[i] = which name sits in place i (0 = far left)
    const a = ANIMALS[theme];
    const nameAt = (place: number) => a.names[order[place]];
    // The clues chain neighbours together: place 0 is left of place 1, and so on. They are told in a mixed-up order.
    const clues = Array.from({ length: count - 1 }, (_, i) => (i + theme) % 2 === 0 ? `${nameAt(i)} sits left of ${nameAt(i + 1)}.` : `${nameAt(i + 1)} sits right of ${nameAt(i)}.`);
    if (clues.length > 1) clues.push(clues.shift()!);
    const askPlace = ask === 0 ? 0 : ask === 1 ? count - 1 : Math.floor((count - 1) / 2) + (count === 4 ? 1 : 0);
    const question = ask === 0 ? 'Who sits furthest left?' : ask === 1 ? 'Who sits furthest right?' : count === 4 ? 'Who sits third from the left?' : 'Who sits in the middle?';
    const names = [...a.names].slice(0, count);
    const choices = [...names].sort().map((nm) => ({ value: (a.names as readonly string[]).indexOf(nm) + 1, label: nm }));
    return {
      ...base, topic: 'times',
      text: `${COUNT_WORDS[count]} ${a.word} sit in a row ${a.where}: ${names.slice(0, -1).join(', ')} and ${names[count - 1]}. ${clues.join(' ')} ${question}`,
      answer: order[askPlace] + 1,
      choices,
      working: ['Put the clues together to find the order, left to right.', `The order is ${order.map((_, i) => nameAt(i)).join(', ')}.`, `${question.replace('?', '')}: ${nameAt(askPlace)}.`],
    };
  }
  if (spec.kind === 'riddle') {
    const [x, mul, add, minus] = n;
    const result = minus ? x * mul - add : x * mul + add;
    const op = minus ? 'take away' : 'add';
    return {
      ...base, topic: 'times',
      text: `I am a secret number. Multiply me by ${mul}, then ${op} ${add}, and you get ${fmt(result)}. What number am I?`,
      answer: x,
      working: [
        `Work backwards. Undo the last step: ${minus ? `${fmt(result)} + ${add}` : `${fmt(result)} − ${add}`} = ${fmt(x * mul)}.`,
        `Now undo the multiplying: ${fmt(x * mul)} ÷ ${mul} = ${fmt(x)}.`,
      ],
    };
  }
  const [start, change] = n;
  const answer = start + change;
  return {
    ...base, topic: 'integers',
    text: `At the cave door it is ${fmt(start)} degrees. Deeper in, it is ${fmt(Math.abs(change))} degrees ${change < 0 ? 'colder' : 'warmer'}. What is the temperature there?`,
    answer,
    unit: 'degrees',
    working: [
      `${change < 0 ? 'Colder means taking away' : 'Warmer means adding'}: ${fmt(start)} ${change < 0 ? '−' : '+'} ${fmt(Math.abs(change))}.`,
      `${fmt(start)} ${change < 0 ? '−' : '+'} ${fmt(Math.abs(change))} = ${fmt(answer)}.${answer < 0 ? ' That is below zero, so it is a negative number.' : ''}`,
    ],
  };
}

/** Pick the numbers for a puzzle at a year band from a seed. */
export function makePuzzle(kind: PuzzleKind, band: YearBand, seed: number): PuzzleSpec {
  const h: HasRng = { rng: seed | 0 };
  if (kind === 'pattern') {
    const variant = band === 4 ? 0 : band === 5 ? pick(h, [0, 1]) : pick(h, [1, 2]);
    const start = variant === 2 ? int(h, 1, 5) : int(h, 1, band === 4 ? 12 : 20);
    const step = variant === 0 ? (band === 4 ? int(h, 2, 6) : int(h, 4, 12)) : variant === 1 ? int(h, 1, 3) : 2;
    return { kind, nums: [variant, start, step, PATTERN_COUNT] };
  }
  if (kind === 'order') {
    const count = band === 4 ? 3 : 4;
    const order = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) {
      const j = roll(h, i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return { kind, nums: [roll(h, ANIMALS.length), count, roll(h, ASKS.length), ...order] };
  }
  if (kind === 'riddle') {
    const minus = band === 4 ? 0 : roll(h, 2);
    const mul = band === 4 ? int(h, 2, 5) : int(h, 3, 9);
    const x = int(h, 2, band === 4 ? 10 : 15);
    const add = int(h, 2, band === 4 ? 9 : 20);
    return { kind, nums: [x, mul, minus ? Math.min(add, x * mul - 1) : add, minus] };
  }
  const start = int(h, 2, 9);
  return { kind, nums: [start, -(start + int(h, 1, 10))] };
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export type Size = 'small' | 'medium' | 'big';

/** What a choice (or a puzzle answer) leads to. */
export interface Outcome {
  text: string;
  gold?: Size;
  followers?: Size;
  /** Training points for every member. */
  points?: Size;
  /** The name of a found item (one of the game's items). */
  item?: string;
}

export interface QuestChoice {
  label: string;
  /** The clan's best charisma has to reach this to pick it. */
  charm?: 'open' | 'high';
  /** A puzzle on the way. */
  puzzle?: PuzzleKind;
  /** What you get (for a puzzle: when you answer right). */
  win: Outcome;
  /** For a puzzle: when you answer wrong or ask for the working. The story still carries on. */
  lose?: Outcome;
}

export interface QuestDef {
  id: number;
  title: string;
  /** Which years can be given this quest. */
  years: readonly YearBand[];
  /** The story, one paragraph at a time. */
  story: string[];
  choices: QuestChoice[];
}

const ALL: readonly YearBand[] = [4, 5, 6];

export const QUESTS: QuestDef[] = [
  {
    id: 1, title: 'The Wandering Goat', years: ALL,
    story: [
      'A goat with a bell round its neck trots into your camp and starts eating the cabbages. It does not seem sorry at all.',
      'A farmer far down the road is probably missing it. But the goat keeps looking at a hill, as if it wants you to follow.',
    ],
    choices: [
      { label: 'Walk the goat home to the farmer', win: { text: 'The farmer is so happy that he gives you a bag of coins and a very large cheese. The goat nibbles your sleeve to say thank you.', gold: 'medium' } },
      { label: 'Follow the goat up the hill', win: { text: 'Over the hill is a camp of travellers who lost their goat-cart. They like your clan so much that some of them join you.', followers: 'medium' } },
      { label: 'Charm the farmer’s grumpy aunt, too', charm: 'open', win: { text: 'Auntie scowls at first, but your charming chat makes her laugh until she cries. She gives your clan a big reward and tells all her friends how kind you are.', gold: 'big', followers: 'small' } },
    ],
  },
  {
    id: 2, title: 'The Stepping Stones', years: ALL,
    story: [
      'A wide river bubbles across your path. There is a bridge, but it is a day’s walk away.',
      'Across the water, flat stones are painted with glowing numbers. A sign says: "Step where the pattern goes."',
    ],
    choices: [
      { label: 'Hop across the stones', puzzle: 'pattern', win: { text: 'You hop across without a splash! On the far bank you find a purse that a very wet frog left behind.', gold: 'big' }, lose: { text: 'Splash! You land in the shallow water and everyone laughs, even you. You still reach the other side, and find a coin stuck to your boot.', gold: 'small' } },
      { label: 'Wade through the shallows', win: { text: 'It is a bit chilly, but nobody minds. A fisher on the bank thinks you are very sensible and asks to join the clan.', followers: 'small' } },
    ],
  },
  {
    id: 3, title: 'The Three Guards', years: ALL,
    story: [
      'A narrow bridge is guarded by a row of sleepy birds. A little sign says: "Only the clever may pass."',
      'The head guard clears its throat. "Tell me who sits where, and the toll is free. Listen to the clues."',
    ],
    choices: [
      { label: 'Work out the puzzle', puzzle: 'order', win: { text: 'The guards cheer! "Clever clan!" They let you cross, hand you a toll refund and teach you a few tricks.', gold: 'medium', points: 'small' }, lose: { text: 'The guards chuckle and tell you the answer anyway. "Good try!" They let you cross for a small fee, and wave you off kindly.', gold: 'small' } },
    ],
  },
  {
    id: 4, title: 'The Riddling Troll', years: ALL,
    story: [
      'Under a bridge lives a troll who loves riddles more than anything. He is not scary, just bored.',
      '"Nobody ever stops to chat," he sighs. "Will you play with me?"',
    ],
    choices: [
      { label: 'Answer the troll’s riddle', puzzle: 'riddle', win: { text: 'The troll claps so hard that the bridge wobbles. "Wonderful!" he says. He is so pleased that his cousins come and join your clan.', followers: 'big' }, lose: { text: 'The troll shows you how the riddle works, and you both laugh. He gives you a friendly handshake and one of his cousins comes to meet you.', followers: 'small' } },
      { label: 'Tell the troll a joke about a sheep', charm: 'open', win: { text: 'The troll laughs until he falls off his stool. "Best joke ever!" He sends two of his friends to join you and gives you a coin for the joke.', followers: 'medium', gold: 'small' } },
    ],
  },
  {
    id: 5, title: 'The Frozen Cave', years: [6],
    story: [
      'A cave in the side of a mountain breathes out cold air that makes your breath puff in white clouds.',
      'Inside, a sleeping dragon’s treasure sparkles, and a sign on the wall says: "Learn how cold it gets before you go in."',
    ],
    choices: [
      { label: 'Check the cold before going in', puzzle: 'cold', win: { text: 'You wrap up warm, tiptoe past the snoring dragon and scoop up a handful of coins. Your clan stays toasty the whole time.', gold: 'big' }, lose: { text: 'You get a bit chilly, and your teeth chatter so loudly that the dragon rolls over in its sleep. You grab a few coins and sneak out.', gold: 'small' } },
      { label: 'Wait outside and warm up the clan', win: { text: 'You make a campfire and share hot soup. A passing traveller smells it and asks to join.', followers: 'small' } },
    ],
  },
  {
    id: 6, title: 'The Village Fair', years: ALL,
    story: [
      'Bunting flaps in the breeze, a band plays out of tune, and the smell of pies drifts across the green.',
      'The fair needs helpers. Everybody looks hopefully at your clan.',
    ],
    choices: [
      { label: 'Help at the pie stall', win: { text: 'You sell pies all afternoon. The pie-maker pays you with gold and some very warm pies.', gold: 'small', followers: 'small' } },
      { label: 'Juggle for the crowd', win: { text: 'You drop two apples, but the crowd loves it. People throw coins in your hat.', gold: 'medium' } },
      { label: 'Give a speech from the cart', charm: 'open', win: { text: 'Your clan’s speech is so charming that the whole fair cheers. Lots of people ask to join, and the mayor gives you a thank-you purse.', followers: 'big', gold: 'small' } },
    ],
  },
  {
    id: 7, title: 'The Wishing Well', years: ALL,
    story: [
      'In the middle of a forgotten garden stands a mossy well. Something glints at the bottom.',
      'A little sign, half hidden in ivy, reads: "Be kind, and the well is kind back."',
    ],
    choices: [
      { label: 'Reach down with a long stick', win: { text: 'You fish out a tunic that someone dropped long ago. It is a little damp, but it dries out soft and warm.', item: 'Cloth Tunic' } },
      { label: 'Make a kind wish for the whole clan', win: { text: 'You wish that everyone in the clan gets better at something. The well glows softly and every member feels a tiny bit wiser.', points: 'medium' } },
    ],
  },
  {
    id: 8, title: 'The Pattern Door', years: ALL,
    story: [
      'At the end of a corridor is a round stone door covered in glowing tiles. The tiles show a row of numbers, and an empty circle at the end.',
      'Humming from behind the door sounds like a very friendly cat.',
    ],
    choices: [
      { label: 'Press the right number into the circle', puzzle: 'pattern', win: { text: 'Click! The door swings open. Behind it a very friendly cat gives you a pat of thanks, a few coins and a lesson in thinking.', gold: 'small', points: 'medium' }, lose: { text: 'The door gives a polite buzz, then opens anyway. "Nearly!" says the cat, and shows you the pattern. You learn a bit.', points: 'small' } },
    ],
  },
  {
    id: 9, title: 'The Sleepy Giant', years: ALL,
    story: [
      'A giant is snoring across the road, with a hat over his face. Each snore blows leaves into the air.',
      'You could tiptoe round him. Or you could wake him up and see what happens.',
    ],
    choices: [
      { label: 'Tiptoe past, very quietly', win: { text: 'You make it past without a single creak! A pouch of coins has fallen out of his pocket, and you leave a note to say sorry.', gold: 'small' } },
      { label: 'Wake him gently and ask for a favour', charm: 'high', win: { text: 'The giant yawns, then smiles. "What good manners!" He gives your clan his old shield, which is huge for him but just right for you.', item: "Lion's Shield", gold: 'small' } },
    ],
  },
  {
    id: 10, title: 'The Pie Cart Puzzle', years: ALL,
    story: [
      'A pie seller waves you over. His cart is full of pies, but he has lost count and cannot remember his secret number.',
      '"Each day I count the pies a special way," he says. "Can you help?"',
    ],
    choices: [
      { label: 'Help him work out the number', puzzle: 'riddle', win: { text: 'The pie seller does a happy dance. "That is the number!" He gives you coins for your help and a few pies for the journey.', gold: 'medium', followers: 'small' }, lose: { text: 'You and the pie seller work it out together, with plenty of pie crumbs. He pays you a little for your time.', gold: 'small' } },
    ],
  },
];

export const questById = (id: number) => QUESTS.find((q) => q.id === id);

// ---------------------------------------------------------------------------
// Which quest, who can pick what, and applying the prize
// ---------------------------------------------------------------------------

/** Does this quest suit the settings? Year 6 puzzles about below-zero numbers only appear at Year 6 and only while the teacher has that topic on. */
export function suits(q: QuestDef, settings: PracticalSettings): boolean {
  if (!q.years.includes(settings.yearBand)) return false;
  return q.choices.every((c) => c.puzzle !== 'cold' || topicAvailable(settings, 'integers'));
}

export const questsFor = (settings: PracticalSettings): QuestDef[] => QUESTS.filter((q) => suits(q, settings));

const mix = (a: number, b: number) => (Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35)) | 0;

/**
 * Today's quest: the suitable quests in an order fixed by the clan's seed, one per day, cycling.
 * Null if none suits the settings.
 */
export function todaysQuest(baseSeed: number, day: number, settings: PracticalSettings): QuestDef | null {
  const list = questsFor(settings);
  if (list.length === 0) return null;
  const h: HasRng = { rng: mix(baseSeed, 1234) };
  const order = list.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = roll(h, i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return list[order[(Math.max(1, day) - 1) % order.length]];
}

/** Has the clan done today's quest? */
export const questDoneToday = (clan: Clan, day: number) => clan.questDay === day;

/** The best charisma in the clan: the one who does the talking. */
export function bestCharm(clan: Clan): { value: number; member: Member | null } {
  let best: Member | null = null;
  for (const m of clan.members) if (!best || m.stats.charisma > best.stats.charisma) best = m;
  return { value: best ? best.stats.charisma : 0, member: best };
}

/** Can the clan pick this choice? If not, a kind sentence saying what would unlock it. */
export function choiceOpen(clan: Clan, choice: QuestChoice): { open: true } | { open: false; say: string } {
  if (!choice.charm) return { open: true };
  const need = Q.charm[choice.charm];
  const { value } = bestCharm(clan);
  if (value >= need) return { open: true };
  return { open: false, say: `This needs a charming member (charisma ${need} or more). Your most charming member has ${value}. Training charisma at the Training Hall can open it.` };
}

/** The numbers for a choice's puzzle today: fixed by the seed, the day, the quest and the choice. */
export function puzzleFor(q: QuestDef, choiceIndex: number, baseSeed: number, day: number, settings: PracticalSettings): PuzzleSpec | null {
  const kind = q.choices[choiceIndex]?.puzzle;
  if (!kind) return null;
  return makePuzzle(kind, settings.yearBand, mix(mix(baseSeed, day), q.id * 10 + choiceIndex));
}

/** What really landed on the clan. */
export interface QuestPrize {
  gold: number;
  followers: number;
  /** Training points given to each member. */
  points: number;
  /** A found item, and who got it. Missing if there was no item or nobody could use it (then gold was given instead). */
  item?: { name: string; member: string };
}

export type QuestDone = { ok: true; text: string; right: boolean | null; prize: QuestPrize } | { ok: false; say: string };

const itemByName = (name: string): ItemDef | undefined => ITEMS.find((i) => i.name === name);

/** Who can use an item: has nothing in that slot and meets its base-stat needs. Weakest-kitted first. */
function wearer(clan: Clan, item: ItemDef): Member | null {
  const needsMet = (m: Member) => Object.entries(item.needs).every(([stat, v]) => m.stats[stat as keyof Member['stats']] >= (v ?? 0));
  return clan.members.find((m) => !m.gear[item.kind] && needsMet(m)) ?? null;
}

/**
 * Do the quest: check it is allowed, put the prize on the clan, and mark the day as done.
 * `right` is how the puzzle went (true right, false wrong or skipped), or null if the choice had no puzzle.
 */
export function finishQuest(clan: Clan, day: number, q: QuestDef, choiceIndex: number, right: boolean | null): QuestDone {
  const choice = q.choices[choiceIndex];
  if (!choice) return { ok: false, say: 'That choice is not in this story.' };
  if (questDoneToday(clan, day)) return { ok: false, say: 'Your clan has already done its quest today. Come back tomorrow for a new one.' };
  const open = choiceOpen(clan, choice);
  if (!open.open) return { ok: false, say: open.say };
  const outcome = choice.puzzle && !right ? (choice.lose ?? choice.win) : choice.win;
  const prize: QuestPrize = {
    gold: outcome.gold ? Q.reward.gold[outcome.gold] : 0,
    followers: outcome.followers ? Q.reward.followers[outcome.followers] : 0,
    points: outcome.points ? Q.reward.points[outcome.points] : 0,
  };
  let text = outcome.text;
  if (outcome.item) {
    const item = itemByName(outcome.item);
    const who = item && item.price <= Q.itemMaxPrice ? wearer(clan, item) : null;
    if (item && who) {
      who.gear[item.kind] = item.name;
      prize.item = { name: item.name, member: who.name };
    } else if (item) {
      prize.gold += Math.ceil(item.price / 2);
      text += ' Nobody in the clan could use it just now, so you sold it for a fair price.';
    }
  }
  clan.gold += prize.gold;
  clan.followers += prize.followers;
  for (const m of clan.members) m.points += prize.points;
  clan.questDay = day;
  return { ok: true, text, right: choice.puzzle ? !!right : null, prize };
}

/** The most one quest can give of each thing (for checking rewards stay small next to the Mines). */
export function mostPrize(q: QuestDef): { gold: number; followers: number; points: number } {
  const best = { gold: 0, followers: 0, points: 0 };
  for (const c of q.choices) {
    for (const o of [c.win, c.lose]) {
      if (!o) continue;
      const item = o.item ? itemByName(o.item) : undefined;
      best.gold = Math.max(best.gold, (o.gold ? Q.reward.gold[o.gold] : 0) + (item ? Math.ceil(item.price / 2) : 0));
      best.followers = Math.max(best.followers, o.followers ? Q.reward.followers[o.followers] : 0);
      best.points = Math.max(best.points, o.points ? Q.reward.points[o.points] : 0);
    }
  }
  return best;
}
