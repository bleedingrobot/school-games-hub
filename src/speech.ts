/**
 * Read-aloud for students who can't read yet. A game can give a folder of recorded clips (made with
 * Kokoro, see scripts/quick-looks-voice.py), named by voiceSlug(text); a line with no clip, or a clip
 * that won't play, uses the browser's own voice instead. Nothing is sent anywhere. Off until the student turns it on; the choice is remembered on this device only,
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

const canPlayClips = (): boolean => typeof Audio !== 'undefined' && typeof window !== 'undefined';

/** "Yes! 5: 3 and 2." → "yes-5-3-and-2", the clip's file name. */
export function voiceSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

let clip: HTMLAudioElement | null = null;

function browserVoice(text: string): void {
  if (!canSpeak()) return;
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

/**
 * Says it now, stopping anything still being said. With a clip folder, plays `<folder><slug>.mp3`
 * and only falls back to the browser's voice if that clip can't play. Does nothing where there is no voice.
 */
export function speak(text: string, clipFolder?: string): void {
  if (!text) return;
  stopSpeaking();
  if (!clipFolder || !canPlayClips()) {
    browserVoice(text);
    return;
  }
  try {
    const audio = new Audio(`${clipFolder}${voiceSlug(text)}.mp3`);
    clip = audio;
    let fellBack = false;
    const fallBack = () => {
      if (fellBack || clip !== audio) return; // already handled, or something newer is being said
      fellBack = true;
      clip = null;
      browserVoice(text);
    };
    audio.addEventListener('error', fallBack);
    const playing = audio.play();
    if (playing && typeof playing.catch === 'function') playing.catch(fallBack);
  } catch {
    browserVoice(text);
  }
}

export function stopSpeaking(): void {
  if (clip) {
    try {
      clip.pause();
    } catch {
      // Already stopped.
    }
    clip = null;
  }
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
  return { on, setOn, available: canSpeak() || canPlayClips() };
}
