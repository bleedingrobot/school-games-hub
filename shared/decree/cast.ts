/**
 * Everyone who comes to the throne with a request. The first six are Kingdom Keeper's council (their pictures are
 * reused); the rest are new, each painted for Royal Decree (docs/DECREE-ART-PLAN.md).
 */
import type { Villager } from './types';

export const CAST: Villager[] = [
  { id: 'steward', name: 'Hale', role: 'the royal steward' },
  { id: 'reeve', name: 'Marigold', role: 'the head farmer' },
  { id: 'ratcatcher', name: 'Nettle', role: 'the rat catcher' },
  { id: 'trader', name: 'Quince', role: 'the trader' },
  { id: 'healer', name: 'Rowan', role: 'the healer' },
  { id: 'builder', name: 'Bram', role: 'the builder' },
  { id: 'baker', name: 'Pip', role: 'the baker' },
  { id: 'fisher', name: 'Tama', role: 'the fisher' },
  { id: 'knight', name: 'Sir Ash', role: 'the youngest knight' },
  { id: 'wizard', name: 'Old Fern', role: 'the castle wizard' },
  { id: 'goatherd', name: 'Hettie', role: 'the goat farmer' },
  { id: 'jester', name: 'Bobbin', role: 'the jester' },
  { id: 'smith', name: 'Ingrid', role: 'the blacksmith' },
  { id: 'shepherd', name: 'Kit', role: 'the young shepherd' },
  { id: 'merchant', name: 'Lady Saffron', role: 'the spice merchant' },
  { id: 'inventor', name: 'Cog', role: 'the inventor' },
  { id: 'musician', name: 'Lark', role: 'the musician' },
  { id: 'gardener', name: 'Moss', role: 'the royal gardener' },
  { id: 'captain', name: 'Captain Bryn', role: 'the captain of the guard' },
  { id: 'scholar', name: 'Ada', role: 'the librarian' },
  { id: 'explorer', name: 'Rua', role: 'the explorer' },
  { id: 'beekeeper', name: 'Honey', role: 'the beekeeper' },
  { id: 'dragonkeeper', name: 'Wren', role: 'the dragon keeper' },
  { id: 'cook', name: 'Lupe', role: 'the castle cook' },
  { id: 'fortune', name: 'Opal', role: 'the fortune teller' },
  { id: 'taxman', name: 'Penny', role: 'the tax counter' },
  { id: 'ringmaster', name: 'Dash', role: 'the circus ringmaster' },
  { id: 'miller', name: 'Ox', role: 'the miller' },
  { id: 'cat', name: 'Sir Whiskers', role: 'the royal cat' },
  { id: 'messenger', name: 'Zip', role: 'the messenger' },
  { id: 'queen', name: 'Queen Ysolde', role: 'the queen next door' },
  { id: 'ghost', name: 'Gilbert', role: 'the friendly castle ghost' },
];

export const villager = (id: string) => CAST.find((v) => v.id === id);
