/**
 * Star Trader stories (docs/plans/stories/PLAN.md, ST.2): the opening, "A Moon of Your Own", shown once on the title
 * screen with the pupil's captain in the corner. Paintings: art/story/<story id>-<page>.webp (docs/stories-art/trader.json).
 * Until a painting exists each page shows its drawn stand-in.
 */
import type { Story, StoryPage } from '../../../shared/kit/stories';

const FILES = import.meta.glob('./art/story/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function art(id: string, n: number): StoryPage['art'] {
  const wide = FILES[`./art/story/${id}-${n}.webp`];
  return wide ? { wide, small: FILES[`./art/story/${id}-${n}-800.webp`] ?? wide } : undefined;
}

type Words = { title: string; text: string; emoji: string; sky: [string, string] };
function story(id: string, title: string, pages: Words[]): Story {
  return { id, title, pages: pages.map((p, i) => ({ title: p.title, text: p.text, art: art(id, i + 1), standIn: { emoji: p.emoji, sky: p.sky } })) };
}

export const OPENING = story('trader-opening', 'A Moon of Your Own', [
  { title: 'A dream', emoji: '🌙', sky: ['#05060f', '#1a2350'], text: 'Every night, you look up at the stars and dream of one thing: a moon of your very own.' },
  { title: 'The old ship', emoji: '🚀', sky: ['#0a0c18', '#3a3a4a'], text: 'In a dusty corner of the spaceport sits a small, scruffy ship. It is cheap, a bit rusty, and it is all yours.' },
  { title: 'Hello, Bolt!', emoji: '🤖', sky: ['#081420', '#1e4a5a'], text: 'Inside, a little robot blinks awake. "Hello, Captain! I am Bolt. I know every planet out there. Shall we fly?"' },
  { title: 'Buy cheap, sell dear', emoji: '📦', sky: ['#0a1020', '#3a2a5a'], text: 'Food is cheap on farm worlds. Machines are cheap where the factories are. Buy where it is cheap and sell where it is dear.' },
  { title: 'Watch out', emoji: '🏴‍☠️', sky: ['#14060a', '#4a1a2a'], text: 'Space has pirates and floating junk. A clever captain can talk, trade, run, or fight their way past.' },
  { title: 'Your moon is waiting', emoji: '✨', sky: ['#05060f', '#4a3a10'], text: 'Save up enough credits, and a real moon will have your name on it. Fuel up, Captain. The stars are waiting!' },
]);

/** Every Star Trader story, for the checks in stories.test.ts. */
export const ALL_STORIES: Story[] = [OPENING];
