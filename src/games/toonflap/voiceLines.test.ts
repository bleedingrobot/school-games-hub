import { describe, expect, it } from 'vitest';
import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { emptyProgress, nextStep } from '../../../shared/toonflap/collection';
import { LEVELS } from '../../../shared/toonflap/levels';
import { allVoiceLines, voiceLine } from './guide';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/toonflap/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py toonflap.
voiceLinesSuite('toonflap', allVoiceLines, { title: 'Toon Flap voice clips' });

describe('Toon Flap voice lines', () => {
  it('says every next-step line and level tip, but never a maths question or a changing number', () => {
    const p = emptyProgress();
    for (const l of LEVELS) {
      expect(voiceLine(nextStep(p))).not.toBeNull();
      expect(voiceLine(l.newThing)).not.toBeNull();
      p.levels[l.id] = { finishes: 1, best: 40, bestPlain: null, medal: 'silver' };
    }
    expect(voiceLine(nextStep(p))).not.toBeNull();
    expect(voiceLine('6 × 7 = ?')).toBeNull();
    expect(voiceLine('Time 31.4 seconds')).toBeNull();
    expect(allVoiceLines().length).toBeLessThan(80);
  });
});
