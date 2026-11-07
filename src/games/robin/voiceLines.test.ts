import { describe, expect, it } from 'vitest';
import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { makeRound, showRound, GUIDED_KEY } from '../../../shared/robin/round';
import { STEPS } from '../../../shared/robin/config';
import { allVoiceLines, askLine, countLine, finishLine, homeLine, modelLine, PART_BREAK } from './voiceLines';
import { WORDS } from './words';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/robin/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py robin.
voiceLinesSuite('robin', allVoiceLines, { title: 'Robin’s Berry Basket voice clips' });

describe('Robin’s Berry Basket voice lines', () => {
  const said = new Set(allVoiceLines());
  const heard = (text: string) => text.split(PART_BREAK).every((part) => said.has(part));

  it('has every line a screen can say, at every step and help level', () => {
    for (const step of STEPS.map((s) => s.step)) {
      for (const level of [0, 1, 2, 3, 4, 5] as const) {
        for (const seed of [1, 2, 3, 4, 5, 6]) {
          for (const go of showRound(makeRound(seed, [], { step, level, guided: seed === 1 && step === 1 }))) {
            expect(heard(askLine(go)), askLine(go)).toBe(true);
            expect(heard(modelLine(go)), modelLine(go)).toBe(true);
            for (let n = 1; n <= go.pile; n++) expect(heard(countLine(n)), countLine(n)).toBe(true);
            for (const w of go.wrongs) expect(heard(WORDS.why(w.kind))).toBe(true);
          }
        }
      }
    }
  });

  it('says home and finish lines from the list, asks the first go without giving the answer away, and is English only', () => {
    for (const title of [WORDS.wants('Robin'), WORDS.nextFriend('Kiwi')]) expect(heard(homeLine(title, true))).toBe(true);
    expect(heard(finishLine(WORDS.goldenFeast('Kiwi'), WORDS.nextStep(4)))).toBe(true);
    expect(heard(finishLine(WORDS.basketTurned('silver'), WORDS.sameAgain))).toBe(true);
    const [first] = showRound(makeRound(1, [], { step: 1, level: 5, guided: true }));
    expect(first.key).toBe(GUIDED_KEY);
    expect(askLine(first)).toBe('Give me four berries.');
    expect(modelLine(first)).toBe('Four berries.');
    expect(allVoiceLines().join(' ')).not.toMatch(/kete|kōwhai|aotearoa|kererū/i);
    expect(allVoiceLines().length).toBeLessThanOrEqual(600);
  });
});
