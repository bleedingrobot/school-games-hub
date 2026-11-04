/**
 * Every line Hop's Glow-worm Pond can read aloud, so each one can have a recorded clip
 * (public/voice/hop/<slug>.mp3, made with Kokoro by scripts/voice-clips.py), in the same voice as Kiwi's Beanstalk.
 * A line without a clip falls back to the browser's own voice.
 */
import { METALS, type Metal } from '../../../shared/hop/progress';
import { showHop, STEPS } from '../../../shared/hop/round';
import { EARLY_FACTS, type SkipStep } from '../../../shared/maths/skillPacks/earlyFacts';
import { FRIEND_NAMES } from './art';
import { WORDS } from './words';

/** Relative to the page (like public/stockfish), so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/hop/';

/** What the home screen says: who wants to cross, and "come back tomorrow" once today's pad has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? `${title} ${WORDS.doneToday}` : title;
}

/** A hop read aloud; the very first hop of the first challenge also says how to play. */
export function hopLine(spoken: string, guideStart: boolean): string {
  return guideStart ? `${spoken} ${WORDS.guideStart}` : spoken;
}

/** What the finish screen says, with "next time we count in fives" when the child moved up a step. */
export function finishLine(main: string, stepUp: SkipStep | null): string {
  return stepUp ? `${main} ${WORDS.stepUp(stepUp)}` : main;
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.tryAgain]);
  for (const name of Object.values(FRIEND_NAMES)) {
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
  }
  // Every hop the shared pack can make, at every place the gap can be. Only up and next hops can come first.
  for (const step of STEPS) {
    for (const key of EARLY_FACTS.families[`skip${step}`].keys) {
      const answer = Number(key.split(':')[2]);
      for (const at of [1, 2, 3, 4]) {
        const hop = showHop({ seed: 1 }, 0, { key, answer, at });
        if (!hop) continue;
        lines.add(hopLine(hop.spoken, false));
        if (!key.includes(':back:')) lines.add(hopLine(hop.spoken, true));
        lines.add(WORDS.yes(answer));
      }
    }
  }
  const mains = [WORDS.doneToday, ...METALS.slice(1).map((m: Metal) => WORDS.padTurned(m)), ...Object.values(FRIEND_NAMES).map(WORDS.jar)];
  for (const main of mains) for (const up of [null, 5, 2] as const) lines.add(finishLine(main, up));
  return [...lines];
}
