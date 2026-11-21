import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { storyVoiceLine } from '../../../shared/kit/stories';
import { QUEST_STORIES, QUEST_VOICES } from './stories';

// Each quest giver reads their own story (docs/plans/trader-quests/PLAN.md, Q.3), in their own Kokoro voice. After
// changing a story, rewrite the lists with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/trader/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py quest-<id> (the voice is its VOICE_FOR line there).
for (const id of Object.keys(QUEST_VOICES)) {
  voiceLinesSuite(`quest-${id}`, () => QUEST_STORIES[id].pages.map(storyVoiceLine), { title: `${QUEST_STORIES[id].title} voice clips (${QUEST_VOICES[id]})` });
}
