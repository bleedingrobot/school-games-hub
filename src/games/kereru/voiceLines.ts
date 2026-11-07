/**
 * Every line Kererū's Number Line can read aloud, so each one can have a recorded clip (public/voice/kereru/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to the
 * browser's own voice. No line says the answer to a go before the child has tapped it.
 */
import { FRIEND_NAMES, METALS, type Metal } from '../../../shared/kereru/progress';
import { KEYS, STEPS, kindFor, kindOfKey, keyNumber, keyLine, type Go, type Slip, type Step } from '../../../shared/kereru/round';
import { nextPartWords } from '../../components/NextPartChip';
import { WORDS } from './words';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/kereru/';

type Said = Pick<Go, 'kind' | 'n' | 'step10' | 'posts'>;

/** The question a go asks. */
export function askLine({ kind, n, step10, posts }: Said): string {
  if (kind === 'place') return `Where does ${n} go on the branch?`;
  if (kind === 'read') return 'What number is at the arrow?';
  if (kind === 'tens') return `What is ten ${step10 > 0 ? 'more' : 'less'} than ${n}?`;
  return `Is ${n} closer to ${posts![0]} or ${posts![1]}?`;
}

/** After the first wrong tap on a card go: a word on the slip, never the answer. */
export const SLIP_LINES: Record<Slip, string> = {
  reverse: 'Those digits are the wrong way round. Look at the tens first.',
  ten: 'That is a whole ten away. Look again.',
  one: 'Close! Count along from the nearest ten.',
  mirror: 'That is on the other side of the branch.',
  near: 'Look at which post is nearer.',
};

/** After a wrong place tap: which side the child's spot is on. */
export const PLACE_LINES = { early: 'That is too early. Try further along.', late: 'That is too far. Try nearer the start.' } as const;

/** "Let's look together": what the branch shows, by kind (place goes name the two marks either side). */
export function lookLine(go: Pick<Go, 'kind' | 'n' | 'max'>): string {
  if (go.kind === 'place') {
    const size = go.max >= 1000 ? 100 : 10;
    const low = Math.floor(go.n / size) * size;
    return low === go.n ? `${go.n} is a mark on the branch. Look for it.` : `${go.n} is between ${low} and ${low + size}. Look in the middle.`;
  }
  if (go.kind === 'read') return 'Find the nearest number you can see, then count the little steps.';
  if (go.kind === 'tens') return 'Ten more is one ten along. Ten less is one ten back.';
  return 'Count how far it is from each post. The nearer post wins.';
}

/** What the home screen says: who is flying, and "come back tomorrow" once today's cluster has changed. */
export const homeLine = (title: string, doneToday: boolean): string => (doneToday ? `${title} ${WORDS.doneToday}` : title);

/** What the finish screen says, with "next time: ..." when the child moved on a step. */
export const finishLine = (main: string, nextStep: Step | null): string => (nextStep ? `${main} ${WORDS.nextStep(nextStep)}` : main);

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.tryAgain, WORDS.lookTitle, WORDS.nowYouTry, ...WORDS.right, ...Object.values(SLIP_LINES), ...Object.values(PLACE_LINES), nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (const name of Object.values(FRIEND_NAMES)) {
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
  }
  for (const key of KEYS) {
    const n = keyNumber(key);
    const kinds = kindOfKey(key) === 'zoom' ? (['place', 'read'] as const) : ([kindFor(key)] as const);
    for (const kind of kinds) {
      const near = kind === 'near' ? { posts: nearPosts(n, keyLine(key)) } : { posts: null };
      const said = { kind, n, step10: key.includes('-') ? -10 : 10, ...near };
      lines.add(askLine(said));
      lines.add(lookLine({ kind, n, max: keyLine(key) }));
    }
  }
  const mains = [WORDS.doneToday, ...METALS.slice(1).map((m: Metal) => WORDS.clusterTurned(m)), ...Object.values(FRIEND_NAMES).map(WORDS.goldenBranch)];
  for (const main of mains) for (const up of [null, ...STEPS.slice(1).map((s) => s.step)]) lines.add(finishLine(main, up));
  return [...lines];
}

function nearPosts(n: number, max: number): [number, number] {
  const size = max >= 1000 ? 100 : 10;
  const low = Math.floor(n / size) * size;
  return [low, low + size];
}
