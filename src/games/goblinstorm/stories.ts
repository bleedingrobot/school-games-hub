/**
 * Goblin Storm stories (docs/plans/stories/PLAN.md, ST.3): the opening, a story the first time each hero is picked, a
 * page the first time each later map is played, and a page the first time each boss is beaten. All skippable, once each.
 * Paintings: art/story/<story id>-<page>.webp (docs/stories-art/goblinstorm.json); a drawn stand-in until then.
 */
import { HEROES, MAPS, type HeroId } from '../../../shared/goblinstorm/config';
import type { ShelfStory, Story, StoryPage } from '../../../shared/kit/stories';

const FILES = import.meta.glob('./art/story/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function art(id: string, n: number): StoryPage['art'] {
  const wide = FILES[`./art/story/${id}-${n}.webp`];
  return wide ? { wide, small: FILES[`./art/story/${id}-${n}-800.webp`] ?? wide } : undefined;
}

type Words = { title: string; text: string; emoji: string; sky: [string, string] };
function story(id: string, title: string, pages: Words[]): Story {
  return { id, title, pages: pages.map((p, i) => ({ title: p.title, text: p.text, art: art(id, i + 1), standIn: { emoji: p.emoji, sky: p.sky } })) };
}

const GREEN: [string, string] = ['#0c1a10', '#2e5a2a'];

export const OPENING = story('goblinstorm-opening', 'The Goblin Storm', [
  { title: 'A green storm', emoji: '🌩️', sky: ['#0c140c', '#3a6a2a'], text: 'One quiet afternoon, a strange green storm rolled over Castle Fields. The clouds giggled. Clouds are not supposed to giggle.' },
  { title: 'Goblins!', emoji: '👺', sky: GREEN, text: 'Then it started to rain goblins. Hundreds of them, with bats and slimes and a very big troll, all running for the castle.' },
  { title: 'The bell rings', emoji: '🔔', sky: ['#1a1410', '#6a4a2a'], text: 'Up in the tower, the castle bell rang out. Ding! Ding! Ding! It only rings for one thing: heroes, come quickly!' },
  { title: 'How long can you last?', emoji: '⚔️', sky: ['#14100c', '#5a2a1a'], text: 'Pick up gems to grow stronger. Choose your powers. The Goblin King is coming at the end. How long can you last?' },
]);

const HERO_WORDS: Record<HeroId, Words[]> = {
  knight: [
    { title: 'The last guard', emoji: '🛡️', sky: ['#141c2a', '#4a5a7a'], text: 'When the goblins came, every guard ran away except one. The Knight just stood at the gate, folded their arms, and said, "No."' },
    { title: 'Grandma\'s blades', emoji: '🗡️', sky: ['#1a1a24', '#6a6a8a'], text: 'The Knight\'s grandmother guarded the castle first. On the Knight\'s first day, Grandma handed over two shining blades and one piece of advice: "Never run."' },
    { title: 'Spinning blades', emoji: '⚔️', sky: ['#101826', '#3a5a8a'], text: 'Now the blades spin around the Knight like a shining shield. Slow, yes, but very, very hard to knock over.' },
  ],
  ranger: [
    { title: 'From the Dark Forest', emoji: '🌲', sky: ['#081408', '#2a4a2a'], text: 'The Ranger grew up deep in the Dark Forest, where the trees are so tall that the sun only visits on Tuesdays.' },
    { title: 'Forest friends', emoji: '🦅', sky: ['#0c1a0c', '#3a5a3a'], text: 'The forest looks after its own. Leaves whirl, hawks dive and wasps sting whenever the Ranger is in trouble.' },
    { title: 'Arrows ready', emoji: '🏹', sky: ['#101a0c', '#4a6a3a'], text: 'Quick on their feet with a sharp eye, the Ranger can pull gems from far away. Goblins never see the arrows coming.' },
  ],
  wizard: [
    { title: 'Oops', emoji: '🔥', sky: ['#1a0c08', '#6a2a1a'], text: 'At wizard school, the Wizard once sneezed during a fire spell and set the whole library alight. Everyone still talks about it.' },
    { title: 'Practice, practice', emoji: '📚', sky: ['#140c20', '#4a2a6a'], text: 'So the Wizard practised every single day, until every fireball went exactly where it was pointed. Well, nearly every one.' },
    { title: 'Bigger spells', emoji: '✨', sky: ['#100820', '#5a3a8a'], text: 'Now the Wizard\'s spells are bigger than anyone else\'s. Goblins have learned to keep away from the purple hat.' },
  ],
  barbarian: [
    { title: 'From the Frozen Peaks', emoji: '🏔️', sky: ['#102030', '#5a7a9a'], text: 'The Barbarian comes from the Frozen Peaks, where people wrestle bears for fun and have snowball fights in blizzards.' },
    { title: 'Cross', emoji: '😠', sky: ['#200c0c', '#7a2a1a'], text: 'He is very friendly, until somebody makes him cross. And the crosser he gets, the harder he hits.' },
    { title: 'Very cross', emoji: '🪓', sky: ['#1a0c08', '#6a3a1a'], text: 'Goblins stole his lunch on the way here. He is now extremely cross. The goblins have made a big mistake.' },
  ],
  cleric: [
    { title: 'The chapel', emoji: '⛪', sky: ['#14141c', '#5a5a6a'], text: 'The Cleric looks after the little chapel by the old graveyard, polishing the bell and keeping the candles lit.' },
    { title: 'A helping hand', emoji: '💛', sky: ['#1a1810', '#7a6a3a'], text: 'Anyone hurt finds their way to the chapel door, and the Cleric always helps. A scraped knee, a sore paw, a broken wing.' },
    { title: 'A ring of light', emoji: '😇', sky: ['#1c1a10', '#8a7a3a'], text: 'Now a ring of holy light goes with the Cleric into battle. It hurts goblins and slowly heals the Cleric as they go.' },
  ],
  rogue: [
    { title: 'Just a joke', emoji: '👑', sky: ['#081418', '#2a4a5a'], text: 'For a joke, the Rogue once sneaked into the goblin camp and swapped the Goblin King\'s crown for a saucepan.' },
    { title: 'Very angry goblins', emoji: '👺', sky: ['#0c1a14', '#2a5a4a'], text: 'The Goblin King did not think it was funny. Now every goblin in the land wants that crown back.' },
    { title: 'Too fast to catch', emoji: '⚡', sky: ['#081418', '#1a5a6a'], text: 'Lucky for the Rogue, nobody is faster. Shadows strike, goblins tumble, and the Rogue is already gone.' },
  ],
  witch: [
    { title: 'Up on the peaks', emoji: '🦉', sky: ['#101a2a', '#6a8aaa'], text: 'High on the coldest mountain lives the Frost Witch, with a family of fluffy snow owls who sit on her hat.' },
    { title: 'A cold welcome', emoji: '❄️', sky: ['#0c1a2a', '#4a7a9a'], text: 'She is kind, but very chilly. Anything that comes close to her starts to shiver and slow right down.' },
    { title: 'Frost rings', emoji: '🔮', sky: ['#081828', '#3a6a9a'], text: 'Rings of frost ripple out from her crystal wand. The owls think it is the best game ever.' },
  ],
  dragonkid: [
    { title: 'A dragon. Really.', emoji: '🐲', sky: ['#200c08', '#7a2a1a'], text: 'Everyone says the Dragon Kid is just a kid in a dragon suit. The Dragon Kid says that is exactly what a dragon would want you to think.' },
    { title: 'Not a monster', emoji: '💪', sky: ['#1a0c08', '#6a3a1a'], text: 'The stories always make dragons the baddies. The Dragon Kid wants to be the first dragon who is a hero instead.' },
    { title: 'Hot breath', emoji: '🔥', sky: ['#200a08', '#8a3a1a'], text: 'Tough scales, tiny wings, and fireballs that really work. The goblins are not laughing at the suit any more.' },
  ],
};

const HERO_NAME = Object.fromEntries(HEROES.map((h) => [h.id, h.name])) as Record<HeroId, string>;
export const heroStoryId = (id: HeroId) => `goblinstorm-hero-${id}`;
export const heroStory = (id: HeroId): Story => story(heroStoryId(id), `The ${HERO_NAME[id]}`, HERO_WORDS[id]);

/** A page the first time each later map is played (Castle Fields is the opening). Index = map index. */
const MAP_WORDS: Record<string, Words> = {
  forest: { title: 'Into the Dark Forest', emoji: '🍄', sky: ['#081008', '#2a3a1a'], text: 'The storm has blown into the Dark Forest. The mushrooms are angry, the wolves are hungry, and somewhere a Forest Ogre is stomping about.' },
  graveyard: { title: 'The Haunted Graveyard', emoji: '👻', sky: ['#0c0c14', '#3a3a5a'], text: 'Mist creeps between the old stones. Skeletons rattle, ghosts go "Wooo," and the Lich is waving its glowing staff.' },
  peaks: { title: 'The Frozen Peaks', emoji: '🏔️', sky: ['#102030', '#7a9aba'], text: 'Up where the snow never melts, yetis are throwing snowballs the size of sheep. High above, an Ice Dragon spreads its wings.' },
  lava: { title: 'The Lava Mines', emoji: '🌋', sky: ['#1a0804', '#8a2a0a'], text: 'Deep under the mountain, the rocks glow red hot. The last of the storm is here, and so is the biggest boss of all: the Fire Dragon.' },
  // The Storm Lands (docs/GOBLINSTORM-STORM-LANDS-PLAN.md)
  sunken: { title: 'The Sunken Kingdom', emoji: '🌊', sky: ['#04141c', '#1f6a7a'], text: 'Under the waves lies a kingdom of coral castles. Sea raiders guard it, jellyfish glow in the dark, and somewhere deep below, the Kraken is tapping all eight feet.' },
  sky: { title: 'The Sky Citadel', emoji: '⛈️', sky: ['#141a2a', '#6f86ad'], text: 'A castle floats on the clouds, and the floor fizzes with lightning. When a ring starts to glow under your feet, move! The Storm Giant is waiting above.' },
  crystal: { title: 'The Crystal Caverns', emoji: '💎', sky: ['#100a1c', '#4a3d78'], text: 'Everything in this cave sparkles, even the monsters. Break a big one and it shatters into little ones. The Crystal Wyrm is coiled in the deepest cave.' },
  swamp: { title: 'The Shadow Swamp', emoji: '🌫️', sky: ['#060c06', '#2c3a2a'], text: 'The fog here is so thick you can barely see your own boots. Wisps giggle in the dark, and three pairs of glowing eyes watch from the water.' },
  citadel: { title: 'The Storm King’s Citadel', emoji: '🌪️', sky: ['#0c0a1c', '#3a3a5a'], text: 'At last: the castle at the heart of the storm. The Goblin Storm was never just a storm. It was the Storm King, and he is very, very grumpy.' },
};
export const mapStoryId = (i: number) => `goblinstorm-map-${MAPS[i].id}`;
export function mapStory(i: number): Story | null {
  const w = MAP_WORDS[MAPS[i]?.id];
  return w ? story(mapStoryId(i), w.title, [w]) : null;
}

/** A page the first time each boss is beaten. */
const BOSS_WORDS: Record<string, Words> = {
  castle: { title: 'The Goblin King runs!', emoji: '👑', sky: ['#14100c', '#6a5a1a'], text: 'The Goblin King drops his club, grabs his saucepan crown, and runs off with his tail between his legs. The storm blows on towards the forest.' },
  forest: { title: 'The Ogre gives up', emoji: '🌲', sky: ['#081008', '#3a5a2a'], text: 'The Forest Ogre sits down with a bump and starts to cry. Then it stomps off home to its mum. The storm drifts on to the graveyard.' },
  graveyard: { title: 'The Lich fades', emoji: '🕯️', sky: ['#0c0c14', '#5a5a7a'], text: 'With a long, sulky "Wooooo," the Lich fades into the mist. The candles flicker back on. The storm creeps up into the mountains.' },
  peaks: { title: 'The Ice Dragon flies away', emoji: '🐉', sky: ['#102030', '#8aaaca'], text: 'The Ice Dragon shakes the snow off its wings and flies far away to sulk on a glacier. The storm sinks down into the mines.' },
  lava: { title: 'The storm is over!', emoji: '🌈', sky: ['#1a1408', '#8a6a2a'], text: 'The Fire Dragon dives into the lava and is gone. The green storm fizzles into a rainbow. The castle bell rings, and this time it rings for you!' },
  sunken: { title: 'The Kraken lets go', emoji: '🐙', sky: ['#04141c', '#2a8a9a'], text: 'The Kraken lets go of the sunken ship, blows a huffy cloud of bubbles, and swims off into the deep. The fish cheer. The storm rises up into the sky.' },
  sky: { title: 'The Giant sits down', emoji: '☁️', sky: ['#1a2a4a', '#8ab0e0'], text: 'With a bump on his head and his club snapped in two, the Storm Giant sits down on a cloud for a little sulk. Blue sky peeks through. The storm sinks into the caves.' },
  crystal: { title: 'The Wyrm sleeps', emoji: '😴', sky: ['#100a1c', '#6a4ab0'], text: 'The Crystal Wyrm curls up in a glittering heap and starts to snore. Every snore makes the crystals ring like bells. The storm creeps off into the swamp.' },
  swamp: { title: 'The fog lifts', emoji: '🐸', sky: ['#0c1a0c', '#6a8a3a'], text: 'The Shadow Hydra slides under the water with three sulky splashes. The sun comes out, the fog melts away, and the frogs sing. Only one castle is left.' },
  citadel: { title: 'The Storm King is beaten!', emoji: '🌈', sky: ['#1a1408', '#c89a3a'], text: 'The Storm King bursts into the biggest rainbow anyone has ever seen. The goblins throw their hats in the air. For the first time in forever, the sky is clear. Storm Breaker!' },
};
export const bossStoryId = (i: number) => `goblinstorm-boss-${MAPS[i].id}`;
export function bossStory(i: number): Story | null {
  const w = BOSS_WORDS[MAPS[i]?.id];
  return w ? story(bossStoryId(i), w.title, [w]) : null;
}

/** The Storm Gate opening (the whole shop bought and the Fire Dragon beaten): shown when the Storm Lands open. */
export const STORM_GATE = story('goblinstorm-gate', 'The Storm Gate', [
  { title: 'The Storm Gate opens', emoji: '🌀', sky: ['#0c0a1c', '#4a3a8a'], text: 'Up in the clouds, a great stone gate creaks open. Behind it the storm is still swirling, over five strange lands nobody has ever seen. The bell rings again. Heroes, come quickly!' },
]);

/** Every Goblin Storm story, for the checks in src/games/stories.test.ts. */
export const ALL_STORIES: Story[] = [
  OPENING,
  STORM_GATE,
  ...HEROES.map((h) => heroStory(h.id)),
  ...MAPS.map((_, i) => mapStory(i)).filter((s): s is Story => !!s),
  ...MAPS.map((_, i) => bossStory(i)).filter((s): s is Story => !!s),
];

/** The Stories shelf: what this pupil has reached so far. */
export function goblinShelf(heroOpen: (id: HeroId) => boolean, mapOpen: (i: number) => boolean, bosses: number[]): ShelfStory[] {
  const out: ShelfStory[] = [{ story: OPENING, open: true }];
  for (const h of HEROES) out.push({ story: heroStory(h.id), open: heroOpen(h.id), hint: h.secret ? 'A secret hero' : `Unlock the ${h.name}` });
  MAPS.forEach((m, i) => {
    const s = mapStory(i);
    if (s) out.push({ story: s, open: mapOpen(i), hint: `Open ${m.name}` });
  });
  MAPS.forEach((m, i) => {
    const s = bossStory(i);
    if (s) out.push({ story: s, open: bosses.includes(i), hint: `Beat the ${m.monsters[4].name}` });
  });
  return out;
}
