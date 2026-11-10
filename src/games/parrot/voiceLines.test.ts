import { describe, expect, it } from 'vitest';
import { voiceLinesSuite } from '../../kit/voiceLinesSuite';
import { DEMOS } from './demo';
import { KEYS, makeRound, showRound, sisterGo, GUIDED_KEY } from '../../../shared/parrot/round';
import { STEPS } from '../../../shared/parrot/config';
import { allVoiceLines, askLine, eqLine, homeLine, finishLine, modelLine, PART_BREAK, whyLine } from './voiceLines';
import { WORDS } from './words';

// The list scripts/voice-clips.py records. After changing a line, rewrite it with
//   WRITE_VOICE_LINES=1 npx vitest run src/games/parrot/voiceLines.test.ts
// then make the new clips with scripts/voice-clips.py parrot.
voiceLinesSuite('parrot', allVoiceLines, { title: 'Parrot’s See-saw voice clips' });

describe('Parrot’s See-saw voice lines', () => {
  const said = new Set(allVoiceLines());
  const heard = (text: string) => text.split(PART_BREAK).every((part) => said.has(part));

  it('has every line a screen can say, at every step and help level', () => {
    for (const step of STEPS.map((s) => s.step)) {
      for (const level of [0, 1, 2, 3, 4, 5] as const) {
        for (const seed of [1, 2, 3, 4]) {
          for (const [i, go] of showRound(makeRound(seed, [], { step, level, guided: seed === 1 && step === 1 })).entries()) {
            expect(heard(askLine(go)), askLine(go)).toBe(true);
            expect(heard(eqLine(go)), eqLine(go)).toBe(true);
            expect(heard(modelLine(go)), modelLine(go)).toBe(true);
            const sister = sisterGo({ seed }, i, go);
            if (sister) {
              expect(heard(eqLine(sister)), eqLine(sister)).toBe(true);
              expect(heard(modelLine(sister)), modelLine(sister)).toBe(true);
              for (const w of sister.wrongs) expect(heard(whyLine(w.kind))).toBe(true);
            }
            for (const w of go.wrongs) expect(heard(whyLine(w.kind))).toBe(true);
            expect(heard(whyLine('near'))).toBe(true);
          }
        }
      }
    }
  });

  it('says home and finish lines from the list, and shows demos only with made-up goes the real keys never ask', () => {
    for (const kind of ['tf', 'sub'] as const) {
      expect(KEYS[kind]).not.toContain(DEMOS[kind].key);
      expect(heard(DEMOS[kind].steps[0].line)).toBe(true);
    }
    for (const title of [WORDS.wants('Robin'), WORDS.nextFriend('Owl')]) expect(heard(homeLine(title, true))).toBe(true);
    expect(heard(finishLine(WORDS.goldenBell('Kiwi'), WORDS.how.most, WORDS.nextStep(4)))).toBe(true);
    expect(heard(finishLine(WORDS.thingTurned('silver'), WORDS.how.tricky, WORDS.sameAgain))).toBe(true);
  });

  it('reads the equation, and keeps numbers out of the stone levels', () => {
    const [first] = showRound(makeRound(1, [], { step: 1, level: 5, guided: true }));
    expect(first.key).toBe(GUIDED_KEY);
    expect(eqLine(first)).toBe('Five is the same as two plus how many?');
    expect(modelLine(first)).toBe('Five is two plus three.');
    expect(askLine(first)).toBe(WORDS.stoneLive);
    expect(askLine(first)).not.toMatch(/\d|\b(one|two|three|four|five)\b/i);
  });

  it('is English only and about 2000 lines or fewer (the sister goes add their own equations)', () => {
    expect(allVoiceLines().join(' ')).not.toMatch(/kete|kōwhai|aotearoa|tūī|kererū/i);
    expect(allVoiceLines().length).toBeLessThanOrEqual(2200);
  });
});
