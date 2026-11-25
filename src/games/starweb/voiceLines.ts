/**
 * The lines Star Web reads aloud, each with a recorded clip (public/voice/starweb/<slug>.mp3, made with Kokoro by
 * scripts/voice-clips.py) in Bella's voice. Only fixed lines: the guided first sky, the feedback, the help nudges, medals and
 * the Star Map. Nothing with a sky's own numbers in it (except the guided 3 × 4, which is always the same). Built from
 * words.ts so text and clips can't drift.
 */
import { CREATURES } from '../../../shared/starweb/config';
import { creatureJoined, FREE_OPEN, GUIDE, MAP_TIP, MAP_WELCOME, MEDAL_WORDS, NUDGE, SAY_AGAIN, SAY_FINISH_READY, SAY_SAME, SAY_UNLINKED, SAY_WRONG, SHOW_ME_SAY } from './words';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/starweb/';

export function allVoiceLines(): string[] {
  return [...new Set<string>([
    ...GUIDE.map((g) => g.say),
    SAY_AGAIN, SAY_SAME, SAY_UNLINKED, SAY_WRONG, SHOW_ME_SAY, SAY_FINISH_READY,
    ...Object.values(NUDGE),
    ...Object.values(MEDAL_WORDS).map((m) => m.say),
    MAP_WELCOME, MAP_TIP, FREE_OPEN,
    ...CREATURES.map((c) => creatureJoined(c.id)),
  ])];
}

let recorded: Set<string> | null = null;
/** Is this one of the recorded lines? */
export function isRecorded(text: string): boolean {
  recorded ??= new Set(allVoiceLines());
  return recorded.has(text);
}
