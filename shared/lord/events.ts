import type { ForestEvent } from './types';

/**
 * Forest events, as data, not code (LORD's scripted events work the same way), so going from a
 * dozen to fifty is writing work. A maths event's text only sets the scene: the question itself comes from a shared maths pack, so the text must not state numbers. Events never use up a forest fight. The ones with `maths` become
 * a question on the screen (L.2): the reward is paid only for a right answer, and a wrong answer
 * shows the worked solution and costs nothing. Events with no maths are just luck and jokes.
 */
export const EVENTS: ForestEvent[] = [
  { id: 'lost-purse', title: 'A lost purse', text: 'Under a bush: a purse. Someone has very kindly lost it for you.', gold: 25 },
  { id: 'fairy', title: 'The fairy', text: 'A fairy tumbles out of a flower and sneezes. Magic dust settles over you, and your aches float away.', heal: 'full' },
  { id: 'rubbish-map', title: 'The treasure map', text: 'A treasure map! It is a very detailed map of the village rubbish tip. You keep it anyway.', exp: 5 },
  { id: 'old-man', title: 'The old man\'s cart', text: 'An old man\'s cart is stuck in the mud. You push. He gives you a little gold and a lot of thanks.', gold: 15, kindness: 1 },
  { id: 'sleeping-bear', title: 'The sleeping bear', text: 'A huge bear is snoring in the path. You tiptoe round it. The bear dreams about honey and does not notice.', exp: 10 },
  { id: 'gem-glint', title: 'Something shiny', text: 'A glint in the stream. A gem! A real one, and only slightly chewed by a fish.', gems: 1 },
  { id: 'echo', title: 'The shouting hill', text: 'You shout "HELLO!" from the top of the hill. The hill shouts back "HELLO!" and then, a moment later, "WHO ARE YOU?"', exp: 5 },
  {
    id: 'treasure-piles', title: 'The treasure piles',
    text: 'Two chests sit side by side, each stamped with a number of coins. A sign says: "Only those who can read numbers may open the chests."',
    maths: { topic: 'place-value', reward: { gold: 40 } },
  },
  {
    id: 'old-woman-riddle', title: 'The old woman\'s riddle',
    text: 'An old woman on a stump cackles: "Answer my riddle, hero, and I will pay you well!"',
    maths: { topic: 'patterns', reward: { gold: 30, exp: 10 } },
  },
  {
    id: 'gem-goblins', title: 'The gem-sharing goblins',
    text: 'Some goblins have found a heap of gems and are having one huge argument about who gets what. They want a hero to settle it with a sum.',
    maths: { topic: 'division', reward: { exp: 20, gold: 10 } },
  },
  {
    id: 'honest-pedlar', title: 'The honest pedlar',
    text: 'A pedlar waves a pie under your nose. "Bargain!" he says. You count your gold carefully, because pedlars are good at sums, too.',
    maths: { topic: 'money', reward: { gold: 15 } },
  },
  { id: 'singing-frog', title: 'The singing frog', text: 'A frog on a log is singing very badly. You clap politely. It bows, and drops a coin from its hat.', gold: 10 },
  { id: 'friendly-troll', title: 'The friendly troll', text: 'A big troll blocks the path. You hold your breath. He just wants to know where the nearest bakery is. You point. He cries with joy.', kindness: 1, exp: 8 },
  { id: 'mushroom-ring', title: 'The mushroom ring', text: 'You step into a ring of mushrooms. They hum a soft tune and you feel better already.', heal: 0.5 },
  { id: 'lost-lamb', title: 'The lost lamb', text: 'A little lamb is stuck in a bramble bush. You free it, and it follows you home before a farmer thanks you with a coin.', gold: 12, kindness: 1 },
  { id: 'pie-cart', title: 'The pie cart', text: 'A cart with a very hot pie sits by the road. There is no one in sight, only a sign: "Help yourself, and tell no one." You do, and feel much better.', heal: 0.25 },
  { id: 'woodcutter', title: 'The woodcutter', text: 'A woodcutter has locked himself out of his own hut. You lift the latch with a twig. He pays you in firewood and a little coin.', gold: 18, kindness: 1 },
  { id: 'shooting-star', title: 'The shooting star', text: 'A shooting star falls into the stream with a small, polite plop. You fish it out. It is a gem now.', gems: 1 },
  { id: 'echo-cave', title: 'The echo cave', text: 'You shout your name into a cave. A voice replies with a different, much better name for you.', exp: 6 },
  { id: 'wishing-well', title: 'The wishing well', text: 'You toss in a coin and wish for a better sword. Something in the well mutters "we will see". Then, a few moments later, it gives you back two coins.', gold: 16 },
  { id: 'wise-owl', title: 'The wise owl', text: 'An owl on a branch gives you a long look and a short piece of advice: "Duck."', exp: 12 },
  {
    id: 'bridge-toll', title: 'The bridge toll',
    text: 'A grumpy goblin sits by a wobbly bridge with a tin cup. "Toll!" he squeaks. He takes payment in coins, but only if you can count them out correctly.',
    maths: { topic: 'money', reward: { gold: 25 } },
  },
  {
    id: 'stepping-stones', title: 'The stepping stones',
    text: 'A river crosses the path. The stones across it are all marked with numbers. Step on the wrong one and it wobbles. The right ones follow a pattern.',
    maths: { topic: 'patterns', reward: { gold: 20, exp: 10 } },
  },
  {
    id: 'baker-ovens', title: 'The baker\'s ovens',
    text: 'A baker is in a flap. Her ovens have all been loaded with trays, and she needs the total number of buns, quickly. "Help, and I will give you a bun!" She is not good at sums.',
    maths: { topic: 'times-tables', reward: { gold: 20, exp: 10 } },
  },
  {
    id: 'goblin-market', title: 'The goblin market',
    text: 'A goblin market has popped up in a clearing. Every stall has a price and a sum, and the goblins will not let you pass without doing one.',
    maths: { topic: 'add-sub', reward: { gold: 25 } },
  },
  {
    id: 'cake-fairies', title: 'The cake fairies',
    text: 'Two fairies have baked one enormous cake and cannot agree how to cut it. They need a hero who understands fractions. They offer a gem for the right answer.',
    maths: { topic: 'fractions', reward: { gems: 1, exp: 10 } },
  },
  {
    id: 'merchant-scales', title: 'The merchant\'s scales',
    text: 'A travelling merchant is weighing out spice on a pair of scales and is sure he is being cheated. He has the numbers, but he cannot read them. He pays for a helping hand.',
    maths: { topic: 'decimals', reward: { gold: 25, exp: 10 } },
  },
  {
    id: 'sleeping-giant', title: 'The sleeping giant\'s puzzle',
    text: 'A giant dozes beside a chest with a number lock. A sign reads: "To open, you must know your places." The chest looks well stocked.',
    maths: { topic: 'place-value', reward: { gold: 30 } },
  },
];

/**
 * The events the forest may find when the teacher has some topics off: a maths event about a switched-off topic is
 * left out (the rest of the forest is unchanged, and there are always events with no maths in them).
 */
export const eventsOn = (on: readonly string[]): ForestEvent[] => EVENTS.filter((e) => !e.maths || on.includes(e.maths.topic));

export const EVENT_BY_ID: Record<string, ForestEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));