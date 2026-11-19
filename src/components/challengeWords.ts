/**
 * Every line the hub's challenge banner shows or reads aloud (ChallengeBanner.tsx), so the screen and Bella's clips
 * (public/voice/challenge/, challengeVoiceLines.test.ts) can't drift apart. The spoken lines leave out names, so each
 * has a recorded clip.
 */
import type { AskGame } from '../data/hubAsks';

export const VOICE_FOLDER = 'voice/challenge/';

export const GAME_NAMES: Record<AskGame, string> = {
  archery: 'Archery Challenge',
  'dragon-maths': 'Dragon Maths',
  'clan-quest': 'Clan Quest',
  chess: 'Chess',
  checkers: 'Checkers',
  '101': '101',
  space: 'Wormholes & Black Holes',
  'power-clash': 'Power Clash',
};

/** What the banner says: who, and which game. */
export function askLine(game: AskGame, from: string): string {
  if (game === 'clan-quest') return `The ${from} clan challenges you to a Clan Quest duel!`;
  if (game === 'dragon-maths') return `${from} challenges you to a Dragon Maths arena clash!`;
  if (game !== 'archery') return `${from} invites you to play ${GAME_NAMES[game]}!`;
  return `${from} challenges you to an Archery Challenge fight!`;
}

/** What Bella says (no names, so every line has a clip). */
export const SPOKEN: Record<AskGame, string> = {
  archery: 'A friend challenges you to an archery fight!',
  'dragon-maths': 'A friend challenges you to a Dragon Maths clash!',
  'clan-quest': 'Another clan challenges you to a duel!',
  chess: 'A friend invites you to play chess!',
  checkers: 'A friend invites you to play checkers!',
  '101': 'A friend invites you to play 101!',
  space: 'A friend invites you to play Wormholes and Black Holes!',
  'power-clash': 'A friend invites you to play Power Clash!',
};

export function allVoiceLines(): string[] {
  return Object.values(SPOKEN);
}
