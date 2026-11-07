import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { allVoiceLines } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/weka/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py weka.
voiceLinesSuite('weka', allVoiceLines, {
  title: 'Weka’s Stepping Stones voice clips',
  accent: { startsWith: 'Takahē wants to cross', slug: /^takahe-wants-to-cross/ },
});
