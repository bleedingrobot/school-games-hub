import { expect, it } from 'vitest';
import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { KEYS, kindOfKey, showGo, sisterGo } from '../../../shared/lizard/round';
import { allVoiceLines, askLine } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/lizard/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py lizard.
voiceLinesSuite('lizard', allVoiceLines, { title: 'Lizard’s Bundles voice clips' });

it('has a voice line for every sister go ("Now you try one like it")', () => {
  const lines = new Set(allVoiceLines());
  for (const key of KEYS) for (const seed of [1, 777, 5000, 31337, 99991]) {
    const go = showGo({ seed }, 2, { key, kind: kindOfKey(key)!, l: 3 })!;
    const sister = sisterGo({ seed }, 2, go);
    if (sister) {
      expect(lines.has(askLine(sister))).toBe(true);
    }
  }
});
