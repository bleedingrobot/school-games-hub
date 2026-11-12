/**
 * Every line Parrot’s See-saw can read aloud, so each one can have a recorded clip (public/voice/parrot/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to the
 * browser's own voice. No line says the answer to a go before the child has tapped it.
 *
 * The voice fades with the help level (docs/plans/maths-review/new-games/N2-balance.md): levels 5 and 4 (stones) say the
 * same short instruction with no numbers; levels 3 to 1 read the equation ("Eight is the same as five plus how many?");
 * level 0 asks only "What number is missing?". "Hear it again" always reads the equation. A right answer is followed by
 * one short sentence ("Eight is five plus three.").
 *
 * A text with more than one line (home, finish, why) is joined with a newline; the game says the parts one after another,
 * so each part has its own clip.
 */
import { FRIEND_NAMES, STEPS } from '../../../shared/parrot/config';
import { METALS } from '../../../shared/parrot/progress';
import { ALL_KEYS, isStoneGo, MAX_STONES, kindOfKey, showGo, type Go, type ParrotKind } from '../../../shared/parrot/round';
import { demoLines } from './demo';
import { nextPartWords } from '../../components/NextPartChip';
import { numWord, WORDS } from './words';
import { WEAR_ME_LINE } from '../../kit/WhatsNext';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/parrot/';

/** The separator between the parts of a longer text. */
export const PART_BREAK = '\n';

const SAID: Record<string, string> = { '=': 'is the same as', '+': 'plus', '−': 'take away', '?': 'how many' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** An equation as words: ["8", "=", "5", "+", "?"] is "eight is the same as five plus how many". */
export const sayParts = (parts: readonly string[]): string => parts.map((t) => (/^\d+$/.test(t) ? numWord(Number(t)) : SAID[t] ?? t)).join(' ');

type Said = Pick<Go, 'kind' | 'parts' | 'answer' | 'lg' | 'rg' | 'l'>;

/** The equation read aloud: levels 3 to 1, and "Hear it again". A true or false go adds the question. */
export function eqLine(go: Said): string {
  if (go.kind !== 'tf') return `${cap(sayParts(go.parts))}?`;
  const at = go.parts.indexOf('=');
  return `${cap(sayParts(go.parts.slice(0, at)))}. ${cap(sayParts(go.parts.slice(at + 1)))}. ${WORDS.promptTilt}`;
}

/** Level 0: the child reads the equation. */
export const shortLine = (go: Pick<Go, 'kind'>): string => (go.kind === 'tf' ? WORDS.promptTilt : WORDS.promptMissing);

/** What Bella says as a go starts, by its planned help level. Levels 5 and 4 (the stones) have no numbers. */
export function askLine(go: Said & Pick<Go, 'l'>): string {
  if (isStoneGo(go)) return go.l >= 5 ? WORDS.stoneLive : WORDS.stoneCheck;
  return go.l >= 1 ? eqLine(go) : shortLine(go);
}

const sum = (xs: readonly number[]) => xs.reduce((s, n) => s + n, 0);

/** After a right answer: "Eight is five plus three." Never before the child has tapped. */
export function modelLine(go: Said): string {
  if (go.kind === 'tf') {
    const [a, b, c, d] = go.parts.filter((p) => /^\d+$/.test(p)).map(Number);
    const [l, r] = [sum(go.lg), sum(go.rg)];
    const tip = l === r ? 'It is level.' : l > r ? 'It tips left.' : 'It tips right.';
    return `${cap(numWord(a))} plus ${numWord(b)} is ${numWord(l)}. ${cap(numWord(c))} plus ${numWord(d)} is ${numWord(r)}. ${tip}`;
  }
  if (go.kind === 'miss') return `${cap(numWord(go.lg[0]))} is ${numWord(go.rg[0])} plus ${numWord(go.answer)}.`;
  return `${cap(sayParts(go.parts.map((p) => (p === '?' ? String(go.answer) : p))))}.`;
}

/** Why a wrong card or count is wrong, then Bella's "Is it level yet?". */
export const whyLine = (kind: ParrotKind): string => [WORDS.why(kind), WORDS.isLevel].join(PART_BREAK);

/**
 * "Let's look together" after a second wrong tap, step by step and slowly (each step waits for Bella to finish): this side has
 * so many stones, this side has so many, the heavier side goes down, then the stones go on (or come off) one at a time with
 * Bella counting "One. Two. Three.", and last "Now it is level." with the go's sentence ("Eight is five plus three.").
 * A true or false go counts each side, then says which way it goes.
 */
export interface LookScript {
  /** Said after "Let's look together.", before the steps. */
  fill: string;
  /** One line per step. */
  lines: string[];
  /** How many steps come before the counting (the sides and the tip); the count is the steps after them. */
  before: number;
  /** Said once the count is over (none for true or false). */
  end?: string;
}

export function lookScript(go: Said & Pick<Go, 'gs'>): LookScript {
  const [l, r] = [sum(go.lg), sum(go.rg)];
  const sides = [WORDS.sideHas(l), WORDS.sideHas(r), l === r ? WORDS.bothSame : WORDS.heavierDown];
  if (go.kind === 'tf') return { fill: WORDS.lookFill, lines: sides, before: 3 };
  const count = Array.from({ length: go.answer }, (_, i) => WORDS.countWord(i + 1));
  const action = go.answer > 0 ? [go.gs === -1 ? WORDS.takeOnes : WORDS.addOnes] : [];
  return { fill: WORDS.lookFill, lines: [...sides, ...action, ...count], before: 3 + action.length, end: [WORDS.nowLevel, modelLine(go)].join(PART_BREAK) };
}

/** What the home screen says: who wants the see-saw level, and "come back tomorrow" once today's shiny thing has turned. */
export const homeLine = (title: string, doneToday: boolean): string => (doneToday ? [title, WORDS.doneToday].join(PART_BREAK) : title);

/** What the finish screen says: what happened, how the round went, then what changes next time. */
export const finishLine = (main: string, how: string, next: string): string => [main, how, next].join(PART_BREAK);

const layoutsOf = (key: string): number => { const k = kindOfKey(key); return k === 'miss' ? 4 : k === 'swap' ? 2 : 1; };

/** Every go the game can make, once each (the words do not depend on the seed). */
function* everyGo(): Generator<Go> {
  for (const key of ALL_KEYS) {
    for (let v = 0; v < layoutsOf(key); v++) {
      let go: Go | null = null;
      for (let seed = 1; seed < 60 && !go; seed++) go = showGo({ seed }, 0, { key, v: v as 0 | 1 | 2 | 3, l: 3 });
      if (!go) throw new Error(`No go for ${key} layout ${v}`);
      yield go;
    }
  }
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([
    WORDS.lookTogether, WORDS.lookFill, WORDS.nowTry, WORDS.isLevel, WORDS.stoneLive, WORDS.stoneCheck, WORDS.promptMissing, WORDS.promptTilt,
    nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true), WORDS.doneToday, ...WORDS.tip,
  ]);
  const names = Object.entries(FRIEND_NAMES);
  for (const [id, name] of names) {
    lines.add(WORDS.wants(name));
    if (id !== 'parrot') lines.add(WORDS.nextFriend(name));
  }
  for (const kind of ['all', 'copy', 'total', 'off1', 'dbl', 'near', 'both', 'first', 'side', 'more', 'less'] as const) lines.add(WORDS.why(kind));
  for (const go of everyGo()) {
    lines.add(eqLine(go));
    lines.add(modelLine(go));
  }
  for (let n = 0; n <= MAX_STONES; n++) lines.add(WORDS.sideHas(n));
  for (let n = 1; n <= MAX_STONES; n++) lines.add(WORDS.countWord(n));
  lines.add(WORDS.heavierDown);
  lines.add(WORDS.bothSame);
  lines.add(WORDS.addOnes);
  lines.add(WORDS.takeOnes);
  lines.add(WORDS.nowLevel);
  const mains = [...METALS.slice(1).map((m) => WORDS.thingTurned(m)), ...names.map(([, name]) => WORDS.goldenBell(name))];
  for (const main of mains) lines.add(main);
  for (const s of STEPS.slice(1)) lines.add(WORDS.nextStep(s.step));
  for (const how of Object.values(WORDS.how)) lines.add(how);
  lines.add(WORDS.lessHelp);
  lines.add(WORDS.moreHelp);
  lines.add(WORDS.sameAgain);
  for (const line of demoLines()) lines.add(line);
  // The friend on a golden-prize day: its picture can now be worn on the profile (card P9).
  lines.add(WEAR_ME_LINE);
  return [...lines];
}
