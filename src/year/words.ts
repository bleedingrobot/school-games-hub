/**
 * Every line the "What year are you in?" question says or reads aloud (YearQuestion.tsx), so the screen and Bella's clips
 * (public/voice/year/, voiceLines.test.ts) can't drift apart.
 */
import { PUPIL_YEARS } from '../data/years';

export const VOICE_FOLDER = 'voice/year/';

export const WORDS = {
  question: 'What year are you in at school?',
  notSure: 'I’m not sure',
  check: (year: number) => `Year ${year}. Is that right?`,
  yes: 'Yes!',
  back: 'No, go back',
  later: 'That’s okay! Your teacher will add it for you.',
  thanks: 'Thank you! Let’s play.',
};

export function allVoiceLines(): string[] {
  return [WORDS.question, ...PUPIL_YEARS.map((y) => WORDS.check(y)), WORDS.later, WORDS.thanks];
}
