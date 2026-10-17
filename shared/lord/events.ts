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
];

export const EVENT_BY_ID: Record<string, ForestEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
