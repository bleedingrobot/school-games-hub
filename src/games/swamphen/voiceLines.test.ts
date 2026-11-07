import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { allVoiceLines } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/swamphen/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py swamphen.
voiceLinesSuite('swamphen', allVoiceLines, { title: 'Swamp Hen’s Reed Rows voice clips' });
