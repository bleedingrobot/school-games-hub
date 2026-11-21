import { useCallback, useEffect } from 'react';
import { useSound } from '../../sound';
import { readSaved, speak, stopSpeaking } from '../../speech';
import { VOICE_FOLDER } from './voiceLines';

/** Bella reads Bond Match aloud unless the speaker button (or the hub's read-aloud choice) is off. Sound off means no voice. */
export const VOICE_ON_BY_DEFAULT = true;

/**
 * Says lines one after another, each from its own clip, stopping whatever was being said. Checks the saved voice choice at
 * the moment of speaking, so the speaker button on any screen counts straight away. Speech stops when the screen goes.
 */
export function useBella(): (lines: string[]) => void {
  const { soundOn } = useSound();
  useEffect(() => stopSpeaking, []);
  return useCallback((lines: string[]) => {
    if (!soundOn || !readSaved(VOICE_ON_BY_DEFAULT) || lines.length === 0) return;
    const from = (i: number): void => speak(lines[i], VOICE_FOLDER, i < lines.length - 1 ? () => from(i + 1) : undefined);
    from(0);
  }, [soundOn]);
}
