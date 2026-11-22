import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { storyVoiceLine } from '../../../shared/kit/stories';
import { PAGE_READERS, QUEST_STORIES, QUEST_VOICES } from './stories';

// Each quest giver reads their own story (docs/plans/trader-quests/PLAN.md, Q.3, and trader-quests-2, R.3), in their own
// Kokoro voice; Pip and Pop take turns, a page each. After changing a story, rewrite the lists with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/trader/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py quest-<id> (the voice is its VOICE_FOR line there).
for (const id of Object.keys(QUEST_VOICES)) {
  const voices = PAGE_READERS[id] ? [...new Set(PAGE_READERS[id].map((r) => r.voice))].join(' and ') : QUEST_VOICES[id];
  voiceLinesSuite(`quest-${id}`, () => QUEST_STORIES[id].pages.map(storyVoiceLine), { title: `${QUEST_STORIES[id].title} voice clips (${voices})` });
}

it('records each quest with the voices the game names (VOICE_FOR and LINE_VOICES in scripts/voice-clips.py)', () => {
  const script = readFileSync(join(process.cwd(), 'scripts/voice-clips.py'), 'utf8');
  for (const [id, voice] of Object.entries(QUEST_VOICES)) expect(script).toContain(`VOICE_FOR['quest-${id}'] = ('${voice}',`);
  for (const [id, readers] of Object.entries(PAGE_READERS)) {
    expect(readers).toHaveLength(QUEST_STORIES[id].pages.length);
    expect(script).toContain(`'quest-${id}': [${readers.map((r) => `'${r.voice}'`).join(', ')}]`);
  }
});
