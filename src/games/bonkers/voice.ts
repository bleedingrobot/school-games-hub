import { useCallback, useEffect } from 'react';
import { useSound } from '../../sound';
import { readSaved, speak, stopSpeaking } from '../../speech';

/** Bella's clips (public/voice/bonkers/), relative to the page so it works under the site's sub-path too. */
export const VOICE_FOLDER = 'voice/bonkers/';

/** Bella reads Granny Jetpack aloud (Years 2 to 4) unless the speaker button is off. Sound off means no voice. */
export const VOICE_ON_BY_DEFAULT = true;

/**
 * Says a line from its clip, stopping whatever was being said. Checks the saved voice choice at the moment of speaking,
 * so the speaker button counts straight away. Speech stops when the screen goes. Copied from Bond Match.
 */
export function useBella(): (line: string) => void {
  const { soundOn } = useSound();
  useEffect(() => stopSpeaking, []);
  return useCallback((line: string) => {
    if (!soundOn || !readSaved(VOICE_ON_BY_DEFAULT) || !line) return;
    speak(line, VOICE_FOLDER);
  }, [soundOn]);
}
