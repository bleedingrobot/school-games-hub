/**
 * Every line Quick looks can read aloud, in one place, so each one can have a recorded clip
 * (public/voice/quick-looks/<slug>.mp3, made with Kokoro by scripts/voice-clips.py).
 * Lines without a clip fall back to the browser's own voice.
 */
import { FRAME_CAPACITY, GAP_FILLED, type PictureType } from '../../shared/subitising/config';

/** Relative to the page (like public/stockfish), so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/quick-looks/';

export const PROMPTS = {
  ready: 'Get ready',
  helped: 'Take your time. Can you see smaller groups?',
  gap: 'How many empty squares?',
  guided: 'How many can you see?',
  flash: 'How many did you see?',
} as const;

/** "Yes! 5: 3 and 2." / "Let me show you again. It was 5: 3 and 2." (parts left out for one group). */
export function flashFeedback(correct: boolean, answer: number, parts: readonly number[]): string {
  const p = parts.length > 1 ? `: ${parts.join(' and ')}` : '';
  return correct ? `Yes! ${answer}${p}.` : `Let me show you again. It was ${answer}${p}.`;
}

export function gapFeedback(counters: number, empty: number, capacity: number): string {
  return `${counters} ${counters === 1 ? 'counter' : 'counters'} and ${empty} empty ${empty === 1 ? 'square' : 'squares'} make ${capacity}.`;
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
    for (let filled = range[0]; filled <= range[1]; filled++) lines.add(gapFeedback(filled, capacity - filled, capacity));
  }
  return [...lines];
}
