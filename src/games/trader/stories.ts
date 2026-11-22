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

// ---------------------------------------------------------------------------------------------
// Quest stories (docs/plans/trader-quests/PLAN.md, Q.3, and trader-quests-2/PLAN.md, R.3): five pages each, read in the
// quest giver's own voice (public/voice/quest-<id>/). Pages 1 to 3 play when the quest is taken, 4 and 5 when it is
// finished. Words from each plan's stories.json; paintings art/quests/<id>-<page>.webp (and -800 copies).
// ---------------------------------------------------------------------------------------------

const QUEST_FILES = import.meta.glob('./art/quests/*-[1-5]*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

function questArt(id: string, n: number): StoryPage['art'] {
  const wide = QUEST_FILES[`./art/quests/${id}-${n}.webp`];
  return wide ? { wide, small: QUEST_FILES[`./art/quests/${id}-${n}-800.webp`] ?? wide } : undefined;
}

type QuestWords = { title: string; text: string; emoji: string };
function questStory(id: string, title: string, sky: [string, string], pages: QuestWords[]): Story {
  return { id: `trader-quest-${id}`, title, pages: pages.map((p, i) => ({ title: p.title, text: p.text, art: questArt(id, i + 1), standIn: { emoji: p.emoji, sky } })) };
}

/** Each giver's Kokoro voice (James's picks, 21 Nov 2026); the clips' folder is `voice/quest-<id>/`. */
export const QUEST_VOICES: Record<string, string> = {
  zuzu: 'bf_isabella', sprocket: 'bf_lily', nettle: 'am_puck', vex: 'bm_george', kai: 'af_sky',
  // Quests 6 to 10 (James's picks, 22 Nov 2026). Pip and Pop take turns: see PAGE_READERS.
  puddle: 'am_eric', gorbo: 'am_onyx', zip: 'am_fenrir', pippop: 'af_nicole', sable: 'bf_emma',
};
/** Quests read by more than one voice, page by page (all in the quest's one clip folder): the twins, Pip (af_nicole) on
 *  pages 1, 3 and 5 and Pop (af_bella) on 2 and 4. scripts/voice-clips.py has the same list (LINE_VOICES), checked by the voice test. */
export const PAGE_READERS: Record<string, readonly { name: string; voice: string }[]> = {
  pippop: [0, 1, 2, 3, 4].map((i) => (i % 2 ? { name: 'Pop', voice: 'af_bella' } : { name: 'Pip', voice: 'af_nicole' })),
};
/** Who reads a quest story's page (its number in the whole story, from 0): a name only when the readers take turns. */
export function pageReader(id: string, page: number): { name?: string; voice: string } {
  return PAGE_READERS[id]?.[page] ?? { voice: QUEST_VOICES[id] };
}
export const questClips = (id: string): string => `voice/quest-${id}/`;

export const QUEST_STORIES: Record<string, Story> = {
  zuzu: questStory('zuzu', "Grandma Zuzu's Big Party", ['#1a0a2a', '#5a2a6a'], [
    { title: 'A party to plan', emoji: '🎂', text: "Hello, captain! I'm Grandma Zuzu. My grandson Bix turns ten tomorrow, and I'm throwing him the biggest party this side of the galaxy!" },
    { title: 'Oh dear, oh dear', emoji: '🍓', text: 'But I have nothing ready! I need star-berries for the cake, sparkle candles that fizz, and a robot band that can really boogie.' },
    { title: 'Off you zoom', emoji: '🚀', text: "It's all paid for. Just fly to each planet and pick it up. I've marked them on your star map. Off you zoom, dear!" },
    { title: 'Party time!', emoji: '🎉', text: "You did it! Look at Bix's face! The cake is purple, the candles are fizzing, and the robot band won't stop dancing." },
    { title: 'Thank you, dear', emoji: '🍰', text: "Here's your reward, captain, and a slice of cake for the trip. You're welcome at my table any time!" },
  ]),
  sprocket: questStory('sprocket', "Professor Sprocket's Runaway Robots", ['#0a1420', '#2a4a5a'], [
    { title: 'Gone without asking', emoji: '🤖', text: "Oh, thank goodness, a captain! I'm Professor Sprocket. My four helper robots, Beep, Boop, Clank and Fizz, have run away on holiday. Without asking!" },
    { title: 'Where did they go?', emoji: '🏝️', text: 'Beep went sunbathing on a desert planet. Boop is splashing on a water world. Clank is exploring a mine. And Fizz went to see the fireworks, of course.' },
    { title: 'Handle with care', emoji: '📦', text: 'Each robot needs one hold in your ship. Pick them all up and bring them home. Be gentle with Clank. He gets space sick.' },
    { title: 'Home sweet home', emoji: '🏠', text: 'All four home, safe and sound! Beep has a tan, Boop is dripping, Clank needs a lie down, and Fizz won\'t stop talking about sparkles.' },
    { title: 'A present for you', emoji: '🖍️', text: "Here's your reward, captain. And Beep made you this. It's a drawing of you. Well, Beep thinks it's you." },
  ]),
  nettle: questStory('nettle', 'Dr Nettle and the Sneezles', ['#0a1a10', '#2a5a3a'], [
    { title: 'Achoo!', emoji: '🤧', text: "Achoo! Excuse me, captain. I'm Dr Nettle. The Sneezles has spread all over my planet, and everyone is sneezing bubbles. Even the mayor!" },
    { title: 'Empty shelves', emoji: '💊', text: "I need Medicine and fresh Water, and I've run right out. You'll have to buy them at a market, but I'll pay much more than you spend." },
    { title: 'Bubbles to the roof', emoji: '🫧', text: "Your quest list shows where to buy them and today's prices. Please hurry back, before the bubbles reach the roof!" },
    { title: 'Bless you, captain', emoji: '🎩', text: 'The sneezing has stopped! Well, nearly. The mayor still does a tiny bubble now and then. He says it makes him feel fancy.' },
    { title: 'A tidy profit', emoji: '💰', text: "Here's what I promised, captain, and a little extra. You saved the day, and you made a tidy profit too!" },
  ]),
  vex: questStory('vex', 'Commander Vex and the Rust Raiders', ['#14060a', '#4a1a2a'], [
    { title: 'Trouble in the garden', emoji: '🌸', text: 'Captain, Commander Vex of the Star Navy. Pirates called the Rust Raiders are circling a peaceful garden planet. The people there grow flowers, not lasers.' },
    { title: 'A brave trader', emoji: '🛡️', text: "My fleet is stuck on the far side of the galaxy. I need you to chase off three pirate ships. I'll lend you a Navy laser for the job." },
    { title: 'Stand your ground', emoji: '🏴‍☠️', text: "I've marked where each pirate ship is waiting. If they win a fight, don't worry. Mend your ship, come back and try again." },
    { title: 'Petals in the sky', emoji: '🌺', text: 'The Rust Raiders have fled! The garden planet is safe, and everyone is throwing flower petals into the sky for you.' },
    { title: 'The Navy thanks you', emoji: '🎖️', text: "Please accept the Navy's thanks and this reward. The laser goes back to the Navy, but your courage stays with you." },
  ]),
  kai: questStory('kai', 'Lumi the Little Star Whale', ['#05060f', '#1a2a5a'], [
    { title: 'Look out the window!', emoji: '🐋', text: "Captain, look out your window! That's Lumi, a baby star whale. She swam off chasing comets and can't find her family. I'm Ranger Kai. Can you help?" },
    { title: 'A trail of stardust', emoji: '✨', text: "Star whales leave trails of glowing stardust. Lumi's family left clues on planets across the galaxy. Each clue says where to go next." },
    { title: 'Follow the clues', emoji: '🗺️', text: 'Read the clue, find the planet on your star map, and Lumi will follow your ship. Stuck? Tap Show me, and I\'ll light it up.' },
    { title: 'Together again', emoji: '💙', text: "There they are! Lumi's whole family, singing so deep the planets hum. Lumi zooms straight into a giant hug with her mum." },
    { title: 'A glowing gift', emoji: '🌟', text: "The star whales left you a gift, a tiny whale made of starlight that shimmers when you're near. And here's a reward from the Ranger Service. Well done!" },
  ]),
  // Quests 6 to 10 (docs/plans/trader-quests-2/PLAN.md, R.3): words from docs/plans/trader-quests-2/stories.json.
  puddle: questStory('puddle', 'Mayor Puddle and the Big Dry', ['#0a1a14', '#2a5a4a'], [
    { title: 'The Big Dry', emoji: '🐸', text: "Hello, captain! I'm Mayor Puddle. Not one drop of rain has fallen on our three little planets for weeks. The ponds are dry and the frogs are grumpy!" },
    { title: 'Water, please!', emoji: '💧', text: 'We need twelve crates of water. Buy them at any market you like, then share them out: four crates for each planet. Fair is fair!' },
    { title: 'Splash to it', emoji: '🗺️', text: "I've marked the three thirsty planets in gold on your star map. Please hurry, captain. My tadpoles are counting on you!" },
    { title: 'Rain at last', emoji: '🌧️', text: 'Splish! Splash! The ponds are full, the gardens are green, and the frogs are singing again. Listen to that croaking choir!' },
    { title: 'A soggy thank you', emoji: '☂️', text: "Here's your reward, captain, and a lucky rain-drop to keep. Come back any time. Just bring an umbrella!" },
  ]),
  gorbo: questStory('gorbo', "Chef Gorbo's Galaxy Feast", ['#1a0e05', '#6a3a1a'], [
    { title: 'The Galaxy Feast', emoji: '🍲', text: 'Hello, hello, captain! I am Chef Gorbo. Tonight I cook the Galaxy Feast for a hundred hungry space travellers. One chef, four pans, and no ingredients!' },
    { title: 'The shopping list', emoji: '🧀', text: 'I need a giant moon-melon, a wheel of stinky comet cheese, five crates of food and three of lollies for pudding. The cheese is near pirates, so take care!' },
    { title: 'Quick, quick!', emoji: '🔥', text: 'The melon and cheese are paid for. The food and lollies you buy at any market, and I pay you well. Quick, the ovens are hot!' },
    { title: 'Dinner is served', emoji: '🍮', text: 'Magnificent! The melon soup bubbles, the cheese is melting, and the lolly pudding wobbles. A hundred happy tummies, all thanks to you!' },
    { title: 'Compliments to the captain', emoji: '🥄', text: 'Here is your pay, captain, and my golden spoon. Every great cook needs a great delivery captain!' },
  ]),
  zip: questStory('zip', 'The Comet Cup', ['#0a0a1e', '#3a2a6a'], [
    { title: 'The Comet Cup', emoji: '🏆', text: "Welcome, race fans! I'm Zip Zoomer, and this is the Comet Cup, the fastest race in the galaxy! And you, captain, are on the starting line!" },
    { title: 'The rules', emoji: '⛽', text: 'Fly from the start line, past the checkpoint, to the finish line on one tank of fuel. Refuel and you go back to the start. Plan your jumps!' },
    { title: 'Three, two, one', emoji: '🚦', text: 'Fill your tank right to the top, captain. Engines roaring, crowd cheering. Three, two, one... go, go, go!' },
    { title: 'Across the line!', emoji: '🏁', text: "And they're over the finish line! What a race! What a pilot! The whole crowd is on its feet, captain!" },
    { title: 'Champion', emoji: '🥇', text: 'The Comet Cup is yours, champion! Polish it every day, and come back next season to defend your title!' },
  ]),
  pippop: questStory('pippop', "Pip and Pop's Runaway Pets", ['#140a1e', '#5a3a6a'], [
    { title: 'Oh no!', emoji: '🐰', text: "Hi, captain! I'm Pip! And I'm Pop! We're twins! We were feeding our pets, and somebody left the space gate open. Whoops!" },
    { title: 'Lost pets', emoji: '🐌', text: 'Fluff the moon-bunny, Splodge the jelly-pup and Zoom the comet-cat ran away. And a pirate grabbed Wiggles the star-snail!' },
    { title: 'Bring them home', emoji: '🗺️', text: "Their planets are marked on your map. For Wiggles, you'll have to chase that pirate away. Please hurry, captain. Pets get hungry!" },
    { title: 'All home!', emoji: '🐾', text: "Fluff! Splodge! Zoom! Wiggles! You found them all! Look, they're having a big snuggle pile. Even Wiggles, and he's very slow." },
    { title: 'Best captain ever', emoji: '🏷️', text: "Here's your reward, captain, and a pet collar with your name on it. We'll keep the gate shut from now on. Promise!" },
  ]),
  sable: questStory('sable', "Captain Sable's Lost Treasure", ['#0a0a14', '#4a3a1a'], [
    { title: "An old pirate's secret", emoji: '🏴‍☠️', text: "Ahoy, captain. I'm Captain Sable. I was a pirate queen once, but now I'm retired and I keep space bees. Long ago, I hid a treasure." },
    { title: 'Rust-Beard', emoji: '🧔', text: 'But my old shipmate Rust-Beard has heard about it, the greedy old bucket. Follow my map clues and get there first!' },
    { title: 'The map', emoji: '🗺️', text: 'Each clue says how far to go from where you are. Find all three marks, then the treasure. And watch out for Rust-Beard!' },
    { title: 'Treasure!', emoji: '💰', text: "You beat Rust-Beard and found my chest! Gold coins, star-gems, and my old pirate hat. I'd forgotten how shiny it all was." },
    { title: 'Shared treasure', emoji: '🪙', text: "Treasure is better shared, captain. Take your half, and this lucky coin. You'd have made a fine pirate. Luckily, you're an even better trader!" },
  ]),
};

/** A quest story's pages for a moment: `start` (1 to 3, on taking it), `end` (4 and 5, on finishing) or `all`. */
export function questStoryPart(id: string, part: 'start' | 'end' | 'all'): Story | null {
  const s = QUEST_STORIES[id];
  if (!s) return null;
  return part === 'all' ? s : { ...s, pages: part === 'start' ? s.pages.slice(0, 3) : s.pages.slice(3) };
}
