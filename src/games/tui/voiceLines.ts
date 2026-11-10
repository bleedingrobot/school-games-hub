/**
 * Every line Tūī's Ten Tree can read aloud, so each one can have a recorded clip (public/voice/tui/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to
 * the browser's own voice. No line says the answer to a go before the child has tapped it.
 *
 * The numbers are said at every help level (docs/TUI-PLAN.md section 4): level 5 tells the story ("Ten berries on the
 * branch, and 4 more"); levels 4 to 0 read the sum ("Ten plus 4. How many?"), so a child who cannot read the sum yet
 * still hears it. "Hear it again" says the same as the go's first read.
 */
import { FRIEND_NAMES, METALS } from '../../../shared/tui/progress';
import { KEYS, STEPS, type Go, type HelpLevel, type Step, type Way } from '../../../shared/tui/round';
import { nextPartWords } from '../../components/NextPartChip';
import { demoLines } from './demo';
import { WORDS } from './words';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/tui/';

type Said = Pick<Go, 'v' | 'n' | 'teen'>;

/** The story line: level 5's question, and Bella's help after a second wrong tap. */
export function storyLine({ v, n, teen }: Said): string {
  if (v === 0) return `Ten berries on the branch, and ${n} more. How many berries?`;
  if (v === 1) return `${n} berr${n === 1 ? 'y' : 'ies'}, and ten more on the branch. How many berries?`;
  if (v === 2) return `Tūī needs ${teen} berries. Here is a kete of ten. How many more berries?`;
  return `${teen} berries. The kete of ten flies away. How many berries are left?`;
}

/** The sum read aloud: levels 4 to 0. */
export function sumLine({ v, n, teen }: Said): string {
  if (v === 0) return `Ten plus ${n}. How many?`;
  if (v === 1) return `${n} plus ten. How many?`;
  if (v === 2) return `Ten plus how many makes ${teen}?`;
  return `${teen} take away ten. How many are left?`;
}

/** What Bella says as a go starts, by its help level. */
export function askLine(go: Said & { l: HelpLevel }): string {
  return go.l >= 5 ? storyLine(go) : sumLine(go);
}

/** What the home screen says: who is filling up, and "come back tomorrow" once today's flower has changed. */
/** The separator between the parts of a longer text: the game says the parts one after another, each from its own clip. */
export const PART_BREAK = '\n';

export const homeLine = (title: string, doneToday: boolean): string => (doneToday ? [title, WORDS.doneToday].join(PART_BREAK) : title);

/**
 * What the finish screen says, part by part: the title (the opening for how the day went, then what turned; on a Golden Nest day
 * the prize, then the opening), the tricky-day chip, and "next time: how many more?" when the child moved on a step.
 */
export function finishLine(title: string[], tricky: boolean, nextStep: Step | null): string {
  const said = [...title];
  if (tricky) said.push(WORDS.trickyChip);
  if (nextStep) said.push(WORDS.nextStep(nextStep));
  return said.join(PART_BREAK);
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.berriesBack, WORDS.lookTogether, WORDS.nowTry, WORDS.tenAndTen, WORDS.whatsNext, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (const name of Object.values(FRIEND_NAMES)) {
    // The home line is said in parts (the title, then "come back tomorrow"), so each part is a clip of its own.
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) lines.add(homeLine(title, false));
  }
  for (const key of KEYS) {
    const n = Number(key.split(':')[1]);
    for (const v of [0, 1, 2, 3] as Way[]) {
      const go = { v, n, teen: 10 + n };
      lines.add(storyLine(go));
      lines.add(sumLine(go));
      lines.add(WORDS.right(v >= 2 ? n : 10 + n, n));
    }
    lines.add(WORDS.rightRedo(n));
    // Mistakes that teach (maths review R5): why each kind of wrong nest is wrong. The number said is the nest tapped.
    if (n >= 2) lines.add(WORDS.why('reverse', n * 10 + 1, 0));
    lines.add(WORDS.why('total', 10 + n, 2));
    lines.add(WORDS.why('total', 10 + n, 3));
  }
  for (const kind of ['tens', 'ones', 'off1', 'up'] as const) lines.add(WORDS.why(kind, 20, 0));
  // The finish is said in parts, each from its own clip: the opening for the day, what turned (or the prize), the chip.
  for (const how of Object.values(WORDS.how)) lines.add(how);
  lines.add(WORDS.doneToday);
  lines.add(WORDS.trickyChip);
  for (const m of METALS.slice(1)) lines.add(WORDS.flowerTurned(m));
  for (const name of Object.values(FRIEND_NAMES)) lines.add(WORDS.goldenNest(name));
  for (const s of STEPS.slice(1)) lines.add(WORDS.nextStep(s.step));
  for (const line of demoLines()) lines.add(line);
  return [...lines];
}
