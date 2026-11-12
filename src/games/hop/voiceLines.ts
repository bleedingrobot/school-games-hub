/**
 * Every line Hop's Glow-worm Pond can read aloud, so each one can have a recorded clip
 * (public/voice/hop/<slug>.mp3, made with Kokoro by scripts/voice-clips.py), in the same voice as Kiwi's Beanstalk.
 * A line without a clip falls back to the browser's own voice.
 */
import { METALS } from '../../../shared/hop/progress';
import { HOP_STEPS, showHop, type HopStep } from '../../../shared/hop/round';
import { EARLY_FACTS, parseSkip, SKIP_FROM_STEPS } from '../../../shared/maths/skillPacks/earlyFacts';
import { FRIEND_NAMES } from './art';
import { WORDS } from './words';
import { nextPartWords } from '../../components/NextPartChip';
import { WEAR_ME_LINE } from '../../kit/WhatsNext';

/** Relative to the page (like public/stockfish), so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/hop/';

/** The separator between the parts of a longer text: the game says the parts one after another, each from its own clip. */
export const PART_BREAK = '\n';

/** What the home screen says: who wants to cross, and "come back tomorrow" once today's pad has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? [title, WORDS.doneToday].join(PART_BREAK) : title;
}

/** A hop read aloud; the very first hop of the first challenge also says how to play. */
export function hopLine(spoken: string, guideStart: boolean): string {
  return guideStart ? `${spoken} ${WORDS.guideStart}` : spoken;
}

/**
 * What the finish screen says, part by part: the title (the opening for how the day went, then what turned; on a golden day the
 * prize, then the opening), the tricky-day chip, "next time we count in fives" when the child moved up a step, the signpost.
 */
export function finishLine(title: string[], tricky: boolean, stepUp: HopStep | null, signpost = false): string {
  const said = [...title];
  if (tricky) said.push(WORDS.trickyChip);
  if (stepUp) said.push(WORDS.stepUp(stepUp));
  if (signpost) said.push(WORDS.signpost);
  return said.join(PART_BREAK);
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.labelsBack, WORDS.lookTogether, WORDS.nowTry, ...WORDS.demoBack, ...WORDS.demoFrom, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (const name of Object.values(FRIEND_NAMES)) {
    // The home line is said in parts (the title, then "come back tomorrow"), so each part is a clip of its own.
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) lines.add(homeLine(title, false));
  }
  // Every hop the shared pack can make for a step's families (counting up, next and back, and on a gold day from a start off a
  // multiple), at every place the gap can be. Only up and next hops can come first. The why-lines that are the same for every
  // hop of a kind (maths review R5) come with them, and the ones that name a hop's numbers too.
  const families = [...HOP_STEPS.map((s) => s.family), ...SKIP_FROM_STEPS.map(({ step }) => `skip${step}o`)];
  for (const name of families) {
    for (const key of EARLY_FACTS.families[name].keys) {
      const answer = parseSkip(key)!.answer;
      for (const at of [1, 2, 3, 4]) {
        const hop = showHop({ seed: 1 }, 0, { key, answer, at });
        if (!hop) continue;
        lines.add(hopLine(hop.spoken, false));
        if (!key.includes(':back:')) lines.add(hopLine(hop.spoken, true));
        lines.add(WORDS.yes(answer));
        for (const kind of ['stay', 'far', 'way', 'step'] as const) lines.add(WORDS.why(kind, hop));
        // One more or less than the answer: "30, then 10 more is 40." (the same for a hop at any place of the gap), and the
        // whole row counted to the answer in "Let's look together".
        lines.add(WORDS.why('off1', hop));
        lines.add(WORDS.lookCount(hop, hop.terms.slice(0, hop.gap + 1)));
      }
    }
  }
  // The finish is said in parts, each from its own clip: the opening for the day, what turned (or the golden prize), the chip.
  for (const how of Object.values(WORDS.how)) lines.add(how);
  lines.add(WORDS.doneToday);
  lines.add(WORDS.trickyChip);
  lines.add(WORDS.signpost);
  for (const m of METALS.slice(1)) lines.add(WORDS.padTurned(m));
  for (const name of Object.values(FRIEND_NAMES)) lines.add(WORDS.jar(name));
  for (const s of HOP_STEPS.slice(1)) lines.add(WORDS.stepUp(s.step));
  // The friend on a golden-prize day: its picture can now be worn on the profile (card P9).
  lines.add(WEAR_ME_LINE);
  return [...lines];
}
