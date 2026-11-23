/**
 * Everything Volt says out loud (docs/CIRCUIT-PLAN.md, section 5.7), read by Bella (Kokoro af_bella) from clips in
 * public/voice/circuit/. The screens show the very same text, so text and clips can't drift. After changing a line:
 *   WRITE_VOICE_LINES=1 npx vitest run src/games/circuit/voiceLines.test.ts
 * then make the clips with scripts/voice-clips.py circuit (and remove clips for changed lines).
 */
import type { TipId } from '../../../shared/circuit/game';
import { speak } from '../../speech';

export const VOICE_FOLDER = 'voice/circuit/';

/** The guided first go on road 1, one key at a time. */
export type GuideStep = 'steer' | 'speed' | 'jump' | 'go';
export const GUIDE: Record<GuideStep, string> = {
  steer: 'Hi, I’m Volt! Steer left and right with the arrow keys. Give it a try!',
  speed: 'Great steering! Now hold the up arrow to speed up. Down slows you down.',
  jump: 'Zooming! Now press Space to jump. Glowing bridges cover the gaps until your first jump.',
  go: 'You’ve got it! Jump every gap and dive into the big port at the end!',
};

/** Volt's once-only tips (TIPS in shared/circuit/game.ts), shown the first time and then never again. */
export const TIP_LINES: Record<Exclude<TipId, 'guide'>, string> = {
  short: 'Watch out! Red tiles short-circuit. Steer round them.',
  battery: 'Battery low! Find a blue port!',
  crash: 'No harm done, crashes just restart. Hit walls slower than half speed.',
  gate: 'A data gate! Read the question, then steer into the lane with the answer.',
};

export const allVoiceLines = (): string[] => [...Object.values(GUIDE), ...Object.values(TIP_LINES)];

/** Volt says a line out loud with the sound on (silent with it off). */
export function voltSays(line: string, soundOn: boolean): void {
  if (soundOn) speak(line, VOICE_FOLDER);
}
