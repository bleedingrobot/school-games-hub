/**
 * Every line Penguin Pairs can read aloud, so each one can have a recorded clip (public/voice/korora/<slug>.mp3, made
 * with Kokoro by scripts/voice-clips.py), in Bella's voice like every early game. A line without a clip falls back to
 * the browser's own voice. No line ever says the answer to the go it is read for.
 */
import { METALS, type Metal } from '../../../shared/korora/progress';
import { LEVELS, levelKeys, parseKey, spokenFor, fairKeys, type Go, type Level } from '../../../shared/korora/round';
import { FRIEND_NAMES } from './art';
import { WORDS } from './words';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/korora/';

/** What the home screen says: who wants dancing shoes, and "come back tomorrow" once today's stepping stone has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? `${title} ${WORDS.doneToday}` : title;
}

/** A go read aloud: the very first also says how to play, and a half straight after its double says the double first. */
export function goLine(go: Pick<Go, 'kind' | 'n'>, guided: boolean, afterDouble: boolean): string {
  if (afterDouble && go.kind === 'half') return WORDS.afterDouble(go.n / 2);
  return spokenFor(go.kind, go.n, guided);
}

/** What the finish screen says, with "next time: halves to 10" when the child moved up a level. */
export function finishLine(main: string, levelUp: Level | null): string {
  return levelUp ? `${main} ${WORDS.levelUp(levelUp)}` : main;
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.tryAgain, WORDS.countWithMe, WORDS.fairYes, WORDS.notFairYes]);
  for (const name of Object.values(FRIEND_NAMES)) {
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
  }
  const keys = [...new Set([...LEVELS.flatMap((l) => levelKeys(l.level)), ...fairKeys(1), ...fairKeys(3)])];
  for (const key of keys) {
    const fact = parseKey(key)!;
    lines.add(goLine(fact, false, false));
    if (key === 'dbl:2') lines.add(goLine(fact, true, false));
    if (fact.kind === 'half' && fact.n <= 20) lines.add(goLine(fact, false, true));
    if (fact.kind !== 'fair') lines.add(WORDS.yes(fact.kind === 'double' ? 2 * fact.n : fact.n / 2));
  }
  // Bella counts along with the child: up to 20 fish.
  for (let n = 1; n <= 20; n++) lines.add(WORDS.yes(n));
  const shoes = (['bronze', 'silver', 'gold'] as const).flatMap((m) => Object.values(FRIEND_NAMES).map((name) => WORDS.shoesWon(m, name)));
  const mains = [WORDS.doneToday, ...METALS.slice(1).map((m: Metal) => WORDS.pebbleTurned(m)), ...shoes];
  for (const main of mains) for (const up of [null, 2, 3, 4] as const) lines.add(finishLine(main, up));
  return [...lines];
}
