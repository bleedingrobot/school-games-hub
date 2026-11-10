import { expect, it } from 'vitest';
import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { KEYS, kindFor, kindOfKey, keyLine, keyNumber, showGo, sisterGo } from '../../../shared/pigeon/round';
import { allVoiceLines, askLine, lookLine } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/pigeon/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py pigeon.
voiceLinesSuite('pigeon', allVoiceLines, { title: 'Pigeon’s Number Line voice clips' });

it('has every line a sister go says (its question and look line), whatever the seed', () => {
  const said = new Set(allVoiceLines());
  for (const key of KEYS) {
    const kind = kindOfKey(key) === 'zoom' ? (keyNumber(key) % 2 ? 'place' : 'read') : kindFor(key);
    for (const seed of [1, 4242, 99991, 777777, 1234567]) {
      const go = showGo({ seed }, 2, { key, kind, l: 2 });
      const sister = go && sisterGo({ seed }, 2, go);
      if (!sister) continue;
      expect(said.has(askLine(sister))).toBe(true);
      expect(said.has(lookLine(sister))).toBe(true);
      expect(keyLine(sister.key)).toBe(go.max);
    }
  }
});
