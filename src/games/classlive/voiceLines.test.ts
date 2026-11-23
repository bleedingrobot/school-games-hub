import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { allVoiceLines } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/classlive/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py classlive.
voiceLinesSuite('classlive', allVoiceLines, { title: 'Class Live voice clips' });
