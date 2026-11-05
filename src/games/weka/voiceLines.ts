/**
 * Every line Weka's Stepping Stones can read aloud, so each one can have a recorded clip (public/voice/weka/<slug>.mp3,
 * made with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back
 * to the browser's own voice. No line ever says the answer to the go it is read for.
 */
import { METALS, type Metal } from '../../../shared/weka/progress';
import { ALL_KEYS, askLine, BOND_MORE, bondAskLine, bondLine, fromTenLine, parseKey, stemLine, toTenLine, type Go, type Help, type Kind, type Level } from '../../../shared/weka/round';
import { FRIEND_NAMES } from './art';
import { WORDS } from './words';
import { nextPartWords } from '../../components/NextPartChip';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/weka/';

/** What the home screen says: who wants to cross, and "come back tomorrow" once today's stone has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? `${title} ${WORDS.doneToday}` : title;
}

/** What Bella says for a right answer: with help, the te reo number and the make-ten sentence; with none, the number. */
export function rightLine(go: Pick<Go, 'kind' | 'answer' | 'rest'>, help: Help): string {
  if (help === 'none') return WORDS.yes(go.answer);
  return go.kind === 'back' ? WORDS.rightBack(go.answer, go.rest) : WORDS.rightAdd(go.answer, go.rest);
}

/** What the finish screen says, with "next time: starting on 8" when the child moved up a level. */
export function finishLine(main: string, levelUp: Level | null): string {
  return levelUp ? `${main} ${WORDS.levelUp(levelUp)}` : main;
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.tryAgain, WORDS.countWithMe, BOND_MORE, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
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
      for (const line of [askLine(go), toTenLine(go), stemLine(go), fromTenLine(go), bondAskLine(go), bondLine(go, true), rightLine({ ...go, answer: kind === 'back' ? big : total }, 'full')]) lines.add(line);
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
