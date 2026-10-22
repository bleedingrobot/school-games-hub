/** Words and small facts for Star Trader (short, kind, plain; written for Year 4 to 6). */
import { GOODS } from '../../../shared/trader/config';

export const GOOD_ICONS: Record<string, string> = {
  Water: '💧', Furs: '🧥', Food: '🍎', Ore: '🪨', Games: '🎮', Fireworks: '🎆', Medicine: '💊', Machines: '⚙️', Lollies: '🍭', Robots: '🤖',
};
export const goodIcon = (good: number): string => GOOD_ICONS[GOODS[good]] ?? '📦';

/** True facts about each world (checked against NASA's planet and moon pages). Where it sits on our map is made up. */
export const PLANET_FACTS: Record<string, string> = {
  Mercury: 'The closest planet to the Sun. Its days are scorching and its nights are freezing.',
  Venus: 'The hottest planet, wrapped in thick clouds. A day on Venus is longer than its year.',
  Earth: 'Home! The only world we know with life, and most of its surface is water.',
  Mars: 'The Red Planet. Rusty dust covers it, and it has the tallest volcano we know of.',
  Ceres: 'The biggest object in the asteroid belt. It is a dwarf planet with bright salty spots.',
  Jupiter: 'The biggest planet. Its Great Red Spot is a storm bigger than Earth.',
  Saturn: 'Famous for its rings of ice and rock. It is so light it would float in a big enough bath!',
  Uranus: 'An ice giant that spins on its side, like a rolling ball.',
  Neptune: 'A deep blue ice giant with supersonic winds, faster than the speed of sound.',
  Pluto: 'A small, icy dwarf planet with a heart-shaped glacier.',
  Eris: 'A dwarf planet about the size of Pluto, very far from the Sun.',
  Haumea: 'A dwarf planet shaped like a squashed football. It spins very fast.',
  Makemake: 'A cold, reddish dwarf planet out beyond Neptune.',
  Vesta: 'A giant asteroid with a huge crater at its south pole.',
  Europa: 'A moon of Jupiter with an icy shell and a salty ocean hidden underneath.',
  Io: 'A moon of Jupiter with more active volcanoes than anywhere else we know.',
  Ganymede: 'The biggest moon in the Solar System. It is even bigger than Mercury.',
  Callisto: 'A moon of Jupiter covered in very old craters.',
  Titan: "Saturn's biggest moon, with thick orange air and lakes of liquid methane.",
  Enceladus: 'A small moon of Saturn that shoots jets of icy water into space.',
  Triton: "Neptune's biggest moon. It circles Neptune backwards.",
  Charon: "Pluto's biggest moon. It is so big that Pluto and Charon circle each other.",
  Titania: 'The biggest moon of Uranus.',
  Phobos: 'A tiny, potato-shaped moon of Mars that zips round very close to it.',
};

export const GOVERNMENT_LINES: Record<string, string> = {
  'Pirate haven': 'No rules here. Watch out for pirates!',
  'Merchant guild': 'Traders everywhere. They want Ore.',
  'Class vote': 'Everyone votes on everything. They love Games.',
  "Scientists' council": 'Brainy and busy. They want Water for experiments.',
  Temple: 'Quiet and strict. They crave Lollies.',
  'Peace garden': 'Peaceful. No Fireworks allowed.',
  'Star navy': 'Lots of customs patrols. No Lollies allowed.',
  'Robot council': 'Cold and careful. No Fireworks or Lollies.',
  'Farming co-op': 'Farmers. They want Fireworks for festivals.',
};

/** What made a price jump today (kid-worded). */
export const EVENT_NEWS: Record<string, (good: string) => string> = {
  war: (g) => `There is a war on, so ${g} is dear.`,
  plague: (g) => `A sickness is going round, so ${g} is dear.`,
  drought: (g) => `A drought has dried things up, so ${g} is dear.`,
  boredom: (g) => `Everyone is bored, so ${g} is dear.`,
  cold: (g) => `A big freeze has hit, so ${g} is dear.`,
  'crop failure': (g) => `The crops failed, so ${g} is dear.`,
  'lack of workers': (g) => `There are not enough workers, so ${g} is dear.`,
};

export const SHIP_BLURBS = [
  'A tiny starter pod. Cute, quick and cramped.',
  'A sleek little dart with room for a laser.',
  'A sturdy cargo-fighter with a good fuel tank.',
  'Big and buzzy. Room for two shields.',
  'A roomy hauler with a hold the size of a barn.',
  'A giant freighter. Slow, tough and enormous.',
];

export const PIRATE_NAMES = ['Scrappy pirates', 'Pirate raiders', 'The Pirate Captain'];
