import type { ForestEvent } from './types';

/**
 * Forest events, as data, not code (LORD's scripted events work the same way), so going from a
 * dozen to fifty is writing work. Events never use up a forest fight. The ones with `maths` become
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
    text: 'Two chests sit side by side. One is marked 4,060 coins and the other 4,600 coins. Take the bigger one!',
    maths: { topic: 'place-value', reward: { gold: 40 } },
  },
  {
    id: 'old-woman-riddle', title: 'The old woman\'s riddle',
    text: 'An old woman on a stump asks: "What comes next? 3, 7, 11, 15, ..." She will pay you if you get it right.',
    maths: { topic: 'patterns', reward: { gold: 30, exp: 10 } },
  },
  {
    id: 'gem-goblins', title: 'The gem-sharing goblins',
    text: 'Three goblins have 24 gems and one huge argument. If they share them out fairly, what does each goblin get?',
    maths: { topic: 'division', reward: { exp: 20, gold: 10 } },
  },
  {
    id: 'honest-pedlar', title: 'The honest pedlar',
    text: 'A pedlar sells you a pie for 12 gold. You hand him 20 gold. How much change should he give you?',
    maths: { topic: 'money', reward: { gold: 15 } },
  },
];

export const EVENT_BY_ID: Record<string, ForestEvent> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
