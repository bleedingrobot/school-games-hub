import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { allVoiceLines } from './voiceLines';

// The list scripts/voice-clips.py records (Bella, like every game). After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/showdown/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py showdown.
voiceLinesSuite('showdown', allVoiceLines, { title: 'Class Showdown voice clips' });
