import { voiceLinesSuite } from '../kit/voiceLinesSuite';
import { storyVoiceLine } from '../../shared/kit/stories';
import { ALL_STORIES as CLANS } from './clans/stories';
import { ALL_STORIES as GEMKEEP } from './gem-keep/stories';
import { ALL_STORIES as GOBLIN } from './goblinstorm/stories';
import { ALL_STORIES as LORD } from './lord/stories';
import { ALL_STORIES as TRADER } from './trader/stories';

// Every story page, read by the narrator (am_michael). After changing a story, rewrite the list with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py stories.
voiceLinesSuite(
  'stories',
  () => [...new Set([...CLANS, ...GEMKEEP, ...GOBLIN, ...LORD, ...TRADER].flatMap((s) => s.pages.map(storyVoiceLine)))],
  { title: 'Story narrator clips' },
);
