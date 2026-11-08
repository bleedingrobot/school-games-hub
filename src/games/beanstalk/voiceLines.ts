/**
 * Every line Kiwi's Beanstalk can read aloud, so each one can have a recorded clip
 * (public/voice/beanstalk/<slug>.mp3, made with Kokoro by scripts/voice-clips.py).
 * A line without a clip falls back to the browser's own voice.
 */
import { FRIENDS, METALS } from '../../../shared/beanstalk/progress';
import { TARGETS, type Target } from '../../../shared/beanstalk/round';
import { FRIEND_NAMES } from './art';
import { demoLines } from './demo';
import { WORDS } from './words';
import { nextPartWords } from '../../components/NextPartChip';

/** Relative to the page (like public/stockfish), so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/beanstalk/';

/** What the home screen says: who is stuck, and "come back tomorrow" once today's leaf has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? `${title} ${WORDS.doneToday}` : title;
}

/** The numbers a leaf can show on a beanstalk: 1 to 9 in ones, tens or hundreds, or 1 to 19 (not 10) on the bonds to 20. */
export const leafNumbers = (target: Target): number[] =>
  target === 20 ? Array.from({ length: 19 }, (_, i) => i + 1).filter((n) => n !== 10) : Array.from({ length: 9 }, (_, i) => (i + 1) * (target / 10));

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.whoAreYou, WORDS.guideNext, WORDS.dotsBack, WORDS.lookTogether, WORDS.doneToday, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  lines.add(WORDS.nextTitle);
  // Any friend can be stuck on any sum now (the sum follows the child, S21), and a child can move up or back between sums.
  for (const friend of FRIENDS) {
    const name = FRIEND_NAMES[friend];
    for (const title of [WORDS.nextFriend(name), ...TARGETS.map((t) => WORDS.stuck(name, t))]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
    lines.add(WORDS.egg(name));
  }
  for (const target of TARGETS) {
    lines.add(WORDS.tapTwo(target));
    lines.add(WORDS.guideStart(target));
    lines.add(WORDS.nowThese(target));
    lines.add(WORDS.missingTip(target));
    lines.add(WORDS.movedUp(target));
    lines.add(WORDS.movedBack(target));
    const numbers = leafNumbers(target);
    for (const a of numbers) lines.add(WORDS.right(a, target - a));
    if (target === 20) for (const a of numbers) lines.add(WORDS.bridge20(a, target - a));
    else if (target > 10) for (const a of numbers) lines.add(WORDS.bridge(target, a, target - a));
    // Mistakes that teach (maths review R5): why every wrong pair of two different numbers is wrong (no number floats
    // twice but the 5s of 5 + 5), and the "Let's look together" lines for every leaf. The missing leaf (R8): what is asked
    // for each leaf, and the take-away said after it.
    for (const a of numbers) {
      for (const b of numbers) if (a < b && a + b !== target) lines.add(WORDS.why(a, b, target));
      lines.add(WORDS.fillUp(a, target));
      lines.add(WORDS.nowTry(a));
      lines.add(WORDS.missingAsk(a, target));
      lines.add(WORDS.takeAway(a, target));
    }
  }
  for (const line of demoLines()) lines.add(line);
  for (const metal of METALS.slice(1)) lines.add(WORDS.leafTurned(metal));
  return [...lines];
}
