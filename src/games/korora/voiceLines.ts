/**
 * Every line Penguin Pairs can read aloud, so each one can have a recorded clip (public/voice/korora/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to
 * the browser's own voice. No line ever says the answer to the go it is read for.
 */
import { METALS } from '../../../shared/korora/progress';
import { LEVELS, levelKeys, parseKey, spokenFor, fairKeys, type Go, type Level, type WrongKind } from '../../../shared/korora/round';
import { FRIEND_NAMES } from './art';
import { demoLines } from './demo';
import { WORDS } from './words';
import { nextPartWords } from '../../components/NextPartChip';
import { WEAR_ME_LINE } from '../../kit/WhatsNext';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/korora/';

/** The separator between the parts of a longer text: the game says the parts one after another, each from its own clip. */
export const PART_BREAK = '\n';

/** What the home screen says: who wants dancing shoes, and "come back tomorrow" once today's stepping stone has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? [title, WORDS.doneToday].join(PART_BREAK) : title;
}

/** A go read aloud: the very first also says how to play, and a half straight after its double says the double first. */
export function goLine(go: Pick<Go, 'kind' | 'n'>, guided: boolean, afterDouble: boolean): string {
  if (afterDouble && go.kind === 'half') return WORDS.afterDouble(go.n / 2);
  return spokenFor(go.kind, go.n, guided);
}

/** Why a wrong stone is wrong, by its kind (maths review R5). The lines name the fact, never the wrong number. */
export function whyLine(go: Pick<Go, 'kind' | 'n'>, kind: WrongKind): string {
  const w = WORDS.why;
  switch (kind) {
    case 'same': return w.same(go.n);
    case 'plus1': return w.plus1;
    case 'plus2': return w.plus2(go.n);
    case 'all': return w.all;
    case 'minus2': return w.minus2;
    case 'double': return w.double;
    case 'noExtra': return w.noExtra;
    case 'bigger': return w.bigger;
    case 'miscount': return go.kind === 'half' ? w.miscountHalf : w.miscountDouble;
  }
}

/**
 * What the finish screen says, part by part: the title (the opening for how the day went, then what turned; on a shoes day the
 * prize, then the opening), the tricky-day chip, and "next time: halves to 10" when the child moved up a level.
 */
export function finishLine(title: string[], tricky: boolean, levelUp: Level | null): string {
  const said = [...title];
  if (tricky) said.push(WORDS.trickyChip);
  if (levelUp) said.push(WORDS.levelUp(levelUp));
  return said.join(PART_BREAK);
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.picturesBack, WORDS.tryAgain, WORDS.lookTogether, WORDS.nowTry, WORDS.pairOff, WORDS.countOneBowl, WORDS.whatsNext, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (const name of Object.values(FRIEND_NAMES)) {
    // The home line is said in parts (the title, then "come back tomorrow"), so each part is a clip of its own.
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) lines.add(homeLine(title, false));
  }
  const keys = [...new Set([...LEVELS.flatMap((l) => levelKeys(l.level)), ...fairKeys(1), ...fairKeys(3), ...fairKeys(5)])];
  for (const key of keys) {
    const fact = parseKey(key)!;
    lines.add(goLine(fact, false, false));
    if (key === 'dbl:2') lines.add(goLine(fact, true, false));
    if (fact.kind === 'half' && fact.n <= 20) lines.add(goLine(fact, false, true));
    if (fact.kind === 'fair') lines.add(fact.n % 2 === 0 ? WORDS.fairYes(fact.n / 2) : WORDS.oddYes((fact.n - 1) / 2));
    else lines.add(WORDS.yes(fact.kind === 'double' ? 2 * fact.n : fact.kind === 'near' ? 2 * fact.n + 1 : fact.n / 2));
    if (fact.kind === 'near') {
      lines.add(WORDS.lookNear(fact.n));
      lines.add(WORDS.nearMirror(fact.n));
    }
  }
  // Mistakes that teach (maths review R5): why a wrong stone is wrong, and the whole go explained after a second wrong tap.
  // The why-lines name the fact (n of 1 to 10 for doubles), never the wrong number; plus2 starts at 3 (a double of 1 or 2 is not n + 2).
  for (let n = 1; n <= 10; n++) {
    lines.add(WORDS.why.same(n));
    if (n >= 3) lines.add(WORDS.why.plus2(n));
    lines.add(WORDS.lookDouble(n));
    lines.add(WORDS.lookHalf(2 * n));
  }
  for (const line of [WORDS.why.noExtra, WORDS.why.bigger, WORDS.why.plus1, WORDS.why.miscountDouble, WORDS.why.all, WORDS.why.miscountHalf, WORDS.why.minus2, WORDS.why.double]) lines.add(line);
  // Bella counts along with the child: up to 20 fish.
  for (let n = 1; n <= 20; n++) lines.add(WORDS.yes(n));
  for (const line of demoLines()) lines.add(line);
  const shoes = (['bronze', 'silver', 'gold'] as const).flatMap((m) => Object.values(FRIEND_NAMES).map((name) => WORDS.shoesWon(m, name)));
  // The finish is said in parts, each from its own clip: the opening for the day, what turned (or the prize), the chip.
  for (const how of Object.values(WORDS.how)) lines.add(how);
  lines.add(WORDS.doneToday);
  lines.add(WORDS.trickyChip);
  for (const m of METALS.slice(1)) lines.add(WORDS.pebbleTurned(m));
  for (const line of shoes) lines.add(line);
  for (const up of [2, 3, 4] as const) lines.add(WORDS.levelUp(up));
  // The friend on a golden-prize day: its picture can now be worn on the profile (card P9).
  lines.add(WEAR_ME_LINE);
  return [...lines];
}
