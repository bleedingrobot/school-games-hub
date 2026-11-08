/**
 * Every line Quick looks can read aloud, in one place, so each one can have a recorded clip
 * (public/voice/quick-looks/<slug>.mp3, made with Kokoro by scripts/voice-clips.py).
 * Lines without a clip fall back to the browser's own voice.
 */
import { FRAME_CAPACITY, GAP_FILLED, type PictureType } from '../../shared/subitising/config';

/** Relative to the page (like public/stockfish), so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/quick-looks/';

export const PROMPTS = {
  readyFlash: 'Get ready: how many dots?',
  readyGap: 'Get ready: how many empty squares?',
  helpedGroups: 'Take your time. Can you see smaller groups?',
  helpedOne: 'Take your time. Look carefully.',
  helpedGap: 'Take your time. How many empty squares?',
  /** After a wrong first answer: the picture comes back once for a second try. */
  retry: 'Try once more.',
  gap: 'How many empty squares?',
  /** A picture from a finished stage, coming back in the Empty squares stage: a sign the question can change. */
  reviewFlash: 'A look back. How many did you see?',
  reviewGuided: 'A look back. How many can you see?',
  reviewGap: 'A look back. How many empty squares?',
  guided: 'How many can you see?',
  flash: 'How many did you see?',
  /** The demo picture before a new student's starting check. */
  demo: 'This is how it works. A picture shows, then hides. Tap how many dots you saw. This one stays so you can practise.',
  /** The end of a round played with the picture kept on screen: those answers don't grow the garden. */
  guidedSummary: 'The picture stayed on today, so your plants grew a little. Switch flashing back on to finish them.',
} as const;

/** The heading and voice line when the picture stays on screen after a struggle. */
export function helpedPrompt(activity: 'flash' | 'gap', answer: number): string {
  if (activity === 'gap') return PROMPTS.helpedGap;
  return answer === 1 ? PROMPTS.helpedOne : PROMPTS.helpedGroups;
}

/** "Yes! 5: 3 and 2." / "Let me show you again. It was 5: 3 and 2." (parts left out for one group). */
export function flashFeedback(correct: boolean, answer: number, parts: readonly number[]): string {
  const p = parts.length > 1 ? `: ${parts.join(' and ')}` : '';
  return correct ? `Yes! ${answer}${p}.` : `Let me show you again. It was ${answer}${p}.`;
}

/** "1 counter and 4 empty squares" (one or many, for both numbers). */
export function gapWords(counters: number, empty: number): string {
  return `${counters} ${counters === 1 ? 'counter' : 'counters'} and ${empty} empty ${empty === 1 ? 'square' : 'squares'}`;
}

/** "Yes! 3 counters and 2 empty squares make 5." / "Not quite. 3 counters ..." */
export function gapFeedback(counters: number, empty: number, capacity: number, correct: boolean): string {
  return `${correct ? 'Yes!' : 'Not quite.'} ${gapWords(counters, empty)} make ${capacity}.`;
}

/** n as one group or two, biggest first (groupSizes sorts the same way). Pictures never have more groups (voiceLines.test.ts checks). */
function splits(n: number): number[][] {
  const out: number[][] = [[n]];
  for (let small = 1; small <= n / 2; small++) out.push([n - small, small]);
  return out;
}

/** Every line the game can say. Flash answers go up to 10. */
export function allVoiceLines(): string[] {
  const lines = new Set<string>(Object.values(PROMPTS));
  for (let n = 1; n <= 10; n++) {
    for (const parts of splits(n)) {
      lines.add(flashFeedback(true, n, parts));
      lines.add(flashFeedback(false, n, parts));
    }
  }
  for (const [type, range] of Object.entries(GAP_FILLED) as [PictureType, readonly [number, number]][]) {
    const capacity = FRAME_CAPACITY[type] ?? 0;
    for (let filled = range[0]; filled <= range[1]; filled++) {
      lines.add(gapFeedback(filled, capacity - filled, capacity, true));
      lines.add(gapFeedback(filled, capacity - filled, capacity, false));
    }
  }
  return [...lines];
}
