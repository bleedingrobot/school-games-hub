/**
 * The key lines Glyph Gates reads aloud, each with a recorded clip (public/voice/glyph/<slug>.mp3, made with Kokoro by
 * scripts/voice-clips.py) in Bella's voice. Not everything is voiced (James, 5 Nov 2026): the wall's ask, the fixed next-step
 * lines, the mistakes in fixed words, the guided first wall and the temple result. Nothing with this wall's fractions or
 * counts in it, and never the gold stone read out (it changes every wall). Built from words.ts so text and clips can't drift.
 */
import { guideWall } from './guide';
import { guideLine, LOOK_CLOSELY, LOOK_CLOSELY_NONE, NO_MATCH, PICK_GLYPH, PRESS_LIGHT, RESULT_CLOSE, RESULT_PASSED, WALL_ASK, WHY_VOICE } from './words';
import { rightCells } from '../../../shared/glyph/play';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/glyph/';

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WALL_ASK, PICK_GLYPH, PRESS_LIGHT, NO_MATCH, LOOK_CLOSELY, LOOK_CLOSELY_NONE, ...Object.values(WHY_VOICE), RESULT_PASSED, RESULT_CLOSE]);
  // The guided first wall has fixed fractions (gold 1/2): every line it can show.
  const wall = guideWall();
  const right = rightCells(wall);
  lines.add(guideLine(0, wall.gold));
  wall.tiles.forEach((t, c) => {
    if (!right.includes(c)) lines.add(guideLine(1, wall.gold, t));
  });
  for (const c of right) lines.add(guideLine(1, wall.gold, undefined, wall.tiles[c]));
  lines.add(guideLine(1, wall.gold));
  lines.add(guideLine(2, wall.gold));
  lines.add(guideLine(3, wall.gold));
  return [...lines];
}

let recorded: Set<string> | null = null;
/** Is this one of the recorded lines? */
export function isRecorded(text: string): boolean {
  recorded ??= new Set(allVoiceLines());
  return recorded.has(text);
}
