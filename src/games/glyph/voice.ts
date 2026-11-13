/**
 * Bella reads Glyph Gates' key lines aloud (James, 5 Nov 2026): only the lines in voiceLines.ts, each from a recorded clip
 * (public/voice/glyph/<slug>.mp3). A line with this wall's fractions in it stays quiet rather than switching to the
 * browser's voice. On unless turned off; remembered on this device (the same Voice on / Voice off button as Sky Isles).
 */
import { useCallback, useEffect, useState } from 'react';
import { canReadAloud, speak, stopSpeaking } from '../../speech';
import { isRecorded, VOICE_FOLDER } from './voiceLines';

/** Says a line if the voice is on and the line has a clip; `onEnd` runs when it has been said. */
export type Say = (text: string | null | undefined, onEnd?: () => void) => void;

const VOICE_KEY = 'glyph-voice';

export function useGlyphVoice() {
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
