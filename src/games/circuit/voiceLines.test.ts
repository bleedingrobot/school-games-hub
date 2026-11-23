import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { allVoiceLines } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/circuit/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py circuit.
voiceLinesSuite('circuit', allVoiceLines, { title: 'Circuit Racer voice clips' });
