/**
 * The Keeper's Tale (docs/plans/stories/PLAN.md, ST.4). Warlord Mudtooth's Grey Horde wants the valley's last magic gems.
 * The opening once, a chapter page before each level the first time (with that level's Tale challenge), a Tale page for
 * winning the challenge (that page being seen is the Tale star), and the ending once all ten Tale pages are won.
 * Paintings: art/story/<story id>-<page>.webp (docs/stories-art/gem-keep.json); a drawn stand-in until then.
 */
import type { ShelfStory, Story, StoryPage } from '../../../shared/kit/stories';
import { CAMPAIGN } from '../../../shared/gem-keep/levels';

const FILES = import.meta.glob('./art/story/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function art(id: string, n: number): StoryPage['art'] {
  const wide = FILES[`./art/story/${id}-${n}.webp`];
  return wide ? { wide, small: FILES[`./art/story/${id}-${n}-800.webp`] ?? wide } : undefined;
}

type Words = { title: string; text: string; emoji: string; sky: [string, string] };
function story(id: string, title: string, pages: Words[]): Story {
  return { id, title, pages: pages.map((p, i) => ({ title: p.title, text: p.text, art: art(id, i + 1), standIn: { emoji: p.emoji, sky: p.sky } })) };
}

export const OPENING = story('gemkeep-opening', "The Keeper's Tale", [
  { title: 'The last gems', emoji: '💎', sky: ['#0c1424', '#3a5a8a'], text: 'At the top of Crystal Valley stands the Keep. Inside, the last magic gems glow, keeping the whole valley green and warm.' },
  { title: 'Warlord Mudtooth', emoji: '👹', sky: ['#1a1410', '#5a4a3a'], text: 'Far over the hills, Warlord Mudtooth hears about the gems. He wants them all for his crown, so he calls his Grey Horde.' },
  { title: 'You are the Keeper', emoji: '🗝️', sky: ['#14100c', '#7a5a2a'], text: 'The old Keeper is ready to rest, and hands you the big iron key. "Build towers, set the gems, and keep the valley safe."' },
]);

/** Before each level the first time: Mudtooth's next move, and the reason for its Tale challenge. Index = level. */
const CHAPTERS: Words[] = [
  { title: 'Scouts in the valley', emoji: '👀', sky: ['#0c1a10', '#3a6a3a'], text: "Mudtooth's scouts are creeping up the valley to count your towers. Don't let a single one reach the Keep and run home to tell." },
  { title: 'Dry hay', emoji: '🌾', sky: ['#1a1808', '#8a7a2a'], text: 'Every barn in the meadow is full of dry hay. One spark and it would all go up in flames. Keep the red fire gems out of your towers.' },
  { title: 'The wobbly bridge', emoji: '🌉', sky: ['#0c1820', '#3a6a7a'], text: 'The only bridge over the river is old and wobbly. Too many towers and it will tip into the water. Build no more than 8.' },
  { title: 'The blocked cave', emoji: '🪨', sky: ['#14120e', '#5a5048'], text: 'A rockfall has blocked the cave where the blue frost crystals grow. You will have to win this one without any blue gems.' },
  { title: 'Hiding in the woods', emoji: '🌳', sky: ['#0c140a', '#3a5a2a'], text: 'Families from the villages are hiding in the woods beside the road. Let no more than 2 enemies past, so nobody finds them.' },
  { title: 'The drummers', emoji: '🥁', sky: ['#1a1010', '#6a3a2a'], text: "Mudtooth's drummers bang on the Keep's wall as they march past. Keep the wall strong: finish with the Keep at 80 or more." },
  { title: 'Frozen mushrooms', emoji: '🍄', sky: ['#101a24', '#6a8aa4'], text: 'Up on Frost Ridge, the poison mushrooms are frozen solid, so the green gems have no power. Win without any green gems.' },
  { title: 'Wood for the gates', emoji: '🚪', sky: ['#18120c', '#6a4a2a'], text: 'The gate-keepers need wood to fix the Twin Gates. Build no more than 11 towers, so there is plenty left over.' },
  { title: 'Lightning', emoji: '⚡', sky: ['#10101a', '#4a4a7a'], text: 'Lightning crackles over the peaks. Yellow gems would pull it down onto your own towers. Leave the yellow gems out.' },
  { title: 'Mudtooth himself', emoji: '🏰', sky: ['#140c0c', '#6a2a2a'], text: "Mudtooth himself has come, with every soldier he has left. The Keep's old wall is cracked. Finish with the Keep at 50 or more." },
];

/** For winning each Tale challenge: the story's next beat. */
const TALES: Words[] = [
  { title: 'Nobody counted', emoji: '🤫', sky: ['#0c1a10', '#4a7a4a'], text: 'Not one scout got home. Mudtooth stamps his foot. "How many towers? Nobody knows how many towers!"' },
  { title: 'Strawberries', emoji: '🍓', sky: ['#1a1808', '#9a8a3a'], text: 'The hay is safe. The farmers bring you a basket of strawberries and promise to ring the bell if the Horde comes back.' },
  { title: 'The otters help', emoji: '🦦', sky: ['#0c1820', '#4a8a9a'], text: "The bridge still stands. The river otters patch it with sticks, and the Horde's rafts get stuck in the mud." },
  { title: 'A secret note', emoji: '📜', sky: ['#14120e', '#7a6a58'], text: "The miners dig out the blue cave and find a note a soldier dropped. Mudtooth has a secret plan for the Two Rivers." },
  { title: 'Safe and sound', emoji: '🏡', sky: ['#0c140a', '#4a7a3a'], text: 'The families come out of the woods, safe and sound, cheering. Their grandad gives you a horn to call them if you ever need help.' },
  { title: 'Drums down', emoji: '🥁', sky: ['#1a1010', '#8a4a2a'], text: 'The wall hardly has a scratch. The drummers look at each other, drop their drums, and walk home.' },
  { title: 'The mushrooms wake', emoji: '🤧', sky: ['#101a24', '#7a9a6a'], text: "Behind you the ice melts. The mushrooms wake up and sneeze green dust all over the Horde's backs. Achoo!" },
  { title: 'One road left', emoji: '🛡️', sky: ['#18120c', '#8a6a3a'], text: 'Spare wood mends both gates. Now only one road leads to the Keep, and Mudtooth is running out of soldiers.' },
  { title: 'Bonk! Bonk!', emoji: '🌩️', sky: ['#10101a', '#6a6aaa'], text: "The lightning finds the two bosses' tall metal helmets instead. Bonk! Bonk! They slide all the way down the mountain on their shields." },
  { title: 'The wall holds', emoji: '🏰', sky: ['#140c0c', '#8a5a2a'], text: 'The cracked old wall holds. Mudtooth stares up at the Keep, still standing, its gems still glowing. He has nothing left to send.' },
];

export const ENDING = story('gemkeep-ending', 'The End of the Tale', [
  { title: 'Mudtooth gives up', emoji: '🪨', sky: ['#14100c', '#5a4a3a'], text: 'Mudtooth sits down on a rock. "I\'m tired," he says. "My feet hurt. And I don\'t even like gems that much."' },
  { title: 'Going home', emoji: '🚶', sky: ['#1a140c', '#7a6a4a'], text: 'The Grey Horde packs up and trudges home over the hills, grumbling. A few of them even wave goodbye.' },
  { title: 'The book of Keepers', emoji: '📖', sky: ['#1a1408', '#9a7a2a'], text: 'The whole valley has a party. Your name goes into the big book of Keepers, and the gems glow brighter than ever.' },
]);

export const chapterId = (i: number) => `gemkeep-chapter-${i + 1}`;
export const taleId = (i: number) => `gemkeep-tale-${i + 1}`;
export const chapterStory = (i: number): Story => story(chapterId(i), CAMPAIGN[i]?.name ?? `Level ${i + 1}`, [CHAPTERS[i]]);
export const taleStory = (i: number): Story => story(taleId(i), TALES[i].title, [TALES[i]]);

/** Every Gem Keep story, for the checks in src/games/stories.test.ts. */
export const ALL_STORIES: Story[] = [OPENING, ...CHAPTERS.map((_, i) => chapterStory(i)), ...TALES.map((_, i) => taleStory(i)), ENDING];

/** The Tale shelf: chapters reached, Tales won, and the ending once all ten are won. */
export function taleShelf(reached: (i: number) => boolean, won: (i: number) => boolean): ShelfStory[] {
  const out: ShelfStory[] = [{ story: OPENING, open: true }];
  CHAPTERS.forEach((_, i) => {
    out.push({ story: chapterStory(i), open: reached(i), hint: `Reach level ${i + 1}` });
    out.push({ story: taleStory(i), open: won(i), hint: `Win level ${i + 1}'s Tale challenge` });
  });
  out.push({ story: ENDING, open: CHAPTERS.every((_, i) => won(i)), hint: 'Win all ten Tale challenges' });
  return out;
}
