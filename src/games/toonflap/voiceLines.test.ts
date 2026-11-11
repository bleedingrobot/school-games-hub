import { describe, expect, it } from 'vitest';
import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { addRun, emptyProgress, nextStep } from '../../../shared/toonflap/collection';
import { LEVELS } from '../../../shared/toonflap/levels';
import { allVoiceLines, voiceLine } from './guide';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/toonflap/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py toonflap.
voiceLinesSuite('toonflap', allVoiceLines, { title: 'Toon Flap voice clips' });

describe('Toon Flap voice lines', () => {
  it('says every next-step line and level tip, but never a maths question or a changing number', () => {
    let p = emptyProgress();
    for (const [i, l] of LEVELS.entries()) {
      const day = `2026-12-${String(i + 1).padStart(2, '0')}`;
      expect(voiceLine(nextStep(p, day))).not.toBeNull();
      expect(voiceLine(l.newThing)).not.toBeNull();
      p = addRun(p, { level: l.id, maths: true, seconds: 40, medal: 'silver', bumps: 0, checks: [], rightGaps: 0, potionUsed: false }, day).progress;
      expect(voiceLine(nextStep(p, day))).not.toBeNull();
    }
    expect(voiceLine(nextStep(p, '2027-01-01'))).not.toBeNull();
    expect(voiceLine('6 × 7 = ?')).toBeNull();
    expect(voiceLine('Time 31.4 seconds')).toBeNull();
    expect(allVoiceLines().length).toBeLessThan(80);
  });
});
