/**
 * Read-aloud for students who can't read yet, using the browser's own voice (nothing is downloaded
 * or sent anywhere). Off until the student turns it on; the choice is remembered on this device only,
 * the same way the sound setting is. A page may never speak an answer before it has been given.
 */
import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sgh-read-aloud';

function readSaved(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Can this browser talk at all? */
export const canSpeak = (): boolean => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

/** Says it now, stopping anything still being said. Does nothing where there is no voice. */
export function speak(text: string): void {
  if (!canSpeak() || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-NZ';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch {
    // No voice on this device. That's fine.
  }
}

export function stopSpeaking(): void {
  try {
    if (canSpeak()) window.speechSynthesis.cancel();
  } catch {
    // Nothing to stop.
  }
}

/** The "Read to me" setting, shared by every screen that asks for it. */
export function useReadAloud() {
  const [on, setOnState] = useState(readSaved);
  const setOn = useCallback((value: boolean) => {
    setOnState(value);
    if (!value) stopSpeaking();
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Storage blocked: it just won't be remembered.
    }
  }, []);
  return { on, setOn, available: canSpeak() };
}
