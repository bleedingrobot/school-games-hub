/**
 * Every line Swamp Hen's Reed Rows can read aloud, so each one can have a recorded clip (public/voice/swamphen/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to the
 * browser's own voice. No line says the answer to a go before the child has tapped it.
 */
import { FRIEND_NAMES, METALS } from '../../../shared/swamphen/progress';
import { STEPS, STEP_KEYS, keyPair, kindOfKey, type Go, type Slip, type Step } from '../../../shared/swamphen/round';
import { nextPartWords } from '../../components/NextPartChip';
import { WORDS } from './words';
import { BIG_GARDEN_STEP } from '../../../shared/swamphen/config';
import { WEAR_ME_LINE } from '../../kit/WhatsNext';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/swamphen/';

type Said = Pick<Go, 'kind' | 'rows' | 'cols' | 'total'>;

/** The question a go asks. */
export function askLine({ kind, rows, cols, total }: Said): string {
  switch (kind) {
    case 'equal': return 'Which garden has equal rows?';
    case 'plant': return `Plant ${rows} rows of ${cols}. How many shoots?`;
    case 'mat': return `${rows} rows of ${cols} are under the mat. How many shoots?`;
    case 'turn': return `${rows} rows of ${cols}. Turn the garden. Which garden is it now?`;
    case 'which': return `Which garden is ${rows} rows of ${cols}?`;
    case 'share': return `${total} shoots go into ${rows} equal rows. How many in each row?`;
    case 'cut': return `${rows} rows of ${cols}. Here are 5 rows you know, and ${rows - 5} more row${rows - 5 === 1 ? '' : 's'}. How many shoots?`;
    default: return `${rows} rows of ${cols}. Think of 10 rows, then take one row away. How many shoots?`;
  }
}

/** After the first wrong tap: a word on the slip, never the answer. */
export const SLIP_LINES: Record<Slip, string> = {
  added: 'That adds the numbers. Count equal rows instead.',
  joined: 'Those two digits are stuck together. Count the rows.',
  short: 'That is a row too few. Count every row.',
  spare: 'That has an extra row, or a few extra shoots. Count again.',
  forgot: 'You left a row out. Count all the rows.',
  minus: 'Sharing is not taking away. Deal the shoots into the rows.',
  rows: 'That is how many rows there are. How many shoots in each one?',
  turned: 'That garden is turned the other way. Look at the rows first.',
  unturned: 'That is the garden before it was turned.',
  scatter: 'Those shoots are not in rows. Look for equal rows.',
  uneven: 'Look again. One row has a different number of shoots.',
  near: 'Not quite. Count along the rows.',
};

/** "Let's look together": what the garden shows, by kind. */
export function lookLine(kind: Go['kind']): string {
  switch (kind) {
    case 'equal': return 'Equal rows all have the same number of shoots. Check every row.';
    case 'plant': return 'Count one row, then jump along the rows.';
    case 'mat': return 'Count one row. Then jump the same all the way down.';
    case 'turn': return 'Turning it round swaps the rows and the shoots in a row.';
    case 'which': return 'Look at the rows first, then the shoots in one row.';
    case 'share': return 'Deal the shoots out, one for each row, again and again.';
    case 'cut': return 'Count the 5 rows you know. Then add the rows left.';
    default: return 'Ten rows is easy. Then take one row away.';
  }
}

/** What the home screen says: who is planting, and "come back tomorrow" once today's reed row has changed. */
export const homeLine = (title: string, doneToday: boolean): string => (doneToday ? `${title} ${WORDS.doneToday}` : title);

/** What the finish screen says: what happened, how the round went, then "next time: ..." when the child moved on a step. */
export const finishLine = (main: string, how: string, nextStep: Step | null): string =>
  [main, how, nextStep === BIG_GARDEN_STEP ? WORDS.bigGate : null, nextStep ? WORDS.nextStep(nextStep) : null].filter(Boolean).join(' ');

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.bigGate, WORDS.lookTitle, WORDS.nowYouTry, WORDS.oneEach, ...Object.values(WORDS.demo).flat(), WORDS.fair, WORDS.unfair, WORDS.dealIt, ...WORDS.right, ...WORDS.tip, ...Object.values(SLIP_LINES), nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (const name of Object.values(FRIEND_NAMES)) {
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
  }
  // Every go each step asks, as that step asks it (rows are planted on most steps and under the mat on step 7).
  for (const { step } of STEPS) {
    for (const key of STEP_KEYS[step]) {
      const kind = kindOfKey(key, step)!;
      const [a, b] = keyPair(key);
      const said: Said = kind === 'share' ? { kind, rows: b, cols: a / b, total: a } : { kind, rows: a, cols: b, total: a * b };
      lines.add(askLine(said));
      lines.add(lookLine(kind));
    }
  }
  const mains = [WORDS.doneToday, ...METALS.slice(1).map((m) => WORDS.rowTurned(m as 'bronze')), ...Object.values(FRIEND_NAMES).map(WORDS.goldenGarden)];
  for (const main of mains) for (const how of Object.values(WORDS.how)) for (const up of [null, ...STEPS.slice(1).map((s) => s.step)]) lines.add(finishLine(main, how, up));
  // The friend on a golden-prize day: its picture can now be worn on the profile (card P9).
  lines.add(WEAR_ME_LINE);
  return [...lines];
}
