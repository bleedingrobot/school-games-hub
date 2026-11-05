/**
 * Bella reads Sky Isles' key lines aloud (James, 5 Nov 2026): Pip's lines, the question step's result, the tips and
 * the Sky Race words. Only lines that never change are read, each from a recorded clip (public/voice/isles/<slug>.mp3,
 * made with Kokoro by scripts/voice-clips.py, the same voice as Kiwi's Beanstalk). A line with numbers or names in it
 * (a classmate's island, "you have 340 coins") stays quiet rather than switching to the browser's robot voice.
 * The maths questions are not read: they come from the whole hub's question bank.
 */
import { useCallback, useEffect, useState } from 'react';
import { TURNS_PER_DAY, type PlotKind } from '../../../shared/isles/config';
import { buildLine, END_TURN_LINE, KIND_NAME, RACE_LINE, RESTING_LINE } from '../../../shared/isles/nextStep';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { celebration, chooseLine, GUIDE } from './guide';
import { TIPS } from './help';
import { RACE_WORDS, rivalWords } from './Race';
import { QUESTION_WORDS, STEP_PIP } from './TurnSteps';

/** Relative to the page, so it works at bleedingrobot.github.io/school-games-hub/ too. */
export const VOICE_FOLDER = 'voice/isles/';

/** Between turns a building step is for the next turn ("Next turn: build a Farm..."), as IslesPlay words it. */
export const nextTurnLine = (say: string) => `Next turn: ${say[0].toLowerCase()}${say.slice(1)}`;

/** The cheer after the guided first turn, as one line. */
export const cheerLine = (lines: string[]) => lines.join(' ');

export function allVoiceLines(): string[] {
  const lines = new Set<string>([...Object.values(STEP_PIP), ...Object.values(GUIDE), ...Object.values(QUESTION_WORDS), ...Object.values(TIPS)]);
  const kinds = Object.keys(KIND_NAME) as PlotKind[];
  for (const kind of kinds) {
    lines.add(chooseLine(kind));
    for (const one of [true, false]) {
      lines.add(buildLine(kind, one));
      lines.add(nextTurnLine(buildLine(kind, one)));
    }
  }
  for (const line of [RESTING_LINE, RACE_LINE, END_TURN_LINE]) lines.add(line);
  for (let left = 0; left <= TURNS_PER_DAY; left++) lines.add(cheerLine(celebration(left)));
  const { gust, noGust, ...fixed } = RACE_WORDS;
  for (const line of Object.values(fixed)) lines.add(line);
  for (const last of [false, true]) {
    lines.add(gust(last));
    lines.add(noGust(last));
  }
  lines.add(rivalWords(undefined).ready);
  return [...lines];
}

let recorded: Set<string> | null = null;
/** Is this one of the recorded lines? */
export function isRecorded(text: string): boolean {
  recorded ??= new Set(allVoiceLines());
  return recorded.has(text);
}

/** Sky Isles reads aloud unless it's turned off. Remembered on this device. */
const VOICE_KEY = 'isles-voice';

export function useIslesVoice() {
  const [on, setOnState] = useState(() => {
    try {
      return localStorage.getItem(VOICE_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const setOn = (value: boolean) => {
    setOnState(value);
    if (!value) stopSpeaking();
    try {
      localStorage.setItem(VOICE_KEY, value ? 'on' : 'off');
    } catch {
      // Storage blocked: it just won't be remembered.
    }
  };
  const say = useCallback((text: string | null | undefined) => {
    if (on && text && isRecorded(text)) speak(text, VOICE_FOLDER);
  }, [on]);
  // Nothing carries on talking once the game is closed.
  useEffect(() => () => stopSpeaking(), []);
  return { on, setOn, say, available: canReadAloud() };
}

export { Say } from './Say';
