/**
 * Every line Bella reads aloud in Smash Quest: Granny Jetpack's words (words.ts GRANNY), each with a recorded clip in
 * public/voice/bonkers/<slug>.mp3 (made with Kokoro by scripts/voice-clips.py). A line without a clip falls back to the
 * browser's own voice. No line ever says an answer.
 */
import { TRAINERS } from '../../../shared/bonkers/content';
import { GRANNY } from './words';

export function allVoiceLines(): string[] {
  const lines: string[] = [];
  for (const v of Object.values(GRANNY)) {
    if (typeof v === 'string') lines.push(v);
  }
  for (const t of [...TRAINERS.map((x) => x.name), 'Your trainer']) lines.push(GRANNY.trainerReady(t));
  for (const t of [...TRAINERS.map((x) => x.name), 'your trainer']) lines.push(GRANNY.fillBar(t));
  return [...new Set(lines)];
}
