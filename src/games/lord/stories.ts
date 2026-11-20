/**
 * Dragon Maths stories (docs/plans/stories/PLAN.md, ST.2 and ST.5): the opening, "The Night the Lights Went Out".
 * Paintings: art/story/<story id>-<page>.webp (docs/stories-art/lord.json). Until a painting exists each page shows its
 * drawn stand-in. Same story as How to play: the Red Dragon took the village's treasure, food and light.
 */
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

export const OPENING = story('lord-opening', 'The Night the Lights Went Out', [
  { title: 'The village of lanterns', emoji: '🏮', sky: ['#1a1430', '#8a5a2a'], text: 'Hollowbrook was a happy village. Every night, a hundred lanterns glowed along its streets, and the bakery smelled of warm bread.' },
  { title: 'Wings in the dark', emoji: '🐉', sky: ['#0e0a18', '#6a1a1a'], text: 'Then one night, the Red Dragon came. It swooped over the rooftops and carried off the treasure, the food, and every last lantern.' },
  { title: 'The village in the dark', emoji: '🌑', sky: ['#08080e', '#1e2030'], text: 'Morning came, but the village stayed sad and dim. The market was empty. Nobody sang at the inn any more.' },
  { title: 'The old training hall', emoji: '🗝️', sky: ['#1a1410', '#5a4a30'], text: 'Old Fern, the oldest person in Hollowbrook, found a rusty key. It opened the training hall, where the great masters once taught heroes.' },
  { title: 'A young hero', emoji: '🗡️', sky: ['#1a2030', '#5a6a4a'], text: 'Someone stepped forward with a wooden sword and a brave heart. "I will learn," they said. "I will get our light back." That someone is you.' },
  { title: 'The road to the lair', emoji: '🌲', sky: ['#0e1a14', '#3a5a3a'], text: 'Fight in the forest. Train with the masters. Grow strong. At the end of the road, the Red Dragon is waiting. Hollowbrook is counting on you!' },
]);

/** Every Dragon Maths story, for the checks in stories.test.ts. */
export const ALL_STORIES: Story[] = [OPENING];

/** The Stories shelf on How to play. */
export function lordShelf(): ShelfStory[] {
  return [{ story: OPENING, open: true }];
}
