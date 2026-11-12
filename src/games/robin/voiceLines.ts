/**
 * Every line Robin’s Berry Basket can read aloud, so each one can have a recorded clip (public/voice/robin/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to the
 * browser's own voice. No line says the answer to a go before the child has settled on it.
 *
 * The voice follows the help level (docs/ROBIN-PLAN.md): a give go always says how many to give ("Give me four berries.");
 * levels 5 and 3 also say each number as a berry is tapped or touched; "Hear it again" repeats the question. A right answer
 * is followed by one short sentence ("Four berries.").
 *
 * A text with more than one line (home, finish) is joined with a newline; the game says the parts one after another, so
 * each part has its own clip.
 */
import { FRIEND_NAMES, STEPS } from '../../../shared/robin/config';
import { METALS } from '../../../shared/robin/progress';
import { ALL_COUNT_KEYS, showGo, SLIPS, type Go } from '../../../shared/robin/round';
import { nextPartWords } from '../../components/NextPartChip';
import { numWord, WORDS } from './words';
import { WEAR_ME_LINE } from '../../kit/WhatsNext';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/robin/';

/** The separator between the parts of a longer text. */
export const PART_BREAK = '\n';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const berries = (n: number) => `${numWord(n)} berr${n === 1 ? 'y' : 'ies'}`;

type Said = Pick<Go, 'kind' | 'n' | 'answer'>;

/** What Bella says as a go starts (and for "Hear it again"). */
export function askLine(go: Said): string {
  if (go.kind === 'give') return `Give me ${berries(go.n)}.`;
  if (go.kind === 'counton') return `There are ${berries(go.n)} under the cloth. One more comes. How many now?`;
  return WORDS.promptHowMany;
}

/** After the right answer: one short sentence. Never before the child has settled on it. */
export function modelLine(go: Said): string {
  if (go.kind === 'counton') return `${cap(numWord(go.n))} and one more is ${numWord(go.answer)}.`;
  return `${cap(berries(go.answer))}.`;
}

/** What is said as a berry is counted (levels 5 and 3): just its number. */
export const countLine = (n: number): string => cap(numWord(n));

/** Why a wrong card or count is wrong, then Bella's "Count again". */
export const whyLine = (kind: Parameters<typeof WORDS.why>[0]): string => WORDS.why(kind);

/** After a wrong card on a How many go: the child's own count, then "Find the card that says the same." (two clips). */
export const ownCountLine = (answer: number): string => [WORDS.youCounted(answer), WORDS.findSame].join(PART_BREAK);

/** What the home screen says: who wants berries, and "come back tomorrow" once today's basket has turned. */
export const homeLine = (title: string, doneToday: boolean): string => (doneToday ? [title, WORDS.doneToday].join(PART_BREAK) : title);

/** What the finish screen says: what happened, how the round went, then what changes next time. */
export const finishLine = (main: string, how: string, next: string): string => [main, how, next].join(PART_BREAK);

/** Every go the game can make, once each (the words do not depend on the seed, only on the key). */
function* everyGo(): Generator<Go> {
  for (const key of ALL_COUNT_KEYS) {
    const go = showGo({ seed: 1 }, 0, { key, l: 3 });
    if (!go) throw new Error(`No go for ${key}`);
    yield go;
  }
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([
    WORDS.lookTogether, WORDS.lookFill, WORDS.nowTry, WORDS.promptHowMany, WORDS.putOneFirst, WORDS.oneMore, WORDS.pressOk,
    WORDS.touchFirstSay, WORDS.demoHowMany, WORDS.demoPickCard, WORDS.demoCountOn, WORDS.demoCountOnAnswer, WORDS.findSame, WORDS.countWithMeSay,
    nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true), WORDS.doneToday, ...WORDS.tip,
  ]);
  const names = Object.entries(FRIEND_NAMES);
  for (const [id, name] of names) {
    lines.add(WORDS.wants(name));
    if (id !== 'robin') lines.add(WORDS.nextFriend(name));
  }
  for (const kind of SLIPS) lines.add(WORDS.why(kind));
  for (const go of everyGo()) {
    lines.add(askLine(go));
    lines.add(modelLine(go));
  }
  for (let n = 1; n <= 24; n++) lines.add(countLine(n));
  for (let n = 1; n <= 20; n++) lines.add(WORDS.youCounted(n));
  const mains = [...METALS.slice(1).map((m) => WORDS.basketTurned(m)), ...names.map(([, name]) => WORDS.goldenFeast(name))];
  for (const main of mains) lines.add(main);
  for (const how of Object.values(WORDS.how)) lines.add(how);
  for (const s of STEPS.slice(1)) lines.add(WORDS.nextStep(s.step));
  lines.add(WORDS.lessHelp);
  lines.add(WORDS.moreHelp);
  lines.add(WORDS.sameAgain);
  // The friend on a golden-prize day: its picture can now be worn on the profile (card P9).
  lines.add(WEAR_ME_LINE);
  return [...lines];
}
