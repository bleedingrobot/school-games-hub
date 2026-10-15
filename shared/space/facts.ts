/**
 * Space facts for Wormholes & Black Holes: one for every kind of star, and some for the
 * other things on the board. Short, true, and written for Year 4–6 readers. Each was
 * checked against NASA, ESA or Te Ara (the Encyclopedia of New Zealand) in October 2026.
 *
 * A fact is "discovered" the first time your own rocket lands on that kind of square. The
 * Star chart shows every fact you've discovered (kept on the device, not in the database).
 */
import type { StarKind } from './board';

export type FactId =
  | StarKind
  | 'earth'
  | 'space-station'
  | 'wormhole'
  | 'black-hole'
  | 'comet'
  | 'nebula'
  | 'asteroid'
  | 'heavy-gravity'
  | 'low-gravity'
  | 'slingshot';

export interface SpaceFact {
  id: FactId;
  name: string;
  emoji: string;
  /** Is it a star? Stars come first on the Star chart. */
  star: boolean;
  fact: string;
}

export const FACTS: readonly SpaceFact[] = [
  {
    id: 'red-dwarf',
    name: 'Red dwarf',
    emoji: '🔴',
    star: true,
    fact: 'Red dwarfs are the most common stars in our galaxy. They are small and cool, and they use their fuel so slowly that some will shine for trillions of years.',
  },
  {
    id: 'yellow-star',
    name: 'Yellow star',
    emoji: '🌞',
    star: true,
    fact: 'Our Sun is a yellow star. Its light takes about 8 minutes to reach Earth, so you always see the Sun as it was 8 minutes ago.',
  },
  {
    id: 'blue-giant',
    name: 'Blue giant',
    emoji: '🔵',
    star: true,
    fact: 'Blue giants are some of the hottest, brightest stars. They burn so fast that they last only millions of years. The Sun will last about 10 billion.',
  },
  {
    id: 'white-dwarf',
    name: 'White dwarf',
    emoji: '⚪',
    star: true,
    fact: 'A white dwarf is what is left when a star like the Sun runs out of fuel. It is about as big as Earth, but a teaspoon of it would weigh as much as an elephant.',
  },
  {
    id: 'binary-star',
    name: 'Binary star',
    emoji: '♊',
    star: true,
    fact: 'A binary star is two stars that circle each other. About half of the stars like our Sun have a partner star.',
  },
  {
    id: 'neutron-star',
    name: 'Neutron star',
    emoji: '🧲',
    star: true,
    fact: 'A neutron star is the squashed core of a giant star that exploded. It is only about 20 kilometres across, the size of a city, but heavier than the whole Sun.',
  },
  {
    id: 'pulsar',
    name: 'Pulsar',
    emoji: '📡',
    star: true,
    fact: 'A pulsar is a spinning neutron star. It sweeps beams of radio waves across space like a lighthouse. Some spin hundreds of times every second.',
  },
  {
    id: 'supernova',
    name: 'Supernova',
    emoji: '💥',
    star: true,
    fact: 'A supernova is a giant star exploding. For a few weeks it can shine brighter than a whole galaxy of billions of stars.',
  },
  {
    id: 'matariki',
    name: 'Matariki',
    emoji: '✨',
    star: true,
    fact: 'Matariki is the Māori name for the star cluster also called the Pleiades. In midwinter it rises low in the north-east just before dawn.',
  },
  {
    id: 'earth',
    name: 'Earth',
    emoji: '🌏',
    star: false,
    fact: 'Earth is the third planet from the Sun, and the only place we know of with living things.',
  },
  {
    id: 'space-station',
    name: 'Space station',
    emoji: '🛰️',
    star: false,
    fact: 'The International Space Station flies about 400 kilometres above Earth. It goes all the way round about 16 times a day, so the crew see 16 sunrises.',
  },
  {
    id: 'wormhole',
    name: 'Wormhole',
    emoji: '🌀',
    star: false,
    fact: 'A wormhole would be a shortcut through space. Scientists have worked out on paper how one might exist, but nobody has ever found one.',
  },
  {
    id: 'black-hole',
    name: 'Black hole',
    emoji: '🕳️',
    star: false,
    fact: 'A black hole pulls so hard that not even light can get out. The one in the middle of our galaxy is about 4 million times heavier than the Sun.',
  },
  {
    id: 'comet',
    name: 'Comet',
    emoji: '☄️',
    star: false,
    fact: 'Comets are balls of ice and dust. Near the Sun, the ice turns into gas and makes a glowing tail that can stretch for millions of kilometres.',
  },
  {
    id: 'nebula',
    name: 'Nebula',
    emoji: '🌫️',
    star: false,
    fact: 'A nebula is a giant cloud of gas and dust. Some nebulae are left behind by exploding stars, and new stars are born inside others.',
  },
  {
    id: 'asteroid',
    name: 'Asteroid',
    emoji: '🪨',
    star: false,
    fact: 'Asteroids are rocky leftovers from when the planets formed. Most of the ones in our solar system circle the Sun between Mars and Jupiter.',
  },
  {
    id: 'heavy-gravity',
    name: 'Heavy gravity',
    emoji: '🐢',
    star: false,
    fact: 'Jupiter is so big that its gravity is much stronger than Earth’s. On Jupiter you would weigh about two and a half times as much as you do here.',
  },
  {
    id: 'low-gravity',
    name: 'Low gravity',
    emoji: '🎈',
    star: false,
    fact: 'The Moon’s gravity is about one sixth of Earth’s. Astronauts there bounced along in big, slow hops.',
  },
  {
    id: 'slingshot',
    name: 'Slingshot',
    emoji: '🪃',
    star: false,
    fact: 'Space probes swing past planets and use their gravity like a slingshot to speed up. Voyager 2 did this at Jupiter, Saturn and Uranus on its way to Neptune.',
  },
];

export const FACT_BY_ID: Readonly<Record<FactId, SpaceFact>> = Object.fromEntries(FACTS.map((f) => [f.id, f])) as Record<
  FactId,
  SpaceFact
>;
