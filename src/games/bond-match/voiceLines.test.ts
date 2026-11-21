import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { allVoiceLines } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/bond-match/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py bond-match.
voiceLinesSuite('bond-match', allVoiceLines, { title: 'Bond Match voice clips' });
