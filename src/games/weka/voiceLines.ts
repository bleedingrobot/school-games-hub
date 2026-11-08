/**
 * Every line Weka's Stepping Stones can read aloud, so each one can have a recorded clip (public/voice/weka/<slug>.mp3,
 * made with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back
 * to the browser's own voice. No line ever says the answer to the go it is read for.
 */
import { METALS, type Metal } from '../../../shared/weka/progress';
import { ALL_KEYS, askLine, BOND_MORE, bondAskLine, bondLine, fromTenLine, parseKey, pebbleAskLine, pebbleFewLine, pebbleManyLine, pebbleRightLine, pebbleShowLine, splitFirstLine, splitRestLine, stemLine, toTenChoicesFor, toTenLine, type Go, type Help, type Kind, type Level, type LandKind, type ToTenKind } from '../../../shared/weka/round';
import { FRIEND_NAMES } from './art';
import { WORDS } from './words';
import { nextPartWords } from '../../components/NextPartChip';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/weka/';

/** What the home screen says: who wants to cross, and "come back tomorrow" once today's stone has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? `${title} ${WORDS.doneToday}` : title;
}

/** What Bella says for a right answer: with help, the number and the make-ten sentence; with none, the number. */
export function rightLine(go: Pick<Go, 'kind' | 'answer' | 'rest'>, help: Help): string {
  if (help === 'none') return WORDS.yes(go.answer);
  return go.kind === 'back' ? WORDS.rightBack(go.answer, go.rest) : WORDS.rightAdd(go.answer, go.rest);
}

/**
 * What Bella says when a wrong first tap has a mistake behind it (maths review R5): why that number is not it. None says
 * the answer: they say the leftover hops, the split, or ask for a count.
 */
export function whyLine(go: Pick<Go, 'kind' | 'small' | 'big' | 'from' | 'toTen' | 'rest'>, kind: LandKind | ToTenKind): string {
  switch (kind) {
    case 'rock': return go.kind === 'back' ? WORDS.whyRockBack(go.rest) : WORDS.whyRockAdd(go.rest);
    case 'double': return WORDS.whyDouble(go.small, go.toTen, go.rest);
    case 'part': return WORDS.whyPart(go.big, go.toTen, go.rest);
    case 'off1': return WORDS.whyOff1(go.small);
    case 'add': return WORDS.whyAdd;
    case 'other': return WORDS.whyOther(go.from);
    case 'ten': return WORDS.whyTen;
    case 'near': return WORDS.whyNear(go.from);
  }
}

/**
 * A wrong number in the split (`bond` 0 is the part that gets to ten, 1 is the rest): what the number the child tapped
 * makes. None says the answer.
 */
export function splitWhyLine(go: Pick<Go, 'kind' | 'small' | 'big' | 'total' | 'toTen'>, bond: 0 | 1, n: number): string {
  if (bond === 1) return WORDS.whySplitRest(go.toTen, n, go.small);
  return go.kind === 'back' ? WORDS.whySplitFirstBack(go.total, n) : WORDS.whySplitFirstAdd(go.big, n);
}

/** What the finish screen says, with "next time: starting on 8" when the child moved up a level. */
export function finishLine(main: string, levelUp: Level | null): string {
  return levelUp ? `${main} ${WORDS.levelUp(levelUp)}` : main;
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.tryAgain, WORDS.countWithMe, WORDS.lookTogether, WORDS.nowTry, WORDS.whyAdd, WORDS.whyTen, BOND_MORE, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (const name of Object.values(FRIEND_NAMES)) {
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
  }
  for (const key of ALL_KEYS) {
    const { small, big } = parseKey(key)!;
    const total = small + big;
    for (const kind of ['add', 'turn', 'back'] as Kind[]) {
      const toTen = kind === 'back' ? total - 10 : 10 - big;
      const go = { kind, small, big, total, toTen, rest: small - toTen };
      for (const line of [askLine(go), toTenLine(go), stemLine(go), fromTenLine(go), bondAskLine(go), bondLine(go, true), rightLine({ ...go, answer: kind === 'back' ? big : total }, 'full'), splitFirstLine(go), splitRestLine(go)]) lines.add(line);
      // Why a wrong first tap is wrong: every mistake this go can have (round.ts landingWrongs and toTenWrongsFor).
      const mine = { ...go, from: kind === 'back' ? total : big };
      const kinds: (LandKind | ToTenKind)[] = ['rock', 'off1', 'other', 'near'];
      if (kind === 'back') kinds.push('add');
      else kinds.push('double', ...(big + go.rest !== 10 ? (['part'] as const) : []));
      for (const k of kinds) lines.add(whyLine(mine, k));
      // A wrong number in the split: every number the choices can offer except the right one.
      for (const n of toTenChoicesFor(go.toTen)) if (n !== go.toTen) lines.add(splitWhyLine(go, 0, n));
      for (const n of toTenChoicesFor(go.rest)) if (n !== go.rest) lines.add(splitWhyLine(go, 1, n));
      // The pebbles: adding goes only.
      if (kind !== 'back') {
        for (const line of [pebbleAskLine(go), pebbleRightLine(go), pebbleShowLine(go)]) lines.add(line);
        for (let n = 1; n < go.toTen; n++) lines.add(pebbleFewLine(n));
        for (let n = 1; n <= go.rest; n++) lines.add(pebbleManyLine(n));
      }
    }
  }
  // The guided first go: 9 + 2, both steps.
  const first = { kind: 'add' as const, small: 2, big: 9, total: 11, toTen: 1, rest: 1 };
  lines.add(toTenLine(first, true));
  lines.add(askLine(first, true));
  // Bella counts hops and says each answer: 1 to 20.
  for (let n = 1; n <= 20; n++) lines.add(WORDS.yes(n));
  const mains = [WORDS.doneToday, ...METALS.slice(1).map((m: Metal) => WORDS.stoneTurned(m)), ...Object.values(FRIEND_NAMES).map(WORDS.goldenBasket)];
  for (const main of mains) for (const up of [null, 2, 3, 4] as const) lines.add(finishLine(main, up));
  return [...lines];
}
