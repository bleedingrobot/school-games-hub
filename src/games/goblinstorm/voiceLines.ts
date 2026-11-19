/**
 * What Bella says in Goblin Storm (Kokoro af_bella clips in public/voice/goblinstorm/, made with
 * scripts/voice-clips.py goblinstorm). Three kinds of line:
 * - the guide's fixed lines (`GUIDE`, `TIPS`), each one clip;
 * - level-up questions, read as pieces: the word pieces in `QUESTION_WORDS` and a clip for each number 0 to 1000;
 * - nothing else. A question with a piece that has no clip (a decimal, a big number, a fraction sign) is read by the
 *   browser's own voice. Bella never says an answer.
 */
import { voiceSlug } from '../../speech';
import { QUESTION_WORDS } from './questionWords';

export const VOICE_FOLDER = 'voice/goblinstorm/';

/** The biggest number with its own clip. */
export const MAX_SAID_NUMBER = 1000;

/** The guided first go (docs/GOBLINSTORM-PLAN.md, Design point 7). */
export const GUIDE = {
  move: 'Drag anywhere to move. Your hero attacks by themselves!',
  levelUp: 'Level up! Answer to choose a power.',
  cards: 'Right answers give more choices. Tap the power you want.',
  partner: 'Your weapon is at full level! Get its partner passive to evolve it.',
  miniBoss: 'A mini-boss is coming! Keep moving and let your weapons hit it.',
  boss: 'Here comes the boss! Beat it to win the map.',
  done: 'That’s the guide done. Have fun!',
} as const;

/** First-time tips on the map screen, after the guided first go. */
export const TIPS = [
  'Gold from every run buys upgrades in the Shop.',
  'The Codex shows each weapon and the partner passive that evolves it.',
  'Beat a map’s boss to open the next map.',
] as const;

/** Lines that may be said whole. */
export function fixedLines(): string[] {
  return [...Object.values(GUIDE), ...TIPS];
}

/** Every clip: the fixed lines, the question word pieces and the numbers. */
export function allVoiceLines(): string[] {
  return [...fixedLines(), ...QUESTION_WORDS, ...Array.from({ length: MAX_SAID_NUMBER + 1 }, (_, n) => String(n))];
}

let words: Set<string> | null = null;

/** A word piece of a question, the way its clip is named: no leading punctuation or trailing commas. */
export const cleanPiece = (piece: string): string => piece.trim().toLowerCase().replace(/^[\s,.:;!?]+/, '').replace(/[\s,;:]+$/, '');

/**
 * A question's spoken words as the clips Bella reads one after another, or null if any piece has no clip (then the
 * browser's own voice reads it all, so nothing is ever left out).
 */
export function questionPieces(spoken: string): string[] | null {
  words ??= new Set(QUESTION_WORDS.map(voiceSlug));
  const out: string[] = [];
  for (const piece of spoken.split(/(\d+)/)) {
    if (/^\d+$/.test(piece)) {
      if (String(Number(piece)) !== piece || Number(piece) > MAX_SAID_NUMBER) return null;
      out.push(piece);
      continue;
    }
    // A point or comma right between two numbers is a decimal or a thousands comma: not something the clips can say.
    if (piece === '.' || piece === ',') return null;
    const t = cleanPiece(piece);
    if (!t) continue;
    if (!words.has(voiceSlug(t))) return null;
    out.push(t);
  }
  return out.length ? out : null;
}
