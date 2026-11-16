/**
 * The story told when a clan beats the season monster: five pages, clicked through, each with a painting
 * (art/season-monsters/story-<kind>-<n>.webp) or a drawn stand-in. Words only; the screen is MonsterStory.tsx.
 */
import type { MonsterKind } from '../../../shared/clans/types';

export interface StoryPage {
  title: string;
  /** The words. `{clan}` becomes the clan's name. */
  text: string;
  /** Stand-in picture until the painting exists. */
  emoji: string;
  /** Stand-in sky: two colours, top to bottom. */
  sky: [string, string];
}

export const MONSTER_STORIES: Record<MonsterKind, StoryPage[]> = {
  giant: [
    { title: 'The last stand', emoji: '⚔️🗿', sky: ['#1c1530', '#4b2d5c'], text: 'Lightning cracks across the sky. Grimmor raises his great club one last time… but {clan} stand firm at the gate.' },
    { title: 'The giant falls', emoji: '💥🗿', sky: ['#2a1a1a', '#6b3a1f'], text: 'One final blow! Grimmor stumbles, and crashes down onto his knees. The ground shakes so hard that the church bell rings.' },
    { title: 'The storm breaks', emoji: '🌕🗿', sky: ['#14223a', '#3d5a80'], text: 'The thunder stops. The clouds part, and moonlight pours over the valley. Grimmor looks down at {clan}… and smiles. "Brave little ones," he rumbles.' },
    { title: 'Back to the mountains', emoji: '🌄🏔️', sky: ['#3a2a4a', '#e0956a'], text: 'At dawn Grimmor leaves his great club at the village gate, and stomps away to the mountains. He will not trouble the village again.' },
    { title: 'The village cheers!', emoji: '🎉🏮', sky: ['#1a1030', '#8a3a5a'], text: 'Lanterns, music and a feast! The whole village cheers for {clan}. Grimmor\'s club hangs over the gate, for everyone to see.' },
  ],
  golem: [
    { title: 'The last stand', emoji: '⚔️🪨', sky: ['#2a2418', '#6b5a3a'], text: 'Dust swirls and the ground shakes. Craghold lifts both stone fists… but {clan} stand firm at the gate.' },
    { title: 'The golem cracks', emoji: '💥🪨', sky: ['#2a1a1a', '#6b3a1f'], text: 'One final blow! A great crack runs down Craghold\'s chest, and the golem sinks onto one knee with a rumble like thunder.' },
    { title: 'The dust settles', emoji: '🌕🪨', sky: ['#14223a', '#3d5a80'], text: 'The dust settles and the moon comes out. Craghold\'s amber eyes glow softly. "Strong little ones," he grinds, and he almost smiles.' },
    { title: 'Back to the hills', emoji: '🌄⛰️', sky: ['#3a2a4a', '#e0956a'], text: 'At dawn Craghold leaves his glowing stone heart at the village gate, and rolls slowly away to the far hills.' },
    { title: 'The village cheers!', emoji: '🎉🏮', sky: ['#1a1030', '#8a3a5a'], text: 'Lanterns, music and a feast! The whole village cheers for {clan}. Craghold\'s stone heart glows over the gate, for everyone to see.' },
  ],
  troll: [
    { title: 'The last stand', emoji: '⚔️🧊', sky: ['#14203a', '#3a6a8a'], text: 'Snow howls through the village. Frostjaw takes one last icy breath… but {clan} stand firm at the gate.' },
    { title: 'The troll slips', emoji: '💥🧊', sky: ['#1a2a3a', '#5a8aaa'], text: 'One final blow! Frostjaw skids on his own ice and crashes down in a huge cloud of snow.' },
    { title: 'The blizzard stops', emoji: '🌕🧊', sky: ['#14223a', '#3d5a80'], text: 'The wind drops and the stars come out. Frostjaw shakes the snow off his fur and grins at {clan}. "Tough little ones," he growls.' },
    { title: 'Back to the north', emoji: '🌄❄️', sky: ['#3a2a4a', '#e0956a'], text: 'At dawn Frostjaw leaves one icy tooth at the village gate, and runs off to the far north, shivering.' },
    { title: 'The village cheers!', emoji: '🎉🏮', sky: ['#1a1030', '#8a3a5a'], text: 'Lanterns, music and a feast! The whole village cheers for {clan}. Frostjaw\'s icy tooth sparkles over the gate, for everyone to see.' },
  ],
};

export const storyText = (page: StoryPage, clan: string) => page.text.split('{clan}').join(clan);
