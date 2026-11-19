import { voiceLinesSuite } from '../kit/voiceLinesSuite';
import { allVoiceLines } from './challengeWords';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/components/challengeVoiceLines.test.ts
// then make the new clips with scripts/voice-clips.py challenge.
voiceLinesSuite('challenge', allVoiceLines, { title: 'Challenge banner voice clips' });
