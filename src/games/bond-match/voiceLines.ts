/**
 * Every line Bella can read aloud in Bond Match, so each one has a recorded clip (public/voice/bond-match/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py). Every line is built from strings.ts, the same words the screen shows.
 *
 * What Bella reads: the goal when a board starts ("Make 10"), "A match!", "You need 10. Keep going!" after a mismatch,
 * whose turn it is in a two-player or Pip game, and the finish (the title and the stars, or who won). She never reads a
 * card or a sum: the "3 + 4 = 7" lines would need about 20,000 clips across the bond sets, and a card read aloud could
 * give away its partner. A line without a clip falls back to the browser's own voice.
 */
import { BOND_SETS } from '../../../shared/bond-match/bonds';
import { sumText } from '../../../shared/bond-match/exact';
import type { Stars } from '../../../shared/bond-match/score';
import type { Player } from '../../../shared/bond-match/versus';
import { TEXT, type Players } from './strings';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/bond-match/';

/** The number a set's pairs make, as the game bar shows it ("10", "1.0", "1"). */
export const targetOf = (set: (typeof BOND_SETS)[number]): string => sumText(set.pairs[0]);

/** When a board starts: the goal, then whose turn it is in a game for two. */
export function startLines(target: string, players: Players): string[] {
  return players.mode === 'solo' ? [TEXT.makes(target)] : [TEXT.makes(target), TEXT.turn(players, 0)];
}

/** After a flip that turned over the second card: what happened, then whose turn it is if the turn has passed. */
export function flipLines(kind: 'match' | 'mismatch', target: string, players: Players, turnNow: Player | null): string[] {
  const said = [kind === 'match' ? TEXT.match : TEXT.mismatchNeed(target)];
  if (players.mode !== 'solo' && turnNow !== null) said.push(TEXT.turn(players, turnNow));
  return said;
}

/** The solo finish: the title, then the stars ("Gold: 3 stars"). Play again and Pick another bond are not read. */
export const finishLines = (stars: Stars): string[] => [TEXT.finishTitle, TEXT.starsLine(stars)];

/** The two-player or Pip finish: who won. */
export const versusFinishLines = (players: Players, winner: Player | 'tie'): string[] => [TEXT.winner(players, winner)];

const VERSUS: Players[] = [{ mode: 'pass' }, { mode: 'bot', level: 'easy' }];

export function allVoiceLines(): string[] {
  const lines = new Set<string>([TEXT.match, TEXT.finishTitle]);
  for (const set of BOND_SETS) {
    const target = targetOf(set);
    lines.add(TEXT.makes(target));
    lines.add(TEXT.mismatchNeed(target));
  }
  for (const stars of [3, 2, 1] as const) lines.add(TEXT.starsLine(stars));
  for (const players of VERSUS) {
    for (const p of [0, 1] as const) lines.add(TEXT.turn(players, p));
    for (const winner of [0, 1, 'tie'] as const) lines.add(TEXT.winner(players, winner));
  }
  return [...lines];
}
