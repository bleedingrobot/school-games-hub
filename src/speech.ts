/**
 * Read-aloud for students who can't read yet. A game can give a folder of recorded clips (made with
 * Kokoro, see scripts/voice-clips.py), named by voiceSlug(text); a line with no clip, or a clip
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
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Tūī → tui
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Can this device read aloud at all, with clips or its own voice? */
export const canReadAloud = (): boolean => canSpeak() || canPlayClips();

let clip: HTMLAudioElement | null = null;
/** Goes up each time something new is said or speech is stopped, so a line that was cut off never reports "finished". */
let turn = 0;

/** `onEnd` wrapped so it runs at most once, and only while this is still the line being said. */
function finisher(onEnd: (() => void) | undefined): () => void {
  if (!onEnd) return () => {};
  const mine = turn;
  let done = false;
  return () => {
    if (done || mine !== turn) return;
    done = true;
    onEnd();
  };
}

function browserVoice(text: string, finished: () => void): void {
  if (!canSpeak()) {
    finished(); // No voice at all: nothing to wait for.
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-NZ';
    u.rate = 0.9;
    u.onend = finished;
    u.onerror = finished;
    window.speechSynthesis.speak(u);
  } catch {
    // No voice on this device. That's fine.
    finished();
  }
}

/**
 * Says it now, stopping anything still being said. With a clip folder, plays `<folder><slug>.mp3`
 * and only falls back to the browser's voice if that clip can't play. Does nothing where there is no voice.
 * `onEnd` runs once when the line has finished (or failed, or there is no voice to say it), and never if it was
 * stopped or replaced by newer speech, so a game can start an answer clock after the question has been heard.
 */
export function speak(text: string, clipFolder?: string, onEnd?: () => void): void {
  stopSpeaking();
  const finished = finisher(onEnd);
  if (!text) {
    finished();
    return;
  }
  if (!clipFolder || !canPlayClips()) {
    browserVoice(text, finished);
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
      browserVoice(text, finished);
    };
    audio.addEventListener('ended', finished);
    audio.addEventListener('error', fallBack);
    const playing = audio.play();
    if (playing && typeof playing.catch === 'function') playing.catch(fallBack);
  } catch {
    browserVoice(text, finished);
  }
}

export function stopSpeaking(): void {
  turn++;
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
  return { on, setOn, available: canReadAloud() };
}
