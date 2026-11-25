/**
 * Every game on the Class Live page, in the order the picker shows them (James, 25 Nov 2026 NZ: the first screen is
 * choosing a game, then that game's options). The teacher's Today page shows the same list on its Class Live card.
 *
 * Class Showdown has one tile per arena (ARENAS below); each opens ShowdownCard on that arena.
 * A new Class Live game adds one row here (and its card in Projector.tsx's Setup, under `pick === '<id>'`).
 */
import type { Arena } from '../../../shared/showdown/types';
import { painted } from './paintedArt';

export type LiveGroup = 'think' | 'run' | 'team' | 'battle';

export type LiveGame = {
  id: string;
  name: string;
  emoji: string;
  /** One line under the name on the picker tile. */
  blurb: string;
  group: LiveGroup;
  /** The tile's colour when no picture is painted yet. */
  tint: string;
  pic: () => string | null;
  /** A Class Showdown arena: its own tile, and its options page opens that arena (James, 26 Nov 2026 NZ). */
  arena?: Arena;
};

export const GROUP_WORDS: Record<LiveGroup, { name: string; about: string }> = {
  think: { name: 'Maths puzzles', about: 'The class works together on the big screen' },
  run: { name: 'Joystick games', about: 'Everyone runs an avatar round the map' },
  team: { name: 'Team races', about: 'Teams take turns and help each other' },
  battle: { name: 'Class Showdown battles', about: 'A live maths battle. Pick an arena' },
};

const SHOWDOWN_ART = import.meta.glob('../showdown/art/paint/back/*-800.webp', { eager: true, import: 'default' }) as Record<string, string>;
const showdownPic = (back: string) => () => SHOWDOWN_ART[`../showdown/art/paint/back/${back}-800.webp`] ?? null;

/** Class Showdown's arenas, one picker tile each (James, 26 Nov 2026 NZ: "put each of the battles on this page"). */
const ARENAS: { arena: Arena; name: string; emoji: string; back: string; tint: string; blurb: string }[] = [
  { arena: 'boss', name: 'Boss Bounty', emoji: '⚔️', back: 'river-valley', tint: '#a8362a', blurb: 'Beat the boss together.' },
  { arena: 'goldrush', name: 'Gold Rush', emoji: '⛏️', back: 'gold-rush', tint: '#b7791f', blurb: 'Dig gold before the cave falls in.' },
  { arena: 'skyclimb', name: 'Sky Climb', emoji: '🧗', back: 'sky-climb', tint: '#2f6fb3', blurb: 'Climb to the summit.' },
  { arena: 'island', name: 'Shrinking Island', emoji: '🏝️', back: 'shrinking-island', tint: '#0f8a8a', blurb: 'Build a raft before the sea rises.' },
  { arena: 'hill', name: 'King of the Hill', emoji: '🏰', back: 'king-hill', tint: '#5d8a2f', blurb: 'Build the castle, take the crown.' },
  { arena: 'auction', name: 'Auction House', emoji: '💰', back: 'auction-house', tint: '#8a4fc4', blurb: 'Earn coins, bid for treasure.' },
];

/** The picker id of a Showdown arena's tile (?pick=showdown-goldrush). */
export const showdownPick = (arena: Arena) => `showdown-${arena}`;

export const LIVE_GAMES: LiveGame[] = [
  { id: 'stars', name: 'Star Web', emoji: '★', group: 'think', tint: '#3b3fb8', blurb: 'One fact glows. What else can we work out?', pic: () => painted('pick', 'stars', true) ?? painted('back', 'star-sky', true) },
  { id: 'serpent', name: 'Serpent Chain', emoji: '🐍', group: 'think', tint: '#1f8f63', blurb: 'A chain of sums. Wake the serpent!', pic: () => painted('pick', 'serpent', true) ?? painted('back', 'jungle-temple', true) },
  { id: 'mural', name: 'Mystery Mural', emoji: '🖼️', group: 'think', tint: '#b8487f', blurb: 'Maths uncovers a hidden painting.', pic: () => painted('pick', 'mural', true) ?? painted('back', 'gallery', true) },
  { id: 'corners', name: 'Four Corners', emoji: '🎲', group: 'run', tint: '#3d78c4', blurb: 'Run to a corner. The dice picks who goes to jail!', pic: () => painted('pick', 'corners', true) ?? painted('corners', 'map-snow', true) },
  { id: 'clash', name: 'Colour Clash', emoji: '🎨', group: 'run', tint: '#c2551f', blurb: 'Teams paint the floor. Biggest colour wins!', pic: () => painted('pick', 'clash', true) ?? painted('clash', 'map-park', true) },
  { id: 'ghost', name: 'Ghost Tag', emoji: '👻', group: 'run', tint: '#4b3d8f', blurb: 'Run from the ghosts, or become one!', pic: () => painted('pick', 'ghost', true) ?? painted('ghost', 'map-graveyard', true) },
  { id: 'shark', name: 'Shark Bay', emoji: '🦈', group: 'run', tint: '#167a9c', blurb: 'Swim to safety before Simon the shark strikes!', pic: () => painted('pick', 'shark', true) ?? painted('shark', 'map-lagoon', true) },
  { id: 'lava', name: 'Floor is Lava', emoji: '🌋', group: 'run', tint: '#c2410c', blurb: 'Get off the glowing tiles before they crack!', pic: () => painted('pick', 'lava', true) ?? painted('lava', 'lake-volcano', true) },
  { id: 'crew', name: 'Glitches', emoji: '🤖', group: 'run', tint: '#0f766e', blurb: 'Fix the factory with maths. Who are the secret Glitches?', pic: () => painted('pick', 'crew', true) ?? painted('crew', 'map-factory', true) },
  { id: 'thrones', name: 'Musical Thrones', emoji: '👑', group: 'run', tint: '#8a3fc4', blurb: 'Dance, then race to a throne when the music stops!', pic: () => painted('pick', 'thrones', true) ?? painted('thrones', 'hall-castle', true) },
  { id: 'relay', name: 'Toon Flap Relay', emoji: '🐦', group: 'team', tint: '#0e8fd0', blurb: 'Teams take turns flying. Answer to help your flyer!', pic: () => painted('pick', 'relay', true) ?? painted('relay', 'card', true) },
  ...ARENAS.map((a): LiveGame => ({ id: showdownPick(a.arena), name: a.name, emoji: a.emoji, group: 'battle', tint: a.tint, blurb: a.blurb, pic: showdownPic(a.back), arena: a.arena })),
];

export const liveGame = (id: string | null | undefined): LiveGame | null => LIVE_GAMES.find((g) => g.id === id) ?? null;

/** The games a teacher can pick: Showdown's arenas only while Class Showdown is on. */
export const pickableGames = (showdown: boolean): LiveGame[] => LIVE_GAMES.filter((g) => !g.arena || showdown);
