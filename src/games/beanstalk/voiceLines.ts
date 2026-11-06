/**
 * Every line Kiwi's Beanstalk can read aloud, so each one can have a recorded clip
 * (public/voice/beanstalk/<slug>.mp3, made with Kokoro by scripts/voice-clips.py).
 * A line without a clip falls back to the browser's own voice.
 */
import { DAYS_PER_EGG, METALS, stalkAfter } from '../../../shared/beanstalk/progress';
import { FRIEND_NAMES } from './art';
import { WORDS } from './words';
import { nextPartWords } from '../../components/NextPartChip';

/** Relative to the page (like public/stockfish), so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/beanstalk/';

/** What the home screen says: who is stuck, and "come back tomorrow" once today's leaf has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? `${title} ${WORDS.doneToday}` : title;
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.whoAreYou, WORDS.guideNext, WORDS.lookTogether, WORDS.doneToday, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  // Friends and sums go round together (6 friends, 3 sums), so one lap of 6 beanstalks has every pairing.
  for (let e = 0; e < 6; e++) {
    const { friend, target } = stalkAfter(e * DAYS_PER_EGG);
    const name = FRIEND_NAMES[friend];
    for (const title of [WORDS.stuck(name, target), WORDS.nextFriend(name, target)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
    lines.add(WORDS.egg(name));
    lines.add(WORDS.tapTwo(target));
    lines.add(WORDS.guideStart(target));
    const step = target / 10;
    for (let a = 1; a <= 9; a++) lines.add(WORDS.right(a * step, target - a * step));
    if (target > 10) for (let a = 1; a <= 9; a++) lines.add(WORDS.bridge(target, a * step, target - a * step));
    // Mistakes that teach (maths review R5): why every wrong pair of two different numbers is wrong (no number floats
    // twice but the 5s of 5 + 5), and the "Let's look together" lines for every leaf.
    for (let a = 1; a <= 9; a++) {
      for (let b = a + 1; b <= 9; b++) if (a + b !== 10) lines.add(WORDS.why(a * step, b * step, target));
      lines.add(WORDS.fillUp(a * step, target));
      lines.add(WORDS.nowTry(a * step));
    }
  }
  for (const metal of METALS.slice(1)) lines.add(WORDS.leafTurned(metal));
  return [...lines];
}
