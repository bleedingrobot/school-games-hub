/**
 * Bella reads Star Web’s fixed lines aloud: only the lines in voiceLines.ts, each from a recorded clip
 * (public/voice/starweb/<slug>.mp3). A line with a sky’s own numbers in it stays quiet rather than switching to the
 * browser's voice. On unless turned off; remembered on this device (the same Voice on / Voice off button as Sky Isles).
 */
import { useCallback, useEffect, useState } from 'react';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { isRecorded, VOICE_FOLDER } from './voiceLines';

/** Says a line if the voice is on and the line has a clip; `onEnd` runs when it has been said. */
export type Say = (text: string | null | undefined, onEnd?: () => void) => void;

const VOICE_KEY = 'starweb-voice';

export function useStarWebVoice() {
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
  const say = useCallback<Say>((text, onEnd) => {
    if (on && text && isRecorded(text)) speak(text, VOICE_FOLDER, onEnd);
  }, [on]);
  // Nothing carries on talking once the game is closed.
  useEffect(() => () => stopSpeaking(), []);
  return { on, setOn, say, available: canReadAloud() };
}
