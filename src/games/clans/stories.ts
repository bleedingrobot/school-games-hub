/**
 * Clan Quest's stories (docs/plans/stories/PLAN.md, ST.2): the opening, each season monster's arrival, and the win stories
 * (words in monsterStoryPages.ts). Paintings: art/story/<story id>-<page>.webp (docs/stories-art/clans.json); the win
 * stories keep their old paintings in art/season-monsters/. Until a painting exists each page shows its drawn stand-in.
 */
import type { MonsterKind } from '../../../shared/clans/types';
import type { ShelfStory, Story, StoryPage } from '../../../shared/kit/stories';
import { storyArt } from './art';
import { MONSTER_STORIES } from './monsterStoryPages';

const FILES = import.meta.glob('./art/story/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function art(id: string, n: number): StoryPage['art'] {
  const wide = FILES[`./art/story/${id}-${n}.webp`];
  return wide ? { wide, small: FILES[`./art/story/${id}-${n}-800.webp`] ?? wide } : undefined;
}

type Words = { title: string; text: string; emoji: string; sky: [string, string] };
function story(id: string, title: string, pages: Words[]): Story {
  return { id, title, pages: pages.map((p, i) => ({ title: p.title, text: p.text, art: art(id, i + 1), standIn: { emoji: p.emoji, sky: p.sky } })) };
}

export const OPENING = story('clans-opening', 'The Valley of Clans', [
  { title: 'The Valley of Clans', emoji: '🏞️', sky: ['#1b2a3a', '#5a7a5a'], text: 'Long ago, the valley was full of brave clans. They dug for treasure, built bright villages, and stood together when trouble came.' },
  { title: 'The empty village', emoji: '🏚️', sky: ['#2a2430', '#6a5a4a'], text: 'But the old clans scattered far and wide. Now one little village sits empty at the foot of the hills, waiting for someone new.' },
  { title: 'Four heroes', emoji: '🛡️', sky: ['#1a2030', '#4a5a7a'], text: 'That someone is you. Gather four heroes, give your clan a name, and raise your banner over the village gate.' },
  { title: 'The glowing mines', emoji: '⛏️', sky: ['#120e18', '#4a3a2a'], text: 'Under the hills, the old mines still glow with gold and gems. Monsters live down there too. The deeper you go, the bigger they get.' },
  { title: 'Six kingdoms', emoji: '🏰', sky: ['#22304a', '#8a6a4a'], text: 'From their hills, the six kingdoms watch your little village grow. Grow strong enough, and even Dragon\'s Rest will take notice.' },
  { title: 'Something wakes', emoji: '⛰️⚡', sky: ['#0e0c18', '#3a2a4a'], text: 'And every season, deep in the mountains, something big wakes up. Build. Train. Be ready. The valley is counting on {clan}!' },
]);

const ARRIVAL_WORDS: Record<MonsterKind, Words[]> = {
  giant: [
    { title: 'Thunder in the hills', emoji: '⛈️', sky: ['#14122a', '#3a3a5a'], text: 'The sky turns purple. Thunder rolls over the hills, and the church bell starts to ring all by itself.' },
    { title: 'Grimmor wakes', emoji: '🗿', sky: ['#1c1530', '#4b2d5c'], text: 'High in the mountains, Grimmor the Storm Giant stretches, yawns, and picks up a boulder the size of a house.' },
    { title: 'To the walls!', emoji: '⚔️', sky: ['#2a1a1a', '#6b3a1f'], text: '"He is coming this way!" shout the scouts. {clan}, it is monster week. Every fight counts!' },
  ],
  golem: [
    { title: 'The ground shakes', emoji: '🌋', sky: ['#2a2418', '#6b5a3a'], text: 'Cups rattle on the tables. Dust drifts down from the roofs. Something heavy is walking under the hills.' },
    { title: 'Craghold wakes', emoji: '🪨', sky: ['#2a2418', '#7a6a4a'], text: 'A whole hillside stands up. It is Old Craghold the Stone Golem, with two glowing amber eyes.' },
    { title: 'To the walls!', emoji: '⚔️', sky: ['#2a1a1a', '#6b3a1f'], text: '"He is rolling this way!" shout the scouts. {clan}, it is monster week. Every fight counts!' },
  ],
  troll: [
    { title: 'A cold wind', emoji: '🌨️', sky: ['#14203a', '#3a6a8a'], text: 'Snow falls in the middle of the day. The well freezes over, and every chicken hides under the hay.' },
    { title: 'Frostjaw wakes', emoji: '🧊', sky: ['#1a2a3a', '#5a8aaa'], text: 'From the far north comes Frostjaw the Ice Troll, sniffing the air and grinning a frosty grin.' },
    { title: 'To the walls!', emoji: '⚔️', sky: ['#2a1a1a', '#6b3a1f'], text: '"He is stomping this way!" shout the scouts. {clan}, it is monster week. Every fight counts!' },
  ],
};

const MONSTER_NAME: Record<MonsterKind, string> = { giant: 'Grimmor', golem: 'Craghold', troll: 'Frostjaw' };

export const arrivalStory = (kind: MonsterKind): Story => story(`clans-arrives-${kind}`, `${MONSTER_NAME[kind]} Wakes`, ARRIVAL_WORDS[kind]);

/** The win story (shown the first time a clan beats the season monster), with its paintings from art/season-monsters. */
export function winStory(kind: MonsterKind): Story {
  return {
    id: `clans-win-${kind}`,
    title: `How {clan} beat ${MONSTER_NAME[kind]}`,
    pages: MONSTER_STORIES[kind].map((p, i) => {
      const a = storyArt(kind, i + 1);
      return { title: p.title, text: p.text, art: a.wide ? a : undefined, standIn: { emoji: p.emoji, sky: p.sky } };
    }),
  };
}

/** Every Clan Quest story, for the shelf: the opening always; an arrival once that monster's week has come; a win once won. */
export function clanShelf(kind: MonsterKind, monsterHere: boolean, seen: (id: string) => boolean): ShelfStory[] {
  const kinds: MonsterKind[] = ['giant', 'golem', 'troll'];
  return [
    { story: OPENING, open: true },
    ...kinds.map((k) => {
      const s = arrivalStory(k);
      return { story: s, open: seen(s.id) || (k === kind && monsterHere), hint: 'Comes with a season monster' };
    }),
    ...kinds.map((k) => {
      const s = winStory(k);
      return { story: s, open: seen(s.id), hint: 'Beat a season monster' };
    }),
  ];
}

export const ALL_STORIES: Story[] = [OPENING, ...(['giant', 'golem', 'troll'] as const).flatMap((k) => [arrivalStory(k), winStory(k)])];
