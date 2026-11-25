/**
 * Every game on the Class Live page, in the order the picker shows them (James, 25 Nov 2026 NZ: the first screen is
 * choosing a game, then that game's options). The teacher's Today page shows the same list on its Class Live card.
 *
 * A new Class Live game adds one row here (and its card in Projector.tsx's Setup, under `pick === '<id>'`).
 */
import { painted } from './paintedArt';

export type LiveGroup = 'think' | 'run' | 'battle';

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
};

export const GROUP_WORDS: Record<LiveGroup, { name: string; about: string }> = {
  think: { name: 'Maths puzzles', about: 'The class works together on the big screen' },
  run: { name: 'Joystick games', about: 'Everyone runs an avatar round the map' },
  battle: { name: 'Battles', about: 'A live maths battle in painted arenas' },
};

const SHOWDOWN_ART = import.meta.glob('../showdown/art/paint/back/river-valley-800.webp', { eager: true, import: 'default' }) as Record<string, string>;

export const LIVE_GAMES: LiveGame[] = [
  { id: 'stars', name: 'Star Web', emoji: '★', group: 'think', tint: '#3b3fb8', blurb: 'One fact glows. What else can we work out?', pic: () => painted('pick', 'stars', true) ?? painted('back', 'star-sky', true) },
  { id: 'serpent', name: 'Serpent Chain', emoji: '🐍', group: 'think', tint: '#1f8f63', blurb: 'A chain of sums. Wake the serpent!', pic: () => painted('pick', 'serpent', true) ?? painted('back', 'jungle-temple', true) },
  { id: 'mural', name: 'Mystery Mural', emoji: '🖼️', group: 'think', tint: '#b8487f', blurb: 'Maths uncovers a hidden painting.', pic: () => painted('pick', 'mural', true) ?? painted('back', 'gallery', true) },
  { id: 'corners', name: 'Four Corners', emoji: '🎲', group: 'run', tint: '#3d78c4', blurb: 'Run to a corner. The dice picks who goes to jail!', pic: () => painted('pick', 'corners', true) ?? painted('corners', 'map-snow', true) },
  { id: 'clash', name: 'Colour Clash', emoji: '🎨', group: 'run', tint: '#c2551f', blurb: 'Teams paint the floor. Biggest colour wins!', pic: () => painted('pick', 'clash', true) ?? painted('clash', 'map-park', true) },
  { id: 'ghost', name: 'Ghost Tag', emoji: '👻', group: 'run', tint: '#4b3d8f', blurb: 'Run from the ghosts, or become one!', pic: () => painted('pick', 'ghost', true) ?? painted('ghost', 'map-graveyard', true) },
  { id: 'shark', name: 'Shark Bay', emoji: '🦈', group: 'run', tint: '#167a9c', blurb: 'Swim to safety before Simon the shark strikes!', pic: () => painted('pick', 'shark', true) ?? painted('shark', 'map-lagoon', true) },
  { id: 'thrones', name: 'Musical Thrones', emoji: '👑', group: 'run', tint: '#8a3fc4', blurb: 'Dance, then race to a throne when the music stops!', pic: () => painted('pick', 'thrones', true) ?? painted('thrones', 'hall-castle', true) },
  { id: 'showdown', name: 'Class Showdown', emoji: '⚔️', group: 'battle', tint: '#a8362a', blurb: 'Six arenas: boss, gold rush, sky climb and more.', pic: () => Object.values(SHOWDOWN_ART)[0] ?? null },
];

export const liveGame = (id: string | null | undefined): LiveGame | null => LIVE_GAMES.find((g) => g.id === id) ?? null;
