/**
 * Every line Lizard's Bundles can read aloud, so each one can have a recorded clip (public/voice/lizard/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to the
 * browser's own voice. No line says the answer to a go before the child has found it.
 */
import { FRIEND_NAMES, METALS, type Metal } from '../../../shared/lizard/progress';
import { KEYS, STEPS, kindOfKey, keyNumber, matOf, matValue, type Go, type Mat, type Slip, type Step } from '../../../shared/lizard/round';
import { nextPartWords } from '../../components/NextPartChip';
import { WORDS } from './words';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/lizard/';

type Said = Pick<Go, 'kind' | 'n' | 'dir' | 'unit'>;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 tens and 7 ones", "3 hundreds, 0 tens and 6 ones". */
export function placesWords(n: number): string {
  const { h, t, o } = matOf(n);
  const ones = count(o, 'one', 'ones');
  if (n < 100) return `${count(t, 'ten', 'tens')} and ${ones}`;
  return `${count(h, 'hundred', 'hundreds')}, ${count(t, 'ten', 'tens')} and ${ones}`;
}

/** The question a go asks. */
export function askLine({ kind, n, dir, unit }: Said): string {
  if (kind === 'build') return `Make ${n} with bundles and sticks.`;
  if (kind === 'bundle') return `Tie the sticks into bundles. Ten sticks make a bundle.`;
  if (kind === 'swap') return 'Untie one bundle. Then you have ten more sticks.';
  if (kind === 'read') return `${placesWords(n)}. What number is that?`;
  return `What is ${unit === 100 ? 'a hundred' : 'ten'} ${dir > 0 ? 'more' : 'less'} than ${n}?`;
}

/** What goes with a wrong try that is not a number card (a count on the mat). */
export const MAT_LINES = {
  build: 'Not quite. Count your bundles, then your sticks.',
  tie: 'You have ten sticks or more. Tie ten into a bundle.',
  bundle: 'Can you tie more? Ten sticks make a bundle.',
  swap: 'Untie one bundle. Then count the sticks.',
} as const;

/** After the first wrong card: a word on the slip, never the answer. */
export const SLIP_LINES: Record<Slip, string> = {
  reverse: 'Those digits are the wrong way round. Tens come first.',
  face: 'Count the tens as tens, not as ones.',
  zero: 'Look at the zero. It holds a place, and it is only needed once.',
  ignore: 'The empty place still counts. Look again.',
  ones: 'Ten more is one more bundle. The ones stay the same.',
  way: 'Look again. Is it more, or less?',
  join: 'Ten more is one more bundle. Look again.',
  near: 'Close. Look at the bundles and sticks again.',
};

export type LineKey = Slip | keyof typeof MAT_LINES;
const SLIPS = new Set<string>(Object.keys(SLIP_LINES));

export const WHY_LINES: Record<LineKey, string> = { ...SLIP_LINES, ...MAT_LINES };

/** What is written (not spoken) after a wrong try: what the child made or picked, then the reason. Never the answer to a card go. */
export function tryLine(go: Pick<Go, 'kind' | 'n'>, mat: Mat, key: LineKey, picked?: number): string {
  if (SLIPS.has(key)) return `You picked ${picked}. ${WHY_LINES[key]}`;
  if (go.kind === 'build') return key === 'tie' ? MAT_LINES.tie : `You made ${matValue(mat)}. We need ${go.n}.`;
  const have = [...(mat.h > 0 ? [count(mat.h, 'raft', 'rafts')] : []), count(mat.t, 'bundle', 'bundles'), count(mat.o, 'stick', 'sticks')];
  return `You have ${have.slice(0, -1).join(', ')} and ${have[have.length - 1]}. ${go.kind === 'swap' ? MAT_LINES.swap : MAT_LINES.bundle}`;
}

/** "Let's look together": what the mat shows, by kind. */
export function lookLine(go: Pick<Go, 'kind' | 'dir' | 'unit'>): string {
  if (go.kind === 'build') return 'Count the bundles for the tens, then the sticks for the ones.';
  if (go.kind === 'bundle') return 'Ten sticks tie into one bundle. Tie all the tens you can.';
  if (go.kind === 'swap') return 'One bundle is ten sticks. Untie one and you get ten more sticks.';
  if (go.kind === 'read') return 'Count the bundles for the tens, then the sticks for the ones.';
  return go.unit === 100 ? 'A hundred more is one more raft. A hundred less is one raft fewer.' : 'Ten more is one more bundle. Ten less is one bundle fewer.';
}

/** What the home screen says: whose den it is, and "come back tomorrow" once today's bundle has changed. */
export const homeLine = (title: string, doneToday: boolean): string => (doneToday ? `${title} ${WORDS.doneToday}` : title);

/** What the finish screen says, with "next time: ..." when the child moved on a step. */
export const finishLine = (main: string, nextStep: Step | null): string => (nextStep ? `${main} ${WORDS.nextStep(nextStep)}` : main);

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.tryAgain, WORDS.lookTitle, WORDS.nowYouTry, WORDS.raftTip, WORDS.tieNudge, WORDS.lookAtYours, ...WORDS.right, ...Object.values(WHY_LINES), nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (const name of Object.values(FRIEND_NAMES)) {
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
  }
  for (const key of KEYS) {
    const kind = kindOfKey(key)!;
    const said = { kind, n: keyNumber(key), dir: key.includes('-') ? -1 : 1, unit: key.startsWith('pvhun:') ? 100 : 10 } as const;
    lines.add(askLine(said));
    lines.add(lookLine(said));
  }
  const mains = [WORDS.doneToday, ...METALS.slice(1).map((m: Metal) => WORDS.bundleTurned(m)), ...Object.values(FRIEND_NAMES).map(WORDS.goldenRaft)];
  for (const main of mains) for (const up of [null, ...STEPS.slice(1).map((s) => s.step)]) lines.add(finishLine(main, up));
  return [...lines];
}
