/**
 * Every line Tūī's Ten Tree can read aloud, so each one can have a recorded clip (public/voice/tui/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to
 * the browser's own voice. No line says the answer to a go before the child has tapped it.
 *
 * The voice fades with the help level (docs/TUI-PLAN.md section 4): level 5 tells the story ("Ten berries on the
 * branch, and 4 more"); levels 4 to 1 read the sum ("Ten plus 4. How many?"); level 0 asks only "How many?" and the
 * child reads the sum. "Hear it again" always reads the sum.
 */
import { FRIEND_NAMES, METALS, type Metal } from '../../../shared/tui/progress';
import { DOWN_KEYS, KEYS, moveWrongNests, STEPS, UP_KEYS, type Go, type HelpLevel, type Step, type Way } from '../../../shared/tui/round';
import { nextPartWords } from '../../components/NextPartChip';
import { WORDS } from './words';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/tui/';

type Said = Pick<Go, 'v' | 'n' | 'teen' | 'move'>;

/** The story line: level 5's question, and Bella's help after a second wrong tap. */
export function storyLine({ v, n, teen, move }: Said): string {
  if (move === 'up') return v === 0 ? `${teen} berries on the branch, and ten more fly in. How many berries?` : `Ten berries fly in to join the ${teen}. How many berries?`;
  if (move === 'down') return `${teen} berries. The kete of ten flies away. How many berries are left?`;
  if (v === 0) return `Ten berries on the branch, and ${n} more. How many berries?`;
  if (v === 1) return `${n} berr${n === 1 ? 'y' : 'ies'}, and ten more on the branch. How many berries?`;
  if (v === 2) return `Tūī needs ${teen} berries. Here is a kete of ten. How many more berries?`;
  return `${teen} berries. The kete of ten flies away. How many berries are left?`;
}

/** The sum read aloud: levels 4 to 1, and "Hear it again". */
export function sumLine({ v, n, teen, move }: Said): string {
  if (move === 'up') return v === 0 ? `${teen} plus ten. How many?` : `Ten plus ${teen}. How many?`;
  if (move === 'down') return v === 0 ? `${teen} take away ten. How many are left?` : `Ten plus how many makes ${teen}?`;
  if (v === 0) return `Ten plus ${n}. How many?`;
  if (v === 1) return `${n} plus ten. How many?`;
  if (v === 2) return `Ten plus how many makes ${teen}?`;
  return `${teen} take away ten. How many are left?`;
}

/** Level 0: the child reads the sum. */
export const shortLine = (v: Way, move: Go['move'] = null): string =>
  move === 'down' ? (v === 0 ? 'How many are left?' : 'How many?') : move === 'up' ? 'How many?' : v === 2 ? 'How many more?' : v === 3 ? 'How many are left?' : 'How many?';

/** What Bella says as a go starts, by its help level. */
export function askLine(go: Said & { l: HelpLevel }): string {
  return go.l >= 5 ? storyLine(go) : go.l >= 1 ? sumLine(go) : shortLine(go.v, go.move);
}

/** What the home screen says: who is filling up, and "come back tomorrow" once today's flower has changed. */
export const homeLine = (title: string, doneToday: boolean): string => (doneToday ? `${title} ${WORDS.doneToday}` : title);

/** What the finish screen says, with "next time: how many more?" when the child moved on a step. */
export const finishLine = (main: string, nextStep: Step | null): string => (nextStep ? `${main} ${WORDS.nextStep(nextStep)}` : main);

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.lookTogether, WORDS.nowTry, WORDS.tenAndTen, WORDS.whatsNext, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (const name of Object.values(FRIEND_NAMES)) {
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
  }
  for (const key of KEYS) {
    const n = Number(key.split(':')[1]);
    for (const v of [0, 1, 2, 3] as Way[]) {
      const go = { v, n, teen: 10 + n, move: null };
      lines.add(storyLine(go));
      lines.add(sumLine(go));
      lines.add(shortLine(v));
      lines.add(WORDS.right(v >= 2 ? n : 10 + n, n));
    }
    // Mistakes that teach (maths review R5): why each kind of wrong nest is wrong. The number said is the nest tapped.
    if (n >= 2) lines.add(WORDS.why('reverse', n * 10 + 1, 0));
    lines.add(WORDS.why('total', 10 + n, 2));
    lines.add(WORDS.why('total', 10 + n, 3));
  }
  // Step 6, ten more and ten less: each fact in both of its forms, and the lines for its own wrong nests.
  for (const [keys, move] of [[UP_KEYS, 'up'], [DOWN_KEYS, 'down']] as const) {
    for (const key of keys) {
      const start = Number(key.split(':')[1]);
      for (const v of [0, 1] as const) {
        const go = { v, n: start % 10, teen: start, move };
        lines.add(storyLine(go));
        lines.add(sumLine(go));
        lines.add(shortLine(v, move));
      }
      lines.add(WORDS.rightMove(start, move === 'up', move === 'up' ? start + 10 : start - 10));
      for (const w of moveWrongNests(start, move, () => 0.1)) lines.add(WORDS.why(w.kind, w.n, move === 'down' ? 3 : 0));
    }
  }
  for (const kind of ['tens', 'ones', 'off1', 'up'] as const) lines.add(WORDS.why(kind, 20, 0));
  const mains = [WORDS.doneToday, ...METALS.slice(1).map((m: Metal) => WORDS.flowerTurned(m)), ...Object.values(FRIEND_NAMES).map(WORDS.goldenNest)];
  for (const main of mains) for (const up of [null, ...STEPS.slice(1).map((s) => s.step)]) lines.add(finishLine(main, up));
  return [...lines];
}
