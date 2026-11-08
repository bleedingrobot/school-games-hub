/**
 * Every line Pipi's Hidden Shells can read aloud, so each one can have a recorded clip in Bella's voice
 * (public/voice/pipi/<slug>.mp3, made with Kokoro by scripts/voice-clips.py, the same as Kiwi's Beanstalk).
 * A line without a clip falls back to the browser's own voice.
 */
import { beachAfter, DAYS_PER_PEARL, METALS } from '../../../shared/pipi/progress';
import { GUIDED_KEY, LEVELS, showGo, type Kind, type WrongKind } from '../../../shared/pipi/round';
import { FRIEND_NAMES } from './art';
import { demoLines } from './demo';
import { lookLine, whyLine, WORDS } from './words';
import { nextPartWords } from '../../components/NextPartChip';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/pipi/';

/** What the home screen says: the beach's call, and "come back tomorrow" once today's shell has changed. */
export function homeLine(title: string, doneToday: boolean): string {
  return doneToday ? `${title} ${WORDS.doneToday}` : title;
}

/** False for a kind of wrong shell that can't turn up in this go because its number is the answer (or can't be a shell). */
function wrongPossible(go: { answer: number; showing: number; whole: number; hiding: number }, kind: WrongKind): boolean {
  const n = { shown: go.showing, before: go.showing, whole: go.whole, add: go.whole + go.showing, part: go.showing, off1: go.answer }[kind];
  return kind === 'off1' || n !== go.answer;
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>([WORDS.outlinesBack, WORDS.lookTogether, WORDS.nowTry, WORDS.doneToday, nextPartWords(WORDS.part, false), nextPartWords(WORDS.part, true)]);
  for (let p = 0; p < 6; p++) {
    const name = FRIEND_NAMES[beachAfter(p * DAYS_PER_PEARL).friend];
    for (const title of [WORDS.wants(name), WORDS.nextFriend(name)]) {
      lines.add(homeLine(title, false));
      lines.add(homeLine(title, true));
    }
    lines.add(WORDS.pearl(name));
  }
  // Every go's question, of every kind, for every split of 3 to 10.
  const kinds: Kind[] = ['hiding', 'altogether', 'twoTides'];
  for (let w = LEVELS[0].from; w <= LEVELS[LEVELS.length - 1].to; w++) {
    for (let s = 0; s <= w; s++) {
      for (const kind of kinds) {
        const go = showGo({ seed: 1 }, 0, { key: `part${w}:${s}`, kind });
        if (go) lines.add(`part${w}:${s}` === GUIDED_KEY && kind === 'hiding' ? `${go.spoken} ${WORDS.guideStart}` : go.spoken);
        if (go) lines.add(go.spoken);
        if (go) {
          // Mistakes that teach (maths review R5): why each kind of wrong shell this go can have is wrong, and the split said
          // out for "Let's look together". The numbers are the go's own, so the same numbers share a clip.
          const kindsFor: WrongKind[] = kind === 'hiding' ? ['shown', 'whole', 'off1'] : kind === 'twoTides' ? ['before', 'whole', 'off1'] : ['part', 'off1'];
          for (const wrong of kindsFor) if (wrongPossible(go, wrong)) lines.add(whyLine(wrong, kind, go.whole, go.showing, go.hiding));
          lines.add(lookLine(kind, go.whole, go.showing, go.hiding));
        }
      }
    }
  }
  for (const line of demoLines()) lines.add(line);
  for (let n = 0; n <= 10; n++) lines.add(WORDS.yes(n));
  for (const metal of METALS.slice(1)) lines.add(WORDS.shellTurned(metal));
  // A finish that also moves the child up a level says both.
  for (const level of [2, 3] as const) for (const metal of METALS.slice(1)) lines.add(`${WORDS.shellTurned(metal)} ${WORDS.levelUp(level)}`);
  return [...lines];
}
