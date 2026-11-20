/**
 * Dragon Maths stories (docs/plans/stories/PLAN.md, ST.2 and ST.5): the opening, "The Night the Lights Went Out", a page for
 * meeting each master, Scorchtail's lair before the first dragon fight, and the victory story after the first dragon win.
 * Paintings: art/story/<story id>-<page>.webp (docs/stories-art/lord.json). Until a painting exists each page shows its
 * drawn stand-in. Same story as How to play: the Red Dragon took the village's treasure, food and light.
 */
import type { ShelfStory, Story, StoryPage } from '../../../shared/kit/stories';
import { MASTERS } from '../../../shared/lord/data';
import type { Hero } from '../../../shared/lord/types';

const FILES = import.meta.glob('./art/story/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function art(id: string, n: number): StoryPage['art'] {
  const wide = FILES[`./art/story/${id}-${n}.webp`];
  return wide ? { wide, small: FILES[`./art/story/${id}-${n}-800.webp`] ?? wide } : undefined;
}

type Words = { title: string; text: string; emoji: string; sky: [string, string] };
function story(id: string, title: string, pages: Words[]): Story {
  return { id, title, pages: pages.map((p, i) => ({ title: p.title, text: p.text, art: art(id, i + 1), standIn: { emoji: p.emoji, sky: p.sky } })) };
}

export const OPENING = story('lord-opening', 'The Night the Lights Went Out', [
  { title: 'The village of lanterns', emoji: '🏮', sky: ['#1a1430', '#8a5a2a'], text: 'Hollowbrook was a happy village. Every night, a hundred lanterns glowed along its streets, and the bakery smelled of warm bread.' },
  { title: 'Wings in the dark', emoji: '🐉', sky: ['#0e0a18', '#6a1a1a'], text: 'Then one night, the Red Dragon came. It swooped over the rooftops and carried off the treasure, the food, and every last lantern.' },
  { title: 'The village in the dark', emoji: '🌑', sky: ['#08080e', '#1e2030'], text: 'Morning came, but the village stayed sad and dim. The market was empty. Nobody sang at the inn any more.' },
  { title: 'The old training hall', emoji: '🗝️', sky: ['#1a1410', '#5a4a30'], text: 'Old Fern, the oldest person in Hollowbrook, found a rusty key. It opened the training hall, where the great masters once taught heroes.' },
  { title: 'A young hero', emoji: '🗡️', sky: ['#1a2030', '#5a6a4a'], text: 'Someone stepped forward with a wooden sword and a brave heart. "I will learn," they said. "I will get our light back." That someone is you.' },
  { title: 'The road to the lair', emoji: '🌲', sky: ['#0e1a14', '#3a5a3a'], text: 'Fight in the forest. Train with the masters. Grow strong. At the end of the road, the Red Dragon is waiting. Hollowbrook is counting on you!' },
]);

/** One page for meeting each master (levels 2 to 12): the master's one-line intro, turned into a scene. Keyed by name. */
const MASTER_PAGES: Record<string, Words> = {
  'Master Pip': { title: 'Master Pip', emoji: '🪵', sky: ['#1a1410', '#5a4a30'], text: 'In the training hall stands Master Pip, with a bushy moustache, a very serious frown and a stick as tall as a tree. "Lesson one," says Pip. "Never laugh at the stick."' },
  'Dame Wren': { title: 'Dame Wren', emoji: '🗡️', sky: ['#1a1010', '#6a3a1a'], text: 'Dame Wren sits by the fire, sharpening her sword. "You\'re late," she says, "and your boots are muddy. Let\'s see if your sword arm is better than your manners."' },
  'Sir Tumble': { title: 'Sir Tumble', emoji: '🪣', sky: ['#2a3a4a', '#7a8a5a'], text: 'Sir Tumble trips over his own feet on the way to meet you. Then he trips over a bucket. But when he lifts his sword, he never, ever loses.' },
  'Old Marrow': { title: 'Old Marrow', emoji: '🍵', sky: ['#1a2a1a', '#5a6a3a'], text: 'Old Marrow is older than the oldest tree in the forest. Nobody knows how old. He sips his tea, picks up his staff and smiles. "Ready when you are."' },
  'Madame Quill': { title: 'Madame Quill', emoji: '📜', sky: ['#20182a', '#6a4a6a'], text: 'Madame Quill unrolls a list of rules so long it reaches the floor. Rule one: bow. Rule two: no sulking. Rule three hundred: fight fair. "Shall we begin?"' },
  'Master Basalt': { title: 'Master Basalt', emoji: '🪨', sky: ['#1a1a1a', '#5a5048'], text: 'The ground shakes as Master Basalt walks in. His hands are as big as boulders, and his voice rumbles like gravel. "Go on, then," he says. "Hit me. If you can."' },
  'Lady Thistle': { title: 'Lady Thistle', emoji: '🌸', sky: ['#2a1a30', '#7a5a8a'], text: 'Lady Thistle waits in a garden of purple thistles. She smiles sweetly and offers you a cup of tea. Then she draws her sword. It is very, very sharp.' },
  'Captain Brisk': { title: 'Captain Brisk', emoji: '⏱️', sky: ['#1a2030', '#8a7a5a'], text: 'Captain Brisk checks his pocket watch. "Exactly on time. Good." He has never once been late, and never once been beaten. Today, you could change that.' },
  'Sage Ember': { title: 'Sage Ember', emoji: '🔥', sky: ['#1a0e10', '#8a4a1a'], text: 'Sage Ember carries a little flame in his tall hat. He warms his hands on it while he talks. "Fire is a good friend," he says, "and a bad enemy."' },
  'Warden Stonefist': { title: 'Warden Stonefist', emoji: '🚧', sky: ['#14161a', '#4a4a50'], text: 'At the gate of the last road stands Warden Stonefist, as wide as the gate itself. He folds his huge arms. "Nobody passes without a fight," he growls. "Nobody."' },
  'High Master Orrin': { title: 'High Master Orrin', emoji: '⚔️', sky: ['#1a1428', '#9a6a3a'], text: 'On the mountain path, High Master Orrin waits beneath an old pine. "I am the last master," he says quietly. "Beat me, and only the dragon is left."' },
};

const slug = (name: string) => name.toLowerCase().replace(/^(master|dame|sir|old|madame|lady|captain|sage|warden|high master) /, '').replace(/[^a-z]+/g, '-');

/** The story for meeting the master who takes a hero to `level` (2 to 12), or null if there is none. */
export function masterStory(level: number): Story | null {
  const master = MASTERS.find((m) => m.level === level);
  const page = master && MASTER_PAGES[master.name];
  return master && page ? story(`lord-master-${slug(master.name)}`, `Meeting ${master.name}`, [page]) : null;
}

export const MASTER_STORIES: Story[] = MASTERS.map((m) => masterStory(m.level)).filter((s): s is Story => !!s);

/** Before the first dragon fight. */
export const LAIR = story('lord-lair', 'Scorchtail\'s Lair', [
  { title: 'The smoking mountain', emoji: '🌋', sky: ['#14080a', '#6a2a1a'], text: 'At the end of the road stands a black mountain, with smoke curling from its top. Deep inside, something big is snoring. The stolen lanterns glow in the dark.' },
  { title: 'Scorchtail wakes', emoji: '🐉', sky: ['#0e0608', '#8a2a10'], text: 'A huge yellow eye opens. Scorchtail, the Red Dragon, uncurls from a mountain of gold. "Another little hero?" it rumbles. "Come on, then. Show me what you\'ve got."' },
]);

/** After the first dragon win (like the Clans win story). The dragon is driven off, never hurt on the page. */
export const VICTORY = story('lord-victory', 'The Lights Come Back', [
  { title: 'The dragon gives up', emoji: '💨', sky: ['#2a1a20', '#d08a4a'], text: 'With a great huff of smoke, Scorchtail flops down. "Enough! You win," it grumbles. "Take your shiny things. I\'m going back to sleep." And off it flies, far over the mountains.' },
  { title: 'The treasure comes home', emoji: '🛒', sky: ['#3a5a7a', '#9aba6a'], text: 'You load the treasure, the food and every last lantern onto a cart. The long road home through the forest doesn\'t feel long at all.' },
  { title: 'The lights come back on', emoji: '🏮', sky: ['#1a1430', '#c07a2a'], text: 'That night, Old Fern lights the first lantern. Then the next, and the next. Soon a hundred lanterns glow along the streets of Hollowbrook again.' },
  { title: 'The village cheers', emoji: '🎉', sky: ['#1a1430', '#e0a040'], text: 'The whole village pours into the square. They cheer your name, throw flowers and lift you up on their shoulders. The bakery hands out warm bread for everyone.' },
  { title: 'A gold star', emoji: '⭐', sky: ['#1a1430', '#f0c050'], text: 'Old Fern pins a gold star on your cloak. "A true hero of Hollowbrook," she says. "But heroes never stop training. Who knows what is waiting out there next?"' },
]);

/** Every Dragon Maths story, for the checks in stories.test.ts. */
export const ALL_STORIES: Story[] = [OPENING, ...MASTER_STORIES, LAIR, VICTORY];

/**
 * The Stories shelf on How to play. A story is open once the pupil has seen it, or has got that far: met that master
 * (reached the level just below), reached the dragon, or beaten it.
 */
export function lordShelf(hero: Hero | null = null, seen: (id: string) => boolean = () => false): ShelfStory[] {
  const won = (hero?.dragonKills ?? 0) > 0;
  const out: ShelfStory[] = [{ story: OPENING, open: true }];
  for (const m of MASTERS) {
    const s = masterStory(m.level);
    if (s) out.push({ story: s, open: seen(s.id) || won || (hero?.level ?? 0) >= m.level - 1, hint: `Meet ${m.name}` });
  }
  out.push({ story: LAIR, open: seen(LAIR.id) || won || (hero?.level ?? 0) >= 12, hint: 'Reach the dragon' });
  out.push({ story: VICTORY, open: seen(VICTORY.id) || won, hint: 'Beat the Red Dragon' });
  return out;
}
