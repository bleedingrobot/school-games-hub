import { describe, expect, it } from 'vitest';
import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { LADDER } from '../../../shared/maths/ladder';
import { makeRunQuestions, seededRandom, type MathsContext } from '../../../shared/maths/serverQuestions';
import { allVoiceLines, GUIDE, questionPieces, TIPS } from './voiceLines';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/goblinstorm/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py goblinstorm.
voiceLinesSuite('goblinstorm', allVoiceLines, { title: 'Goblin Storm voice clips' });

describe('Goblin Storm voice lines', () => {
  it('reads level-up questions from her clips across the ladder, and never says an answer', () => {
    let read = 0;
    let all = 0;
    for (const skill of LADDER.filter((s) => s.built)) {
      for (const multipleChoice of [false, true]) {
        const focus = { source: 'teacher-class' as const, skills: [skill.id], onlyThese: true, endsAt: null, canChoose: false, own: null };
        const context: MathsContext = { facts: [], settings: { multipleChoice }, focus };
        for (const q of makeRunQuestions(context, 4, seededRandom(`gs-voice-${skill.id}`))) {
          all++;
          const pieces = questionPieces(q.spoken);
          if (pieces) read++;
          // She says the question's own numbers, in order, and nothing else (never the answer).
          if (pieces) expect(pieces.filter((p) => /^\d+$/.test(p))).toEqual(q.spoken.match(/\d+/g) ?? []);
        }
      }
    }
    // Whole-number questions are all hers; decimals, fractions and big numbers go to the browser's voice.
    expect(read / all).toBeGreaterThan(0.6);
    expect(questionPieces('What is 7 times 8?')).not.toBeNull();
    expect(questionPieces('What is 0.5 plus 0.25?')).toBeNull();
    expect(questionPieces('What is 4500 plus 20?')).toBeNull();
    expect(allVoiceLines()).toEqual(expect.arrayContaining([...Object.values(GUIDE), ...TIPS]));
  });
});
